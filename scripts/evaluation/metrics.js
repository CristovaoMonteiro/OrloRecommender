/** Ranking metrics and bootstrap confidence intervals. */
const { createRandom } = require('../data/random');

const BOOTSTRAP_ROUNDS = 1000;

/** Share of the relevant products that appear in the top k. */
function recallAtK(ranked, targets, k) {
  const hits = ranked.slice(0, k).filter((id) => targets.has(id)).length;
  return hits / targets.size;
}

/** 1 if at least one relevant product appears in the top k, otherwise 0. */
function hitRateAtK(ranked, targets, k) {
  return ranked.slice(0, k).some((id) => targets.has(id)) ? 1 : 0;
}

/** Binary NDCG: a hit counts for more the closer it is to the top of the list. */
function ndcgAtK(ranked, targets, k) {
  const gain = (position) => 1 / Math.log2(position + 2);
  const dcg = ranked.slice(0, k).reduce((sum, id, i) => sum + (targets.has(id) ? gain(i) : 0), 0);
  let ideal = 0;
  for (let i = 0; i < Math.min(targets.size, k); i += 1) ideal += gain(i);
  return dcg / ideal;
}

/** Share of the catalogue shown to anyone across all lists. */
function catalogueCoverage(lists, catalogueSize) {
  return new Set(lists.flat()).size / catalogueSize;
}

/** 1 minus the mean content similarity between the products of one list. */
function listDiversity(ids, similarityOf) {
  const pairs = ids.flatMap((a, i) => ids.slice(i + 1).map((b) => similarityOf(a, b)));
  if (pairs.length === 0) return 0;
  return 1 - pairs.reduce((sum, value) => sum + value, 0) / pairs.length;
}

const mean = (values) => (values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0);

/**
 * Percentile bootstrap that resamples whole groups. Lists from one visitor are
 * not independent, so resampling single lists would make the interval too narrow.
 * @param {number[][]} groups one array of values per visitor
 * @returns {{ mean: number, low: number, high: number }} 95% interval
 */
function bootstrapInterval(groups, { seed = 1, rounds = BOOTSTRAP_ROUNDS } = {}) {
  const rng = createRandom(seed);
  const sums = groups.map((values) => values.reduce((sum, v) => sum + v, 0));
  const sizes = groups.map((values) => values.length);
  const total = sizes.reduce((sum, n) => sum + n, 0);

  const estimates = [];
  for (let round = 0; round < rounds; round += 1) {
    let sum = 0;
    let count = 0;
    for (let i = 0; i < groups.length; i += 1) {
      const group = rng.int(0, groups.length - 1);
      sum += sums[group];
      count += sizes[group];
    }
    estimates.push(count ? sum / count : 0);
  }
  estimates.sort((a, b) => a - b);
  return {
    mean: total ? sums.reduce((sum, v) => sum + v, 0) / total : 0,
    low: estimates[Math.floor(rounds * 0.025)],
    high: estimates[Math.ceil(rounds * 0.975) - 1],
  };
}

module.exports = {
  recallAtK,
  hitRateAtK,
  ndcgAtK,
  catalogueCoverage,
  listDiversity,
  mean,
  bootstrapInterval,
};
