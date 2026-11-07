/**
 * Runs the recommender on real purchases from the public Online Retail II
 * dataset (UK online gift retailer, December 2009 to December 2011, CC BY 4.0).
 *
 *   npm run evaluate:real -- retail.csv
 *   npm run evaluate:real -- retail.csv --tune-only
 *
 * The CSV comes from scripts/prepare-retail.py and stays out of the repository.
 * data/evaluation-real.json holds aggregate results only, never customer rows.
 *
 * The task mirrors the synthetic one: from a customer's history and the first
 * product of an order, predict the rest of the order. The tuning period ends
 * before the test period starts.
 */
const fs = require('fs');
const path = require('path');

const { createRandom } = require('./data/random');
const { buildPopularity } = require('../server/recommender/buildModel');
const { buildCollaborativeSimilarity } = require('../server/recommender/collaborative');
const { tokenize, tfidfSimilarity } = require('../server/recommender/content');
const { temporalSplit } = require('../server/recommender/split');
const { buildCases } = require('./evaluation/protocol');
const { createRankers, LIST_SIZE } = require('./evaluation/rankers');
const { interval, shuffleProducts } = require('./evaluate');
const { recallAtK, ndcgAtK, catalogueCoverage, mean } = require('./evaluation/metrics');

const OUTPUT = path.join(__dirname, '..', 'data', 'evaluation-real.json');
const VALIDATION_START = '2011-03-01';
const TEST_START = '2011-06-01';
const TEST_END = '2011-12-31';
const CATALOGUE_SIZE = 1000;
const SHOWN = 4;
const TUNING_CASES = 1500;
const WEIGHT_STEPS = 5;
const DISCOUNTS = [0, 0.4, 0.8];
const RANKERS = ['random', 'popularity', 'content', 'collaborative', 'hybrid'];

/** Splits one CSV line, honouring quoted fields. */
function parseLine(line) {
  const fields = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      fields.push(field);
      field = '';
    } else field += char;
  }
  fields.push(field);
  return fields;
}

/** Orders as purchase events, in the same shape as the store's events. */
function loadEvents(file) {
  const [, ...lines] = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean);
  const descriptions = new Map();
  const prices = new Map();
  const events = lines.map((line) => {
    const [invoice, stock, description, , date, price, customer] = parseLine(line);
    if (description) descriptions.set(stock, description);
    prices.set(stock, Number(price));
    return {
      visitorId: customer,
      sessionId: invoice,
      type: 'purchase',
      timestamp: `${date.slice(0, 19)}.000Z`,
      properties: { productId: stock },
    };
  });
  events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return { events, descriptions, prices };
}

/** The products most customers bought before the cutoff, so the catalogue ignores the future. */
function buildCatalogue(train, descriptions, prices) {
  const customers = new Map();
  train.forEach(({ visitorId, properties: { productId } }) => {
    if (!customers.has(productId)) customers.set(productId, new Set());
    customers.get(productId).add(visitorId);
  });
  return [...customers]
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, CATALOGUE_SIZE)
    .map(([id]) => ({
      id,
      lineId: id,
      category: 'all',
      price: prices.get(id),
      description: { en: descriptions.get(id) ?? '' },
      attributes: {},
    }));
}

function buildRealModel(products, train) {
  const index = new Map(products.map((p, i) => [p.id, i]));
  const documents = products.map((p) => {
    const terms = new Map();
    tokenize(p.description.en).forEach((word) => terms.set(word, (terms.get(word) ?? 0) + 1));
    return terms;
  });
  const { similarity, visitors } = buildCollaborativeSimilarity(train, index);
  return {
    productIds: products.map((p) => p.id),
    content: tfidfSimilarity(documents),
    collaborative: similarity,
    popularity: buildPopularity(train, index),
    visitors,
  };
}

function casesFor(events, products, range) {
  const known = new Set(products.map((p) => p.id));
  const inCatalogue = events.filter((e) => known.has(e.properties.productId));
  return buildCases(inCatalogue, range);
}

const ndcgOf = (ranked, cases) => mean(cases.map((c, i) => ndcgAtK(ranked[i], c.targets, LIST_SIZE)));

