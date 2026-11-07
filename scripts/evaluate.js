/**
 * Offline evaluation, reproducible with one command: `npm run evaluate`.
 *
 *   tuning dataset:   train before day -28, tune on days -28 to -14
 *   test datasets:    train before day -14, report on the final 14 days
 *
 * Every dataset has its own seed, so nothing used to design or tune the model
 * appears in the reported numbers, and ten test datasets show how much a result
 * moves. `npm run evaluate -- --tune-only` touches the tuning dataset alone.
 * Results go to data/evaluation.json.
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
const { EXCLUDE_SEEN_LINES } = require('../server/recommender/config');
const { buildCases, buildLookCases } = require('./evaluation/protocol');
const { createRankers, LIST_SIZE } = require('./evaluation/rankers');
const { sampleSizePerGroup } = require('./evaluation/sampleSize');
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
const TEST_SEEDS = Array.from({ length: 10 }, (_, i) => 20270101 + i);
const DAY_MS = 24 * 60 * 60 * 1000;
const VALIDATION_START = new Date(ANCHOR - 28 * DAY_MS).toISOString();
const TEST_START = new Date(ANCHOR - 14 * DAY_MS).toISOString();
const TEST_END = new Date(ANCHOR + DAY_MS).toISOString();
const SHOWN = 4; // Products shown on the page.
const WEIGHT_STEPS = 10;
const DIVERSITY_GRID = [0, 0.1, 0.2, 0.3, 0.4, 0.5];
// A product seen by fewer training visitors than this counts as "new".
const COLD_VISITORS = 30;
// Diversity costs a little accuracy by design: accept up to this share of the best score.
const ACCEPTED_LOSS = 0.02;
const NDCG = `ndcg@${LIST_SIZE}`;
const RECALL = `recall@${SHOWN}`;
const COMPARED_WITH = ['same_category', 'same_category_popular', 'content', 'collaborative'];
// Assumptions of the experiment plan, not measurements.
const EXPERIMENT = { baseline: 0.08, lifts: [0.05, 0.1, 0.2] };

/** Every mix of the two models, in steps of 1 / WEIGHT_STEPS. */
function weightGrid() {
  return Array.from({ length: WEIGHT_STEPS + 1 }, (_, i) => ({
    collaborative: i / WEIGHT_STEPS,
    content: (WEIGHT_STEPS - i) / WEIGHT_STEPS,
  }));
}

const score = (rank, cases, k = LIST_SIZE) => mean(cases.map((c) => ndcgAtK(rank(c), c.targets, k)));

/** Grid search on the validation window of the tuning dataset. */
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
        excludeSeenLines: EXCLUDE_SEEN_LINES,
        ...config,
      })
      .map((r) => r.productId);

  const trials = weightGrid().flatMap((weights) =>
    DIVERSITY_GRID.map((diversity) => {
      const config = { weights, diversity };
      return { ...config, ndcg: score(rankWith(config), cases) };
    }),
  );
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

/** Replaces each event's product with another event's, destroying who-liked-what but keeping popularity. */
function shuffleProducts(events) {
  const rng = createRandom(7);
  const shuffled = rng.sample(
    events.map((e) => e.properties),
    events.length,
  );
  return events.map((event, i) => ({ ...event, properties: shuffled[i] }));
}

function lookLists(cases, model) {
  const recommender = createRecommender(model, products);
  const byId = new Map(products.map((p) => [p.id, p]));
  const popular = model.productIds
    .map((id, i) => ({ id, popularity: model.popularity[i] }))
    .sort((a, b) => b.popularity - a.popularity)
    .map(({ id }) => id);

  return {
    complements: cases.map((c) =>
      recommender.completeTheLook({ productId: c.productId, k: SHOWN }).map((r) => r.productId),
    ),
    popular_other_category: cases.map((c) =>
      popular.filter((id) => byId.get(id).category !== byId.get(c.productId).category).slice(0, SHOWN),
    ),
  };
}

