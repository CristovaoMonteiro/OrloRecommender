const products = require('../data/products.json');
const { generateInteractions, OUTFIT_PAIRS } = require('../scripts/data/generate');
const { createRandom } = require('../scripts/data/random');

const byId = new Map(products.map((p) => [p.id, p]));
const dataset = generateInteractions({ products });
const visitorsById = new Map(dataset.visitors.map((v) => [v.id, v]));

const eventsByVisitor = new Map();
dataset.events.forEach((event) => {
  if (!eventsByVisitor.has(event.visitorId)) eventsByVisitor.set(event.visitorId, []);
  eventsByVisitor.get(event.visitorId).push(event);
});

const styleOf = (event) => byId.get(event.properties.productId).attributes.style;

/** How often consecutive views by one visitor share a style, for a given style lookup. */
function styleAgreement(lookup) {
  let same = 0;
  let total = 0;
  eventsByVisitor.forEach((events) => {
    const styles = events.filter((e) => e.type === 'view_product').map(lookup);
    for (let i = 1; i < styles.length; i += 1) {
      total += 1;
      if (styles[i] === styles[i - 1]) same += 1;
    }
  });
  return same / total;
}

describe('interaction generator', () => {
  test('is deterministic for a seed and changes with the seed', () => {
    const a = generateInteractions({ products, visitors: 50 });
    const b = generateInteractions({ products, visitors: 50 });
    const c = generateInteractions({ products, visitors: 50, seed: 1 });
    expect(a).toEqual(b);
    expect(a.events).not.toEqual(c.events);
  });

  test('produces a dataset large enough to train on', () => {
    expect(dataset.visitors).toHaveLength(4000);
    expect(dataset.events.length).toBeGreaterThan(10000);
    ['view_product', 'add_to_cart', 'purchase'].forEach((type) => {
      expect(dataset.events.filter((e) => e.type === type).length).toBeGreaterThan(500);
    });
  });

  test('events are chronological and reference known products', () => {
    const ordered = dataset.events.every((e, i, all) => i === 0 || e.timestamp >= all[i - 1].timestamp);
    expect(ordered).toBe(true);
    expect(dataset.events.every((e) => byId.has(e.properties.productId))).toBe(true);
    expect(new Set(dataset.events.map((e) => e.eventId)).size).toBe(dataset.events.length);
  });

  test('a product is viewed before it is carted, and carted before it is bought', () => {
    const stages = new Map();
    let valid = true;
    dataset.events.forEach(({ visitorId, sessionId, type, properties }) => {
      const key = `${visitorId}:${sessionId}:${properties.productId}`;
      const stage = stages.get(key) ?? 0;
      if (type === 'view_product') stages.set(key, Math.max(stage, 1));
      if (type === 'add_to_cart') {
        valid &&= stage >= 1;
        stages.set(key, 2);
      }
      if (type === 'purchase') valid &&= stage === 2;
    });
    expect(valid).toBe(true);
  });

  test('the funnel narrows at a plausible rate', () => {
    const count = (type) => dataset.events.filter((e) => e.type === type).length;
    const cartRate = count('add_to_cart') / count('view_product');
    expect(cartRate).toBeGreaterThan(0.1);
    expect(cartRate).toBeLessThan(0.3);
    expect(count('purchase')).toBeLessThan(count('add_to_cart'));
  });

  test('no product has events before its release date', () => {
    const valid = dataset.events.every((e) => e.timestamp >= byId.get(e.properties.productId).releasedAt);
    expect(valid).toBe(true);
  });

  test('tastes leave a signal: consecutive views agree on style far above chance', () => {
    const rng = createRandom(1);
    const observed = styleAgreement(styleOf);
    const shuffledIds = rng.sample(products, products.length);
    const remap = new Map(products.map((p, i) => [p.id, shuffledIds[i].attributes.style]));
    const baseline = styleAgreement((e) => remap.get(e.properties.productId));
    expect(observed).toBeGreaterThan(baseline + 0.1);
  });

  test('visitors view mostly products of their favourite style', () => {
    const shares = dataset.visitors.map((visitor) => {
      const views = (eventsByVisitor.get(visitor.id) ?? []).filter((e) => e.type === 'view_product');
      const favourite = Object.entries(visitor.style).sort((a, b) => b[1] - a[1])[0][0];
      return views.filter((e) => styleOf(e) === favourite).length / Math.max(views.length, 1);
    });
    const mean = shares.reduce((sum, s) => sum + s, 0) / shares.length;
    expect(mean).toBeGreaterThan(0.45); // Chance would be about 0.25.
  });

  test('categories that form an outfit are bought together more than those that do not', () => {
    const baskets = new Map();
    dataset.events
      .filter((e) => e.type === 'purchase')
      .forEach((e) => {
        if (!baskets.has(e.sessionId)) baskets.set(e.sessionId, new Set());
        baskets.get(e.sessionId).add(e.properties.category);
      });
    const list = [...baskets.values()];
    const support = (test) => list.filter(test).length / list.length;
    const lift = (a, b) =>
      support((x) => x.has(a) && x.has(b)) / (support((x) => x.has(a)) * support((x) => x.has(b)));
    const mean = (values) => values.reduce((sum, v) => sum + v, 0) / values.length;

    const categories = Object.keys(OUTFIT_PAIRS);
    const pairs = categories.flatMap((a) => categories.filter((b) => a < b).map((b) => [a, b]));
    const isOutfit = ([a, b]) => OUTFIT_PAIRS[a].includes(b) || OUTFIT_PAIRS[b].includes(a);

    const outfit = mean(pairs.filter(isOutfit).map(([a, b]) => lift(a, b)));
    const other = mean(pairs.filter((p) => !isOutfit(p)).map(([a, b]) => lift(a, b)));
    expect(outfit).toBeGreaterThan(other + 0.2);
  });

  test('visitors follow traits that no product attribute reveals', () => {
    const matches = dataset.events
      .filter((e) => e.type === 'view_product')
      .map((e) => {
        const visitor = visitorsById.get(e.visitorId);
        const factors = dataset.lineFactors[byId.get(e.properties.productId).lineId];
        return visitor.hidden.reduce((sum, value, i) => sum + value * factors[i], 0);
      });
    expect(matches.reduce((sum, m) => sum + m, 0) / matches.length).toBeGreaterThan(0.3);
  });

  test('demand moves from warm to cold products over the period', () => {
    const middle = dataset.events[Math.floor(dataset.events.length / 2)].timestamp;
    const coldShare = (events) =>
      events.filter((e) => byId.get(e.properties.productId).attributes.season === 'cold').length /
      events.length;
    const early = dataset.events.filter((e) => e.timestamp < middle);
    const late = dataset.events.filter((e) => e.timestamp >= middle);
    expect(coldShare(late)).toBeGreaterThan(coldShare(early) + 0.1);
  });

  test('popularity has a long tail', () => {
    const counts = {};
    dataset.events.forEach(({ properties }) => {
      counts[properties.productId] = (counts[properties.productId] ?? 0) + 1;
    });
    const sorted = Object.values(counts).sort((a, b) => b - a);
    const top = sorted.slice(0, 24).reduce((sum, n) => sum + n, 0);
    expect(top / dataset.events.length).toBeGreaterThan(0.35);
    expect(sorted.length).toBeGreaterThan(100);
  });
});