/** Blend and discount, tuned on the months before the test period. */
function tune(events, descriptions, prices) {
  const { train } = temporalSplit(events, VALIDATION_START);
  const products = buildCatalogue(train, descriptions, prices);
  const model = buildRealModel(products, train);
  const rng = createRandom(5);
  const all = casesFor(events, products, { from: VALIDATION_START, to: TEST_START });
  const cases = rng.sample(all, TUNING_CASES);

  let best = null;
  for (let i = 0; i <= WEIGHT_STEPS; i += 1) {
    const weights = { collaborative: i / WEIGHT_STEPS, content: (WEIGHT_STEPS - i) / WEIGHT_STEPS };
    DISCOUNTS.forEach((unprovenDiscount) => {
      const hybrid = { weights, unprovenDiscount, excludeSeenLines: false, diversity: 0 };
      const rank = createRankers({ model, products, hybrid }).hybrid;
      const ndcg = ndcgOf(
        cases.map((c) => rank(c)),
        cases,
      );
      if (!best || ndcg > best.ndcg) best = { ...hybrid, ndcg };
    });
  }
  return { cases: cases.length, available: all.length, chosen: best };
}

function evaluate(events, descriptions, prices, hybrid) {
  const { train } = temporalSplit(events, TEST_START);
  const products = buildCatalogue(train, descriptions, prices);
  const model = buildRealModel(products, train);
  const cases = casesFor(events, products, { from: TEST_START, to: TEST_END });
  const rankers = createRankers({ model, products, hybrid });
  const lists = Object.fromEntries(RANKERS.map((name) => [name, cases.map((c) => rankers[name](c))]));

  const results = Object.fromEntries(
    RANKERS.map((name) => {
      const ranked = lists[name];
      const metric = (fn, k) =>
        interval(
          cases,
          cases.map((c, i) => fn(ranked[i], c.targets, k)),
          3,
        );
      return [
        name,
        {
          [`recall@${SHOWN}`]: metric(recallAtK, SHOWN),
          [`recall@${LIST_SIZE}`]: metric(recallAtK, LIST_SIZE),
          [`ndcg@${LIST_SIZE}`]: metric(ndcgAtK, LIST_SIZE),
          [`coverage@${SHOWN}`]: catalogueCoverage(
            ranked.map((list) => list.slice(0, SHOWN)),
            products.length,
          ),
        },
      ];
    }),
  );

  const compare = (name) =>
    interval(
      cases,
      cases.map(
        (c, i) =>
          ndcgAtK(lists.hybrid[i], c.targets, LIST_SIZE) - ndcgAtK(lists[name][i], c.targets, LIST_SIZE),
      ),
      5,
    );

  const shuffled = buildRealModel(products, shuffleProducts(train));
  const shuffledRank = createRankers({ model: shuffled, products, hybrid }).collaborative;

  return {
    testCases: cases.length,
    testCustomers: new Set(cases.map((c) => c.visitorId)).size,
    products: products.length,
    trainEvents: train.length,
    results,
    improvementOverNdcg10: Object.fromEntries(
      ['popularity', 'content', 'collaborative'].map((name) => [name, compare(name)]),
    ),
    control: {
      collaborative_real: results.collaborative[`ndcg@${LIST_SIZE}`].mean,
      collaborative_shuffled: ndcgOf(
        cases.map((c) => shuffledRank(c)),
        cases,
      ),
      popularity: results.popularity[`ndcg@${LIST_SIZE}`].mean,
    },
  };
}

if (require.main === module) {
  const file = process.argv[2];
  if (!file) throw new Error('Usage: node scripts/evaluate-real.js retail.csv [--tune-only]');
  const { events, descriptions, prices } = loadEvents(file);
  const tuning = tune(events, descriptions, prices);
  console.log('tuning', JSON.stringify(tuning));

  if (!process.argv.includes('--tune-only')) {
    const { ndcg, ...hybrid } = tuning.chosen;
    const report = {
      dataset: {
        name: 'Online Retail II',
        source: 'https://archive.ics.uci.edu/dataset/502/online+retail+ii',
        licence: 'CC BY 4.0',
        business: 'UK online gift retailer',
        orders: new Set(events.map((e) => e.sessionId)).size,
        customers: new Set(events.map((e) => e.visitorId)).size,
      },
      protocol: { validationFrom: VALIDATION_START, testFrom: TEST_START, testTo: TEST_END },
      tuning: { ...tuning, validationNdcg: ndcg },
      ...evaluate(events, descriptions, prices, hybrid),
    };
    fs.writeFileSync(OUTPUT, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify({ ...report, tuning: undefined }, null, 1));
  }
}

module.exports = { parseLine };
