/**
 * "Complete the look": what goes with a product, as opposed to what resembles it.
 *
 * Single product pairs share few baskets, so three signals are multiplied:
 * pair lift (shrunk towards 1), category lift (which categories sell together)
 * and content similarity (a matching style). A new product still gets
 * complements from the last two.
 */
const { LIFT_PRIOR } = require('./config');

/** One set of item indexes per session that carted at least one product. */
function buildBaskets(events, index) {
  const baskets = new Map();
  events.forEach(({ sessionId, type, properties }) => {
    if (type !== 'add_to_cart' || !index.has(properties.productId)) return;
    if (!baskets.has(sessionId)) baskets.set(sessionId, new Set());
    baskets.get(sessionId).add(index.get(properties.productId));
  });
  return [...baskets.values()];
}

/** lift(a, b) = P(a and b) / (P(a) * P(b)), with `prior` pseudo-observations pulling it towards 1. */
function shrunkLift(together, countA, countB, total, prior) {
  if (total === 0) return 1;
  const expected = (countA * countB) / total;
  return (together + prior) / (expected + prior);
}

/** How well each pair of categories sells together: { category: { category: lift } }. */
function categoryLift(baskets, categoryOf) {
  const single = {};
  const pairs = {};
  baskets.forEach((basket) => {
    const categories = [...new Set([...basket].map(categoryOf))];
    categories.forEach((a) => {
      single[a] = (single[a] ?? 0) + 1;
      categories.forEach((b) => {
        if (a !== b) pairs[`${a}|${b}`] = (pairs[`${a}|${b}`] ?? 0) + 1;
      });
    });
  });
  return (a, b) => shrunkLift(pairs[`${a}|${b}`] ?? 0, single[a] ?? 0, single[b] ?? 0, baskets.length, 1);
}

/**
 * @returns {number[][]} symmetric matrix, with zeros on the diagonal and
 *   between products of the same category
 */
function buildComplements(events, products, index, contentSimilarity, { prior = LIFT_PRIOR } = {}) {
  const baskets = buildBaskets(events, index);
  const size = products.length;
  const counts = new Array(size).fill(0);
  const together = Array.from({ length: size }, () => new Array(size).fill(0));

  baskets.forEach((basket) => {
    const items = [...basket];
    items.forEach((i) => {
      counts[i] += 1;
      items.forEach((j) => {
        if (i !== j) together[i][j] += 1;
      });
    });
  });

  const liftBetween = categoryLift(baskets, (item) => products[item].category);
  return products.map((a, i) =>
    products.map((b, j) => {
      if (a.category === b.category) return 0;
      const pair = shrunkLift(together[i][j], counts[i], counts[j], baskets.length, prior);
      const match = 0.5 + 0.5 * contentSimilarity[i][j];
      return pair * liftBetween(a.category, b.category) * match;
    }),
  );
}

module.exports = { buildBaskets, shrunkLift, buildComplements };