/** Trains on one test dataset and ranks all of its cases with every approach. */
function runDataset(seed, hybrid) {
  const { events } = generateInteractions({ products, seed });
  const { train } = temporalSplit(events, TEST_START);
  const model = buildModel({ products, events: train });
  const rankers = createRankers({ model, products, hybrid });

  const coldProducts = new Set(model.productIds.filter((_, i) => model.visitors[i] < COLD_VISITORS));
  const cases = buildCases(events, { from: TEST_START, to: TEST_END }).map((c) => ({
    ...c,
    newTargets: new Set([...c.targets].filter((id) => coldProducts.has(id))),
  }));
  const lists = Object.fromEntries(
    Object.entries(rankers).map(([name, rank]) => [name, cases.map((c) => rank(c))]),
  );

  // Control: with who-liked-what destroyed, collaborative must lose its edge over popularity.
  const shuffledModel = buildModel({ products, events: shuffleProducts(train) });
  const shuffledRank = createRankers({ model: shuffledModel, products, hybrid }).collaborative;

  const lookCases = buildLookCases(events, products, { from: TEST_START, to: TEST_END });
  return {
    seed,
    model,
    cases,
    lists,
    lookCases,
    look: lookLists(lookCases, model),
    trainEvents: train.length,
    shuffled: score(shuffledRank, cases),
  };
}

const ndcgOf = (ranked, cases) => mean(cases.map((c, i) => ndcgAtK(ranked[i], c.targets, LIST_SIZE)));
const recallOf = (ranked, cases) => mean(cases.map((c, i) => recallAtK(ranked[i], c.targets, SHOWN)));

function rangeOf(values) {
  return { mean: mean(values), min: Math.min(...values), max: Math.max(...values) };
}

/** Pools the cases of all datasets, and keeps how each result moved between datasets. */
function aggregate(datasets) {
  const cases = datasets.flatMap((d) => d.cases);
  const names = Object.keys(datasets[0].lists);
  const lists = Object.fromEntries(names.map((name) => [name, datasets.flatMap((d) => d.lists[name])]));
  const { content } = datasets[0].model;
  const position = new Map(datasets[0].model.productIds.map((id, i) => [id, i]));
  const similarityOf = (a, b) => content[position.get(a)][position.get(b)];

  const metric = (fn, ranked, k) =>
    interval(
      cases,
      cases.map((c, i) => fn(ranked[i], c.targets, k)),
      3,
    );
  const results = Object.fromEntries(
    names.map((name) => {
      const ranked = lists[name];
      const top = ranked.map((list) => list.slice(0, SHOWN));
      return [
        name,
        {
          [RECALL]: metric(recallAtK, ranked, SHOWN),
          [`hitRate@${SHOWN}`]: metric(hitRateAtK, ranked, SHOWN),
          [`ndcg@${SHOWN}`]: metric(ndcgAtK, ranked, SHOWN),
          [`recall@${LIST_SIZE}`]: metric(recallAtK, ranked, LIST_SIZE),
          [NDCG]: metric(ndcgAtK, ranked, LIST_SIZE),
          // Coverage is per dataset: pooling lists would only make it look larger.
          [`coverage@${SHOWN}`]: mean(
            datasets.map((d) =>
              catalogueCoverage(
                d.lists[name].map((list) => list.slice(0, SHOWN)),
                products.length,
              ),
            ),
          ),
          [`diversity@${SHOWN}`]: mean(top.map((list) => listDiversity(list, similarityOf))),
          ndcgRange: rangeOf(datasets.map((d) => ndcgOf(d.lists[name], d.cases))),
        },
      ];
    }),
  );

  const compare = (name) => {
    const perDataset = datasets.map((d) => ndcgOf(d.lists.hybrid, d.cases) - ndcgOf(d.lists[name], d.cases));
    const values = cases.map(
      (c, i) =>
        ndcgAtK(lists.hybrid[i], c.targets, LIST_SIZE) - ndcgAtK(lists[name][i], c.targets, LIST_SIZE),
    );
    return {
      ...interval(cases, values, 5),
      datasetsAhead: perDataset.filter((value) => value > 0).length,
      smallest: Math.min(...perDataset),
      largest: Math.max(...perDataset),
    };
  };
  const improvements = Object.fromEntries(
    [...COMPARED_WITH, 'hybrid_no_fallback', 'hybrid_with_colours'].map((name) => [name, compare(name)]),
  );

  const ratios = datasets.map(
    (d) => recallOf(d.lists.hybrid, d.cases) / recallOf(d.lists.same_category_popular, d.cases),
  );

  // Slices: first visit against returning visitors, and products with little data.
  const slices = {};
  const addSlice = (label, keep, targetsOf = (c) => c.targets) => {
    const indexes = cases.flatMap((c, i) => (keep(c) && targetsOf(c).size > 0 ? [i] : []));
    slices[label] = { cases: indexes.length };
    names.forEach((name) => {
      slices[label][name] = mean(
        indexes.map((i) => recallAtK(lists[name][i], targetsOf(cases[i]), LIST_SIZE)),
      );
    });
  };
  addSlice('first_session', (c) => c.priorProducts === 0);
  addSlice('returning_1_to_9_products', (c) => c.priorProducts > 0 && c.priorProducts < 10);
  addSlice('returning_10_plus_products', (c) => c.priorProducts >= 10);
  addSlice(
    'new_products_only',
    () => true,
    (c) => c.newTargets,
  );

  const lookCases = datasets.flatMap((d) => d.lookCases);
  const look = { cases: lookCases.length };
  ['complements', 'popular_other_category'].forEach((name) => {
    const ranked = datasets.flatMap((d) => d.look[name]);
    look[name] = interval(
      lookCases,
      lookCases.map((c, i) => hitRateAtK(ranked[i], c.targets, SHOWN)),
      11,
    );
  });

  return {
    results,
    improvementOverNdcg10: improvements,
    headline: rangeOf(ratios),
    slicesRecall10: slices,
    control: {
      collaborative_real: results.collaborative[NDCG].mean,
      collaborative_shuffled: mean(datasets.map((d) => d.shuffled)),
      popularity: results.popularity[NDCG].mean,
      random: results.random[NDCG].mean,
    },
    completeTheLook: look,
    testCases: cases.length,
    testVisitors: new Set(cases.map((c) => c.visitorId)).size,
  };
}

