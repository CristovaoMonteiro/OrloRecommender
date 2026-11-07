/**
 * Offline evaluation, reproducible with one command: `npm run evaluate`.
 *
 *   tuning dataset:  train before day -28, tune on days -28 to -14
 *   test dataset:    train before day -14, report on the final 14 days
 *
 * The two datasets come from different seeds, so nothing used to design or tune
 * the model appears in the reported numbers. Results go to data/evaluation.json.
 */
const fs = require('fs');
const path = require('path');

const products = require('../data/products.json');
const { ANCHOR } = require('./build-catalogue');
const { generateInteractions, DEFAULT_SEED } = require('./data/generate');
const { createRandom } = require('./data/random');
const { buildModel } = require('../server/recommender/buildModel');
const { temporalSplit } = require('../server/recommender/split');
const { createRecommender } = require('../server/recommender/recommend');
const { buildCases, buildLookCases } = require('./evaluation/protocol');
const { createRankers, LIST_SIZE } = require('./evaluation/rankers');
const {
  recallAtK,
  hitRateAtK,
  ndcgAtK,
  catalogueCoverage,
  listDiversity,
  mean,
  bootstrapInterval,
} = require('./evaluation/metrics');

const OUTPUT = path.join(__dirname, '..', 'data', 'evaluation.json');
const TEST_SEED = 20261109;
const DAY_MS = 24 * 60 * 60 * 1000;
const VALIDATION_START = new Date(ANCHOR - 28 * DAY_MS).toISOString();
const TEST_START = new Date(ANCHOR - 14 * DAY_MS).toISOString();
const TEST_END = new Date(ANCHOR + DAY_MS).toISOString();
const SHOWN = 4; // Products shown on the page.
const WEIGHT_STEP = 0.2;
const DIVERSITY_GRID = [0, 0.1, 0.2, 0.3, 0.4, 0.5];
// A product seen by fewer training visitors than this counts as "new".
const COLD_VISITORS = 30;
// Diversity costs a little accuracy by design: accept up to this share of the best score.
const ACCEPTED_LOSS = 0.02;

/** Every weight mix on the simplex, in steps of WEIGHT_STEP. */
function weightGrid() {
  const steps = Math.round(1 / WEIGHT_STEP);
  const grid = [];
  for (let a = 0; a <= steps; a += 1) {
    for (let b = 0; b <= steps - a; b += 1) {
      grid.push({ collaborative: a / steps, content: b / steps, popularity: (steps - a - b) / steps });
    }
  }
  return grid;
}

const score = (rank, cases, k = LIST_SIZE) => mean(cases.map((c) => ndcgAtK(rank(c), c.targets, k)));

/** Grid search on the validation window only. */
function tune(events) {
  const { train } = temporalSplit(events, VALIDATION_START);
  const cases = buildCases(events, { from: VALIDATION_START, to: TEST_START });
  const model = buildModel({ products, events: train });
  const recommender = createRecommender(model, products);
  const rankWith = (config) => (c) =>
    recommender
      .recommend({
        history: c.history,
        contextProductId: c.contextProductId,
        k: LIST_SIZE,
        ...config,
      })
      .map((r) => r.productId);

  const trials = [];
  weightGrid().forEach((weights) => {
    DIVERSITY_GRID.forEach((diversity) => {
      [false, true].forEach((excludeSeenLines) => {
        const config = { weights, diversity, excludeSeenLines };
        trials.push({ ...config, ndcg: score(rankWith(config), cases) });
      });
    });
  });
  trials.sort((a, b) => b.ndcg - a.ndcg);
  const best = trials[0];
  // Among near-best settings, prefer the most diverse lists; then the best score.
  const accepted = trials
    .filter((t) => t.ndcg >= best.ndcg * (1 - ACCEPTED_LOSS))
    .sort((a, b) => b.diversity - a.diversity || b.ndcg - a.ndcg);
  return { cases: cases.length, trials: trials.length, best, chosen: accepted[0] };
}

