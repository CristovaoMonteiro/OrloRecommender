/**
 * Hybrid recommender. Takes a visitor's recent products, stores nothing, and
 * returns ranked products with each model's share of the score and the
 * reasons behind it.
 */
const {
  EVENT_WEIGHTS,
  RECENCY_DECAY,
  DEFAULT_WEIGHTS,
  DEFAULT_DIVERSITY,
  EXCLUDE_SEEN_LINES,
  COLLABORATIVE_CONFIDENCE_VISITORS,
  UNPROVEN_DISCOUNT,
  NEIGHBOURS,
  PRICE_FIT_WEIGHT,
  SEASON_WEIGHT,
  SEASON_TREND_LIMIT,
  MARGIN_WEIGHT,
  MAX_LOOK_PER_CATEGORY,
} = require('./config');

const SHARED_ATTRIBUTES = ['style', 'material', 'season', 'palette'];
// Season groups whose recent demand is this much above average get an "in season" note.
const TRENDING_ABOVE = 1.1;

/** Sums to 1. All-zero or invalid weights fall back to the defaults. */
function normaliseWeights(weights) {
  const keys = Object.keys(DEFAULT_WEIGHTS);
  const values = keys.map((key) => Number(weights?.[key] ?? 0));
  const total = values.reduce((sum, v) => sum + v, 0);
  if (!values.every((v) => Number.isFinite(v) && v >= 0) || total <= 0) return { ...DEFAULT_WEIGHTS };
  return Object.fromEntries(keys.map((key, i) => [key, values[i] / total]));
}

/** Weighted sum of a matrix's rows for the seed items, for each candidate. */
function scoreFromSeeds(matrix, seeds, candidates) {
  const scores = new Map();
  candidates.forEach((candidate) => {
    let score = 0;
    seeds.forEach((weight, seed) => {
      score += weight * matrix[seed][candidate];
    });
    scores.set(candidate, score);
  });
  return scores;
}

/** Divides by the largest value, so models on different scales can be blended. */
function scaleToOne(scores) {
  const top = Math.max(...scores.values(), 0);
  if (top <= 0) return scores;
  return new Map([...scores].map(([item, score]) => [item, score / top]));
}

function strongestSeed(matrix, seeds, candidate) {
  let best = null;
  let bestScore = 0;
  seeds.forEach((weight, seed) => {
    const score = weight * matrix[seed][candidate];
    if (score > bestScore) {
      best = seed;
      bestScore = score;
    }
  });
  return best;
}

/**
 * Lends thin products the behaviour of their closest products by content, in
 * proportion to how little they have of their own. A new colour of a popular
 * jacket then starts from what is known about the jacket.
 */
function lendBehaviour(collaborative, content, confidence) {
  const lent = collaborative.map((row) => [...row]);
  confidence.forEach((own, item) => {
    if (own >= 1) return;
    const neighbours = content[item]
      .map((similarity, other) => ({ similarity, other }))
      .filter(({ similarity, other }) => other !== item && confidence[other] >= 1 && similarity > 0)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, NEIGHBOURS);
    const total = neighbours.reduce((sum, { similarity }) => sum + similarity, 0);
    if (total === 0) return;

    lent[item].forEach((_, target) => {
      if (target === item) return;
      const borrowed = neighbours.reduce(
        (sum, { similarity, other }) =>
          sum + (similarity / total) * (other === target ? 0 : collaborative[other][target]),
        0,
      );
      const value = own * collaborative[item][target] + (1 - own) * borrowed;
      lent[item][target] = value;
      lent[target][item] = value;
    });
  });
  return lent;
}