function run() {
  const tuning = tune(generateInteractions({ products }).events);
  const hybrid = {
    weights: tuning.chosen.weights,
    diversity: tuning.chosen.diversity,
    excludeSeenLines: EXCLUDE_SEEN_LINES,
  };
  const datasets = TEST_SEEDS.map((seed) => runDataset(seed, hybrid));
  const { testCases, testVisitors, ...findings } = aggregate(datasets);

  return {
    protocol: {
      tuningSeed: DEFAULT_SEED,
      testSeeds: TEST_SEEDS,
      trainBefore: TEST_START,
      validationFrom: VALIDATION_START,
      testFrom: TEST_START,
      excludeSeenLines: EXCLUDE_SEEN_LINES,
      testCases,
      testVisitors,
      trainEventsPerDataset: Math.round(mean(datasets.map((d) => d.trainEvents))),
      coldVisitors: COLD_VISITORS,
    },
    tuning,
    ...findings,
    experiment: {
      baseline: EXPERIMENT.baseline,
      perGroup: EXPERIMENT.lifts.map((lift) => ({
        lift,
        visitors: sampleSizePerGroup(EXPERIMENT.baseline, lift),
      })),
    },
  };
}

function printReport(report) {
  console.log(JSON.stringify(report.protocol));
  console.log('tuning chosen', JSON.stringify(report.tuning.chosen));
  const rows = Object.fromEntries(
    Object.entries(report.results).map(([name, r]) => [
      name,
      {
        [RECALL]: Number(r[RECALL].mean.toFixed(3)),
        [NDCG]: Number(r[NDCG].mean.toFixed(3)),
        min: Number(r.ndcgRange.min.toFixed(3)),
        max: Number(r.ndcgRange.max.toFixed(3)),
        coverage: Number(r[`coverage@${SHOWN}`].toFixed(3)),
        diversity: Number(r[`diversity@${SHOWN}`].toFixed(3)),
      },
    ]),
  );
  console.table(rows);
  console.log('headline ratio', report.headline);
  console.table(report.improvementOverNdcg10);
  console.table(report.slicesRecall10);
  console.log('control', report.control);
  console.log('look', JSON.stringify(report.completeTheLook));
  console.log('experiment', JSON.stringify(report.experiment));
}

if (require.main === module) {
  if (process.argv.includes('--tune-only')) {
    console.log(JSON.stringify(tune(generateInteractions({ products }).events), null, 1));
  } else {
    const report = run();
    fs.writeFileSync(OUTPUT, `${JSON.stringify(report, null, 2)}\n`);
    printReport(report);
  }
}

module.exports = { weightGrid, shuffleProducts, tune };
