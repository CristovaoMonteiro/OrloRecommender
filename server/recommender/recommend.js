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
  MAX_LOOK_PER_CATEGORY,
} = require('./config');

const SHARED_ATTRIBUTES = ['style', 'material', 'season', 'palette'];

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

function createRecommender(model, products, options = {}) {
  const { confidenceVisitors = COLLABORATIVE_CONFIDENCE_VISITORS, unprovenDiscount = UNPROVEN_DISCOUNT } =
    options;
  const index = new Map(model.productIds.map((id, i) => [id, i]));
  const items = model.productIds.map((id) => products.find((p) => p.id === id));
  const confidence = model.visitors.map((n) => Math.min(1, n / confidenceVisitors));

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
    if (components.collaborative > 0) {
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
   * @param {object} [request.weights] { collaborative, content, popularity }
   * @param {number} [request.diversity] MMR trade-off from 0 to 1
   * @param {boolean} [request.excludeSeenLines] skip other colours of products already seen
   * @param {boolean} [request.fallback] move weight to content when data is thin; off only to
   *   measure a model on its own
   */
  function recommend({
    history = [],
    contextProductId = null,
    k = 4,
    weights = DEFAULT_WEIGHTS,
    diversity = DEFAULT_DIVERSITY,
    excludeSeenLines = EXCLUDE_SEEN_LINES,
    fallback = true,
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
          return { item, score: popularity, components: { collaborative: 0, content: 0, popularity } };
        })
        .sort((a, b) => b.score - a.score);
      return diversify(ranked, k, diversity).map((entry) => toResult(entry, seeds));
    }

    const blend = normaliseWeights(weights);
    const collaborative = scaleToOne(scoreFromSeeds(model.collaborative, seeds, candidates));
    const content = scaleToOne(scoreFromSeeds(model.content, seeds, candidates));

    // Collaborative scores deserve trust only when both ends have data, and popularity
    // means little for a product that just launched. The weight they cannot use moves
    // to content, which keeps new products reachable, at a discount so that an unproven
    // product does not outrank a proven one that matches equally well.
    const seedTotal = [...seeds.values()].reduce((sum, w) => sum + w, 0);
    const seedConfidence = [...seeds].reduce((sum, [seed, w]) => sum + w * confidence[seed], 0) / seedTotal;

    const ranked = candidates
      .map((item) => {
        const collaborativeWeight = blend.collaborative * (fallback ? confidence[item] * seedConfidence : 1);
        const popularityWeight = blend.popularity * (fallback ? confidence[item] : 1);
        const movedWeight = blend.collaborative + blend.popularity - collaborativeWeight - popularityWeight;
        const contentWeight = blend.content + movedWeight * unprovenDiscount;
        const components = {
          collaborative: collaborativeWeight * collaborative.get(item),
          content: contentWeight * content.get(item),
          popularity: popularityWeight * model.popularity[item],
        };
        return {
          item,
          components,
          score: components.collaborative + components.content + components.popularity,
        };
      })
      .sort((a, b) => b.score - a.score);

    return diversify(ranked, k, diversity).map((entry) => toResult(entry, seeds));
  }

  function toResult({ item, score, components }, seeds) {
    return {
      productId: model.productIds[item],
      score,
      components,
      reasons: reasonsFor(item, components, seeds),
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
