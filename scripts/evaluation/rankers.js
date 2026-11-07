/**
 * Everything the hybrid is compared with. All rankers leave out the same seen
 * products, so differences come from the ranking and not from the candidates.
 */
const { createRandom } = require('../data/random');
const { createRecommender } = require('../../server/recommender/recommend');

const LIST_SIZE = 10;

/** Products the visitor has already touched, plus the one on screen. */
const seenIds = ({ history, contextProductId }) =>
  new Set([...history.map((entry) => entry.productId), contextProductId]);

const byPopularity = (popularityOf) => (a, b) => popularityOf.get(b.id) - popularityOf.get(a.id);

function createRankers({ model, products, hybrid }) {
  const recommender = createRecommender(model, products);
  const byId = new Map(products.map((p) => [p.id, p]));
  const rng = createRandom(42);

  const unseen = (testCase) => {
    const seen = seenIds(testCase);
    const lines = new Set([...seen].map((id) => byId.get(id).lineId));
    return products.filter((p) => !seen.has(p.id) && !(hybrid.excludeSeenLines && lines.has(p.lineId)));
  };
  const usingModels =
    (weights, options = {}) =>
    (testCase) =>
      recommender
        .recommend({
          history: testCase.history,
          contextProductId: testCase.contextProductId,
          k: LIST_SIZE,
          weights,
          diversity: 0,
          excludeSeenLines: hybrid.excludeSeenLines,
          priceWeight: 0,
          seasonWeight: 0,
          marginWeight: 0,
          ...options,
        })
        .map((result) => result.productId);
  const { weights: blend, ...settings } = hybrid;

  const popularityOf = new Map(model.productIds.map((id, i) => [id, model.popularity[i]]));

  return {
    random: (testCase) => rng.sample(unseen(testCase), LIST_SIZE).map((p) => p.id),
    popularity: (testCase) =>
      unseen(testCase)
        .sort(byPopularity(popularityOf))
        .slice(0, LIST_SIZE)
        .map((p) => p.id),
    // The rule the Visitor Journey store uses today: same category first, in catalogue order.
    same_category: (testCase) => {
      const { category } = byId.get(testCase.contextProductId);
      return unseen(testCase)
        .sort((a, b) => Number(b.category === category) - Number(a.category === category))
        .slice(0, LIST_SIZE)
        .map((p) => p.id);
    },
    // The same rule at its strongest: within the category, best sellers come first.
    same_category_popular: (testCase) => {
      const { category } = byId.get(testCase.contextProductId);
      const popular = byPopularity(popularityOf);
      return unseen(testCase)
        .sort((a, b) => Number(b.category === category) - Number(a.category === category) || popular(a, b))
        .slice(0, LIST_SIZE)
        .map((p) => p.id);
    },
    content: usingModels({ collaborative: 0, content: 1 }),
    collaborative: usingModels({ collaborative: 1, content: 0 }, { fallback: false }),
    hybrid_no_fallback: usingModels(blend, { ...settings, fallback: false }),
    hybrid: usingModels(blend, settings),
    // The same blend with no diversity or margin rules: what those rules cost in accuracy.
    hybrid_accuracy_only: usingModels(blend, { ...settings, diversity: 0, marginWeight: 0 }),
    // What the rule against other colours costs on this metric.
    hybrid_with_colours: usingModels(blend, { ...settings, excludeSeenLines: false }),
  };
}

module.exports = { createRankers, LIST_SIZE };