/** Mean and 95% interval of a per-case value, resampling whole visitors. */
function interval(cases, values, seed) {
  const groups = new Map();
  cases.forEach((c, i) => {
    if (!groups.has(c.visitorId)) groups.set(c.visitorId, []);
    groups.get(c.visitorId).push(values[i]);
  });
  return bootstrapInterval([...groups.values()], { seed });
}

function evaluateRanker(lists, cases, similarityOf, seed) {
  const metric = (fn, k) =>
    interval(
      cases,
      cases.map((c, i) => fn(lists[i], c.targets, k)),
      seed,
    );
  const top = lists.map((list) => list.slice(0, SHOWN));
  return {
    [`recall@${SHOWN}`]: metric(recallAtK, SHOWN),
    [`hitRate@${SHOWN}`]: metric(hitRateAtK, SHOWN),
    [`ndcg@${SHOWN}`]: metric(ndcgAtK, SHOWN),
    [`recall@${LIST_SIZE}`]: metric(recallAtK, LIST_SIZE),
    [`ndcg@${LIST_SIZE}`]: metric(ndcgAtK, LIST_SIZE),
    [`coverage@${SHOWN}`]: catalogueCoverage(top, products.length),
    [`diversity@${SHOWN}`]: mean(top.map((list) => listDiversity(list, similarityOf))),
  };
}

/** Paired difference in ndcg@10, so both rankers are judged on the same cases. */
function pairedDifference(a, b, cases, seed) {
  const values = cases.map(
    (c, i) => ndcgAtK(a[i], c.targets, LIST_SIZE) - ndcgAtK(b[i], c.targets, LIST_SIZE),
  );
  return interval(cases, values, seed);
}

/** Replaces each event's product with another event's, destroying who-liked-what but keeping popularity. */
function shuffleProducts(events) {
  const rng = createRandom(7);
  const shuffled = rng.sample(
    events.map((e) => e.properties),
    events.length,
  );
  return events.map((event, i) => ({ ...event, properties: shuffled[i] }));
}

function evaluateLook(events, train, model) {
  const cases = buildLookCases(events, products, { from: TEST_START, to: TEST_END });
  const recommender = createRecommender(model, products);
  const byId = new Map(products.map((p) => [p.id, p]));
  const popular = model.productIds
    .map((id, i) => ({ id, popularity: model.popularity[i] }))
    .sort((a, b) => b.popularity - a.popularity)
    .map(({ id }) => id);

  const lists = {
    complements: cases.map((c) =>
      recommender.completeTheLook({ productId: c.productId, k: SHOWN }).map((r) => r.productId),
    ),
    popular_other_category: cases.map((c) =>
      popular.filter((id) => byId.get(id).category !== byId.get(c.productId).category).slice(0, SHOWN),
    ),
  };
  const report = { cases: cases.length };
  Object.entries(lists).forEach(([name, ranked]) => {
    report[name] = interval(
      cases,
      cases.map((c, i) => hitRateAtK(ranked[i], c.targets, SHOWN)),
      11,
    );
  });
  return report;
}