function createRecommender(model, products, options = {}) {
  const { confidenceVisitors = COLLABORATIVE_CONFIDENCE_VISITORS, unprovenDiscount = UNPROVEN_DISCOUNT } =
    options;
  const index = new Map(model.productIds.map((id, i) => [id, i]));
  const items = model.productIds.map((id) => products.find((p) => p.id === id));
  const confidence = model.visitors.map((n) => Math.min(1, n / confidenceVisitors));
  const lentCollaborative = lendBehaviour(model.collaborative, model.content, confidence);
  const meanMargin = items.reduce((sum, p) => sum + (p.margin ?? 0), 0) / items.length;

  /** Item => weight, newest interaction first. The product on screen counts as strongly as a purchase. */
  function seedsFrom(history, contextProductId) {
    const seeds = new Map();
    const add = (item, weight) => seeds.set(item, Math.max(seeds.get(item) ?? 0, weight));

    [...history].reverse().forEach(({ productId, type }, age) => {
      const item = index.get(productId);
      if (item !== undefined && EVENT_WEIGHTS[type]) add(item, EVENT_WEIGHTS[type] * RECENCY_DECAY ** age);
    });
    if (index.has(contextProductId)) add(index.get(contextProductId), EVENT_WEIGHTS.purchase);
    return seeds;
  }

  function sharedAttributes(a, b) {
    return SHARED_ATTRIBUTES.filter((key) => items[a].attributes[key] === items[b].attributes[key]);
  }

  function reasonsFor(candidate, components, seeds) {
    const reasons = [];
    // A product with little behaviour of its own is explained by what it resembles.
    if (components.collaborative > 0 && confidence[candidate] >= 0.5) {
      const seed = strongestSeed(model.collaborative, seeds, candidate);
      if (seed !== null) {
        reasons.push({
          model: 'collaborative',
          share: components.collaborative,
          productId: model.productIds[seed],
        });
      }
    }
    if (components.content > 0) {
      const seed = strongestSeed(model.content, seeds, candidate);
      if (seed !== null) {
        reasons.push({
          model: 'content',
          share: components.content,
          productId: model.productIds[seed],
          shared: sharedAttributes(seed, candidate),
        });
      }
    }
    if (components.popularity > 0) reasons.push({ model: 'popularity', share: components.popularity });
    return reasons.sort((a, b) => b.share - a.share);
  }

  /** Greedy MMR: trades score against similarity to what was already picked. One colour per line. */
  function diversify(ranked, k, diversity) {
    const remaining = [...ranked];
    const picked = [];
    const lines = new Set();

    while (picked.length < k && remaining.length > 0) {
      let bestAt = -1;
      let bestValue = -Infinity;
      remaining.forEach((entry, position) => {
        if (lines.has(items[entry.item].lineId)) return;
        const redundancy = Math.max(0, ...picked.map((p) => model.content[p.item][entry.item]));
        const value = (1 - diversity) * entry.score - diversity * redundancy;
        if (value > bestValue) {
          bestValue = value;
          bestAt = position;
        }
      });
      if (bestAt === -1) break;
      const [chosen] = remaining.splice(bestAt, 1);
      picked.push(chosen);
      lines.add(items[chosen.item].lineId);
    }
    return picked;
  }

  /**
   * @param {object} request
   * @param {{ productId: string, type: string }[]} [request.history] oldest first
   * @param {string} [request.contextProductId] the product on screen
   * @param {number} [request.k] how many products to return
   * @param {object} [request.weights] { collaborative, content }
   * @param {number} [request.diversity] MMR trade-off from 0 to 1
   * @param {boolean} [request.excludeSeenLines] skip other colours of products already seen
   * @param {boolean} [request.fallback] lend behaviour and move weight to content when data
   *   is thin; off only to measure a model on its own
   * @param {number} [request.unprovenDiscount] share of moved weight an unproven product keeps
   * @param {number} [request.priceWeight] how much to favour the visitor's usual price level
   * @param {number} [request.seasonWeight] how much to follow the current season's demand
   * @param {number} [request.marginWeight] how much to favour products with a higher margin
   */
  function recommend({
    history = [],
    contextProductId = null,
    k = 4,
    weights = DEFAULT_WEIGHTS,
    diversity = DEFAULT_DIVERSITY,
    excludeSeenLines = EXCLUDE_SEEN_LINES,
    fallback = true,
    unprovenDiscount: discount = unprovenDiscount,
    priceWeight = PRICE_FIT_WEIGHT,
    seasonWeight = SEASON_WEIGHT,
    marginWeight = MARGIN_WEIGHT,
  } = {}) {
    const seeds = seedsFrom(history, contextProductId);
    const seenLines = new Set(excludeSeenLines ? [...seeds.keys()].map((seed) => items[seed].lineId) : []);
    const candidates = model.productIds
      .map((_, i) => i)
      .filter((i) => !seeds.has(i) && !seenLines.has(items[i].lineId));

    // No signal about this visitor yet: everyone gets the best sellers.
    if (seeds.size === 0) {
      const ranked = candidates
        .map((item) => {
          const popularity = model.popularity[item];
          return { item, score: popularity, components: { popularity } };
        })
        .sort((a, b) => b.score - a.score);
      return diversify(ranked, k, diversity).map((entry) => toResult(entry, seeds));
    }

    const blend = normaliseWeights(weights);
    const behaviour = fallback ? lentCollaborative : model.collaborative;
    const collaborative = scaleToOne(scoreFromSeeds(behaviour, seeds, candidates));
    const content = scaleToOne(scoreFromSeeds(model.content, seeds, candidates));

    // Collaborative scores deserve trust only when both ends have data. The weight they
    // cannot use is split between borrowed behaviour and content, at a discount so that
    // an unproven product does not outrank a proven one that matches equally well.
    const seedTotal = [...seeds.values()].reduce((sum, w) => sum + w, 0);
    // The visitor's usual price level, in logs so that EUR 50 and EUR 200 average to EUR 100.
    const usualPrice =
      [...seeds].reduce((sum, [seed, w]) => sum + w * Math.log(items[seed].price ?? 1), 0) / seedTotal;

    /** Multiplies a score by how well a product fits price, season and margin. */
    const businessFit = (item) => {
      const { price = 1, margin = meanMargin, attributes } = items[item];
      const priceFit = Math.exp(-priceWeight * Math.abs(Math.log(price) - usualPrice));
      const trend = model.seasonTrend?.[attributes?.season] ?? 1;
      const limited = Math.min(SEASON_TREND_LIMIT, Math.max(1 / SEASON_TREND_LIMIT, trend));
      const seasonFit = limited ** seasonWeight;
      const marginFit = 1 + marginWeight * (margin - meanMargin);
      return priceFit * seasonFit * marginFit;
    };
    const seedConfidence = [...seeds].reduce((sum, [seed, w]) => sum + w * confidence[seed], 0) / seedTotal;

    const ranked = candidates
      .map((item) => {
        const trust = fallback ? confidence[item] * seedConfidence : 1;
        const movedWeight = blend.collaborative * (1 - trust) * discount;
        const collaborativeWeight = blend.collaborative * trust + movedWeight / 2;
        const contentWeight = blend.content + movedWeight / 2;
        const fit = businessFit(item);
        const components = {
          collaborative: fit * collaborativeWeight * collaborative.get(item),
          content: fit * contentWeight * content.get(item),
        };
        return { item, components, score: components.collaborative + components.content };
      })
      .sort((a, b) => b.score - a.score);

    return diversify(ranked, k, diversity).map((entry) => toResult(entry, seeds));
  }

  function toResult({ item, score, components }, seeds) {
    const trend = model.seasonTrend?.[items[item].attributes?.season] ?? 1;
    return {
      productId: model.productIds[item],
      score,
      components,
      reasons: reasonsFor(item, components, seeds),
      ...(trend > TRENDING_ABOVE ? { trending: true } : {}),
    };
  }

  /** Pieces that go with a product, from at most MAX_LOOK_PER_CATEGORY per category. */
  function completeTheLook({ productId, k = 4, exclude = [] }) {
    const source = index.get(productId);
    if (source === undefined) return [];

    const excluded = new Set(exclude.map((id) => index.get(id)));
    const perCategory = {};
    const lines = new Set();
    const results = [];
    const ranked = model.complements[source]
      .map((score, item) => ({ item, score }))
      .filter(({ item, score }) => score > 0 && !excluded.has(item))
      .sort((a, b) => b.score - a.score);

    for (const { item, score } of ranked) {
      if (results.length === k) break;
      const { category, lineId } = items[item];
      if ((perCategory[category] ?? 0) >= MAX_LOOK_PER_CATEGORY || lines.has(lineId)) continue;
      perCategory[category] = (perCategory[category] ?? 0) + 1;
      lines.add(lineId);
      results.push({
        productId: model.productIds[item],
        score,
        reasons: [{ model: 'complement', productId, shared: sharedAttributes(source, item) }],
      });
    }
    return results;
  }

  return { recommend, completeTheLook };
}

module.exports = { createRecommender, normaliseWeights };
