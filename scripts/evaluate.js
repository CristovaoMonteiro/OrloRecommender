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
const TEST_SEEDS = Array.from({ length: 10 }, (_, i) => 20270301 + i);
const lineById = new Map(products.map((p) => [p.id, p.lineId]));
const marginById = new Map(products.map((p) => [p.id, p.margin]));
// Products the store never suggests are not counted as targets.
const lineOf = EXCLUDE_SEEN_LINES ? (id) => lineById.get(id) : undefined;
const DAY_MS = 24 * 60 * 60 * 1000;
const VALIDATION_START = new Date(ANCHOR - 28 * DAY_MS).toISOString();
const TEST_START = new Date(ANCHOR - 14 * DAY_MS).toISOString();
const TEST_END = new Date(ANCHOR + DAY_MS).toISOString();
const SHOWN = 4; // Products shown on the page.
const WEIGHT_STEPS = 10;
const DIVERSITY_GRID = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8];
const DISCOUNT_GRID = [0.2, 0.4, 0.6, 0.8, 1];
const PRICE_GRID = [0, 0.25, 0.5, 1];
const SEASON_GRID = [0, 0.25, 0.5, 0.75, 1, 1.5, 2];
const MARGIN_GRID = [0, 0.5, 1, 2, 3];
// A product seen by fewer training visitors than this counts as "new".
const COLD_VISITORS = 30;
// Reach, diversity and margin cost a little accuracy by design: each may give up this share of the score.
const ACCEPTED_LOSS = 0.01;
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

/**
 * Search on the validation window of the tuning dataset, one group of settings
 * at a time. The blend takes its best value. Price and season take the smallest
 * value within ACCEPTED_LOSS of their best, because each one pulls away from the
 * visitor's taste. Reach for new products, diversity and margin then take the
 * highest value that gives up no more than ACCEPTED_LOSS of the score.
 */
function tune(events) {
  const { train } = temporalSplit(events, VALIDATION_START);
  const cases = buildCases(events, { from: VALIDATION_START, to: TEST_START, lineOf });
  const model = buildModel({ products, events: train });
  const recommender = createRecommender(model, products);
  let trials = 0;
  const ndcgWith = (config) => {
    trials += 1;
    const rank = (c) =>
      recommender
        .recommend({
          history: c.history,
          contextProductId: c.contextProductId,
          k: LIST_SIZE,
          excludeSeenLines: EXCLUDE_SEEN_LINES,
          ...config,
        })
        .map((r) => r.productId);
    return score(rank, cases);
  };
  const bestOf = (options) =>
    options.map((config) => ({ config, ndcg: ndcgWith(config) })).sort((a, b) => b.ndcg - a.ndcg);

  const base = { diversity: 0, priceWeight: 0, seasonWeight: 0, marginWeight: 0 };
  const blends = weightGrid().flatMap((weights) =>
    DISCOUNT_GRID.map((unprovenDiscount) => ({ ...base, weights, unprovenDiscount })),
  );
  let chosen = bestOf(blends)[0].config;
  const lowestAccepted = (key, grid) => {
    const tried = grid.map((value) => ({ value, ndcg: ndcgWith({ ...chosen, [key]: value }) }));
    const floor = Math.max(...tried.map((t) => t.ndcg)) * (1 - ACCEPTED_LOSS);
    chosen = { ...chosen, [key]: Math.min(...tried.filter((t) => t.ndcg >= floor).map((t) => t.value)) };
  };
  lowestAccepted('priceWeight', PRICE_GRID);
  lowestAccepted('seasonWeight', SEASON_GRID);
  const accurateNdcg = ndcgWith(chosen);

  const highestAccepted = (key, grid) => {
    const floor = ndcgWith(chosen) * (1 - ACCEPTED_LOSS);
    const accepted = grid.filter((value) => ndcgWith({ ...chosen, [key]: value }) >= floor);
    chosen = { ...chosen, [key]: Math.max(...accepted) };
  };
  highestAccepted('unprovenDiscount', DISCOUNT_GRID);
  highestAccepted('diversity', DIVERSITY_GRID);
  highestAccepted('marginWeight', MARGIN_GRID);

  return {
    cases: cases.length,
    trials,
    bestNdcg: accurateNdcg,
    chosen: { ...chosen, ndcg: ndcgWith(chosen) },
  };
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
  const cases = buildCases(events, { from: TEST_START, to: TEST_END, lineOf }).map((c) => ({
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
          [`margin@${SHOWN}`]: mean(top.flat().map((id) => marginById.get(id))),
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
    [...COMPARED_WITH, 'hybrid_no_fallback', 'hybrid_accuracy_only', 'hybrid_with_colours'].map((name) => [
      name,
      compare(name),
    ]),
  );

  // The same lists, scored as if views of other colours were hits.
  const ndcgCountingColours = (ranked) =>
    mean(cases.map((c, i) => ndcgAtK(ranked[i], c.allTargets, LIST_SIZE)));

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
    colourRule: {
      targetsExclude: results.hybrid[NDCG].mean,
      targetsInclude: ndcgCountingColours(lists.hybrid),
      targetsIncludeIfShown: ndcgCountingColours(lists.hybrid_with_colours),
      targetsExcludeIfShown: results.hybrid_with_colours[NDCG].mean,
    },
    testCases: cases.length,
    testVisitors: new Set(cases.map((c) => c.visitorId)).size,
  };
}

function run() {
  const tuning = tune(generateInteractions({ products }).events);
  const hybrid = { ...tuning.chosen, excludeSeenLines: EXCLUDE_SEEN_LINES };
  delete hybrid.ndcg;
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
        margin: Number(r[`margin@${SHOWN}`].toFixed(3)),
      },
    ]),
  );
  console.table(rows);
  console.log('headline ratio', report.headline);
  console.table(report.improvementOverNdcg10);
  console.table(report.slicesRecall10);
  console.log('control', report.control);
  console.log('look', JSON.stringify(report.completeTheLook));
  console.log('colour rule', report.colourRule);
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

module.exports = { weightGrid, shuffleProducts, tune, interval };