function run() {
  const tuning = tune(generateInteractions({ products }).events);
  const { events } = generateInteractions({ products, seed: TEST_SEED });
  const hybrid = {
    weights: tuning.chosen.weights,
    diversity: tuning.chosen.diversity,
    excludeSeenLines: tuning.chosen.excludeSeenLines,
  };

  const { train } = temporalSplit(events, TEST_START);
  const cases = buildCases(events, { from: TEST_START, to: TEST_END });
  const model = buildModel({ products, events: train });
  const position = new Map(model.productIds.map((id, i) => [id, i]));
  const similarityOf = (a, b) => model.content[position.get(a)][position.get(b)];

  const rankers = createRankers({ model, products, hybrid });
  const lists = Object.fromEntries(
    Object.entries(rankers).map(([name, rank]) => [name, cases.map((c) => rank(c))]),
  );
  const results = Object.fromEntries(
    Object.entries(lists).map(([name, ranked]) => [name, evaluateRanker(ranked, cases, similarityOf, 3)]),
  );

  const improvements = Object.fromEntries(
    ['same_category', 'popularity', 'content', 'collaborative', 'hybrid_no_fallback'].map((name) => [
      name,
      pairedDifference(lists.hybrid, lists[name], cases, 5),
    ]),
  );

  // Slices: first visit against returning visitors, and products with little data.
  const slices = {};
  const addSlice = (label, keep, targetsOf = (c) => c.targets) => {
    const indexes = cases.flatMap((c, i) => (keep(c) && targetsOf(c).size > 0 ? [i] : []));
    const subset = indexes.map((i) => ({ ...cases[i], targets: targetsOf(cases[i]) }));
    slices[label] = { cases: subset.length };
    Object.entries(lists).forEach(([name, ranked]) => {
      const chosen = indexes.map((i) => ranked[i]);
      slices[label][name] = mean(subset.map((c, i) => recallAtK(chosen[i], c.targets, LIST_SIZE)));
    });
  };
  addSlice('first_session', (c) => c.priorProducts === 0);
  addSlice('returning_1_to_9_products', (c) => c.priorProducts > 0 && c.priorProducts < 10);
  addSlice('returning_10_plus_products', (c) => c.priorProducts >= 10);
  const coldProducts = new Set(model.productIds.filter((_, i) => model.visitors[i] < COLD_VISITORS));
  addSlice(
    'new_products_only',
    () => true,
    (c) => new Set([...c.targets].filter((id) => coldProducts.has(id))),
  );

  // Control: with who-liked-what destroyed, collaborative must lose its edge over popularity.
  const shuffledModel = buildModel({ products, events: shuffleProducts(train) });
  const shuffledRank = createRankers({ model: shuffledModel, products, hybrid }).collaborative;
  const control = {
    collaborative_real: results.collaborative[`ndcg@${LIST_SIZE}`].mean,
    collaborative_shuffled: score(shuffledRank, cases),
    popularity: results.popularity[`ndcg@${LIST_SIZE}`].mean,
    random: results.random[`ndcg@${LIST_SIZE}`].mean,
  };

  return {
    protocol: {
      tuningSeed: DEFAULT_SEED,
      testSeed: TEST_SEED,
      trainBefore: TEST_START,
      validationFrom: VALIDATION_START,
      testFrom: TEST_START,
      testCases: cases.length,
      testVisitors: new Set(cases.map((c) => c.visitorId)).size,
      trainEvents: train.length,
      coldProducts: coldProducts.size,
    },
    tuning,
    results,
    improvementOverNdcg10: improvements,
    slicesRecall10: slices,
    control,
    completeTheLook: evaluateLook(events, train, model),
  };
}

if (require.main === module) {
  const report = run();
  fs.writeFileSync(OUTPUT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report.protocol, null, 1));
  console.log('tuning best  ', JSON.stringify(report.tuning.best));
  console.log('tuning chosen', JSON.stringify(report.tuning.chosen));
  const rows = Object.fromEntries(
    Object.entries(report.results).map(([name, r]) => [
      name,
      Object.fromEntries(
        Object.entries(r).map(([k, v]) => [k, Number((typeof v === 'number' ? v : v.mean).toFixed(3))]),
      ),
    ]),
  );
  console.table(rows);
  console.log('hybrid minus X, ndcg@10');
  console.table(report.improvementOverNdcg10);
  console.log('recall@10 by slice');
  console.table(report.slicesRecall10);
  console.log('control', report.control);
  console.log('look', JSON.stringify(report.completeTheLook));
}

module.exports = { weightGrid, shuffleProducts, tune };
