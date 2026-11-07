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

function createRankers({ model, products, hybrid }) {
  const recommender = createRecommender(model, products);
  const byId = new Map(products.map((p) => [p.id, p]));
  const rng = createRandom(42);

  const unseen = (testCase) => {
    const seen = seenIds(testCase);
    return products.filter((p) => !seen.has(p.id));
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
          ...options,
        })
        .map((result) => result.productId);

  const popularityOf = new Map(model.productIds.map((id, i) => [id, model.popularity[i]]));

  return {
    random: (testCase) => rng.sample(unseen(testCase), LIST_SIZE).map((p) => p.id),
    popularity: (testCase) =>
      unseen(testCase)
        .sort((a, b) => popularityOf.get(b.id) - popularityOf.get(a.id))
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
    content: usingModels({ collaborative: 0, content: 1, popularity: 0 }),
    collaborative: usingModels({ collaborative: 1, content: 0, popularity: 0 }, { fallback: false }),
    hybrid_no_fallback: usingModels(hybrid.weights, {
      diversity: hybrid.diversity,
      excludeSeenLines: hybrid.excludeSeenLines,
      fallback: false,
    }),
    hybrid: usingModels(hybrid.weights, {
      diversity: hybrid.diversity,
      excludeSeenLines: hybrid.excludeSeenLines,
    }),
  };
}

module.exports = { createRankers, LIST_SIZE };
