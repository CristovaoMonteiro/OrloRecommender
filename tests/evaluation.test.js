const {
  recallAtK,
  hitRateAtK,
  ndcgAtK,
  catalogueCoverage,
  listDiversity,
  bootstrapInterval,
} = require('../scripts/evaluation/metrics');
const { buildCases, buildLookCases } = require('../scripts/evaluation/protocol');
const { weightGrid, shuffleProducts } = require('../scripts/evaluate');
const { buildModel } = require('../server/recommender/buildModel');
const { createRecommender } = require('../server/recommender/recommend');
const config = require('../server/recommender/config');
const { makeProduct, makeEvent } = require('./helpers/fixtures');

describe('metrics', () => {
  const targets = new Set(['a', 'b']);

  test('recall and hit rate match values computed by hand', () => {
    expect(recallAtK(['x', 'a', 'y'], targets, 3)).toBe(0.5);
    expect(recallAtK(['a', 'b', 'y'], targets, 3)).toBe(1);
    expect(recallAtK(['x', 'y', 'a'], targets, 2)).toBe(0);
    expect(hitRateAtK(['x', 'a'], targets, 2)).toBe(1);
    expect(hitRateAtK(['x', 'y', 'a'], targets, 2)).toBe(0);
  });

  test('NDCG matches a value computed by hand', () => {
    // dcg = 1 / log2(3) = 0.63093; ideal = 1 + 0.63093, so ndcg = 0.38685.
    expect(ndcgAtK(['x', 'a', 'y'], targets, 3)).toBeCloseTo(0.38685, 4);
  });

  test('NDCG is 1 for a perfect list and 0 with no hits', () => {
    expect(ndcgAtK(['a', 'b', 'x'], targets, 3)).toBeCloseTo(1, 10);
    expect(ndcgAtK(['x', 'y'], targets, 2)).toBe(0);
  });

  test('coverage counts distinct products across all lists', () => {
    expect(
      catalogueCoverage(
        [
          ['a', 'b'],
          ['b', 'c'],
        ],
        10,
      ),
    ).toBe(0.3);
  });

  test('diversity is 1 minus the mean pairwise similarity', () => {
    expect(listDiversity(['a', 'b', 'c'], () => 0.25)).toBeCloseTo(0.75, 10);
    expect(listDiversity(['a'], () => 1)).toBe(0);
  });
});

describe('bootstrapInterval', () => {
  test('constant values give a zero-width interval', () => {
    expect(bootstrapInterval([[1], [1], [1, 1]])).toEqual({ mean: 1, low: 1, high: 1 });
  });

  test('is deterministic and contains the mean', () => {
    const groups = Array.from({ length: 50 }, (_, i) => [i % 2, (i % 3) / 2]);
    const first = bootstrapInterval(groups, { seed: 9 });
    expect(bootstrapInterval(groups, { seed: 9 })).toEqual(first);
    expect(first.low).toBeLessThan(first.mean);
    expect(first.high).toBeGreaterThan(first.mean);
  });

  test('resampling visitors is wider than resampling lists when a visitor repeats', () => {
    const clustered = Array.from({ length: 40 }, (_, i) => new Array(5).fill(i % 2));
    const flat = clustered.flat().map((value) => [value]);
    const width = ({ low, high }) => high - low;
    expect(width(bootstrapInterval(clustered))).toBeGreaterThan(width(bootstrapInterval(flat)) * 1.5);
  });
});

describe('buildCases', () => {
  const at = (visitor, session, product, day, type = 'view_product') =>
    makeEvent(visitor, product, type, {
      sessionId: session,
      timestamp: `2026-09-${String(day).padStart(2, '0')}T10:00:00.000Z`,
    });
  const window = { from: '2026-09-10T00:00:00.000Z', to: '2026-09-20T00:00:00.000Z' };

  test('history holds the past and the opening product, targets hold the rest of the session', () => {
    const events = [at('v', 's1', 'old', 1), at('v', 's2', 'open', 12), at('v', 's2', 'next', 12)];
    const [testCase] = buildCases(events, window);
    expect(testCase.history.map((h) => h.productId)).toEqual(['old', 'open']);
    expect(testCase.contextProductId).toBe('open');
    expect([...testCase.targets]).toEqual(['next']);
    expect(testCase.priorProducts).toBe(1);
  });

  test('nothing from the session being predicted leaks into the history', () => {
    const events = [at('v', 's', 'open', 12), at('v', 's', 'next', 12), at('v', 's', 'next', 12, 'purchase')];
    const [testCase] = buildCases(events, window);
    expect(testCase.history).toEqual([{ productId: 'open', type: 'view_product' }]);
  });

  test('products already seen are not targets, and sessions with no new product are skipped', () => {
    const events = [
      at('v', 's1', 'old', 1),
      at('v', 's2', 'open', 12),
      at('v', 's2', 'old', 12),
      at('w', 's3', 'solo', 12),
    ];
    expect(buildCases(events, window)).toEqual([]);
  });

  test('only sessions starting inside the window become cases', () => {
    const events = [
      at('v', 'before', 'a', 5),
      at('v', 'before', 'b', 5),
      at('v', 'after', 'c', 25),
      at('v', 'after', 'd', 25),
    ];
    expect(buildCases(events, window)).toEqual([]);
  });

  test('a second session in the window sees the first one as history', () => {
    const events = [
      at('v', 's1', 'a', 11),
      at('v', 's1', 'b', 11),
      at('v', 's2', 'c', 12),
      at('v', 's2', 'd', 12),
    ];
    const cases = buildCases(events, window);
    expect(cases).toHaveLength(2);
    expect(cases[1].history.map((h) => h.productId)).toEqual(['a', 'b', 'c']);
  });
});

describe('buildLookCases', () => {
  const products = [
    makeProduct('shirt', { category: 'shirts' }),
    makeProduct('shirt2', { category: 'shirts' }),
    makeProduct('jeans', { category: 'trousers' }),
  ];
  const window = { from: '2026-09-01T00:00:00.000Z', to: '2026-10-01T00:00:00.000Z' };

  test('predicts the other categories of a basket from its first product', () => {
    const events = [
      makeEvent('v', 'shirt', 'add_to_cart'),
      makeEvent('v', 'shirt2', 'add_to_cart'),
      makeEvent('v', 'jeans', 'add_to_cart'),
    ];
    const [testCase] = buildLookCases(events, products, window);
    expect(testCase.productId).toBe('shirt');
    expect([...testCase.targets]).toEqual(['jeans']);
  });

  test('skips baskets from a single category', () => {
    const events = [makeEvent('v', 'shirt', 'add_to_cart'), makeEvent('v', 'shirt2', 'add_to_cart')];
    expect(buildLookCases(events, products, window)).toEqual([]);
  });
});

describe('evaluation helpers', () => {
  test('weightGrid covers the simplex in steps of 0.2', () => {
    const grid = weightGrid();
    expect(grid).toHaveLength(21);
    grid.forEach(({ collaborative, content, popularity }) => {
      expect(collaborative + content + popularity).toBeCloseTo(1, 10);
    });
  });

  test('shuffleProducts keeps each product count but changes who touched what', () => {
    const events = [];
    for (let i = 0; i < 60; i += 1) events.push(makeEvent(`v${i}`, `p${i % 6}`));
    const shuffled = shuffleProducts(events);
    const count = (list) => {
      const counts = {};
      list.forEach((e) => {
        counts[e.properties.productId] = (counts[e.properties.productId] ?? 0) + 1;
      });
      return counts;
    };
    expect(count(shuffled)).toEqual(count(events));
    expect(shuffled.map((e) => e.properties.productId)).not.toEqual(
      events.map((e) => e.properties.productId),
    );
    expect(shuffled.map((e) => e.visitorId)).toEqual(events.map((e) => e.visitorId));
  });
});

describe('thin-data handling', () => {
  // "proven" and "unproven" have identical attributes, so content cannot separate them.
  const catalogue = [
    makeProduct('seed', { category: 'polos' }),
    makeProduct('proven'),
    makeProduct('unproven'),
  ];
  const events = [];
  for (let i = 0; i < 40; i += 1) events.push(makeEvent(`v${i}`, 'seed'), makeEvent(`v${i}`, 'proven'));
  const model = buildModel({ products: catalogue, events });
  const history = [{ productId: 'seed', type: 'view_product' }];
  const weights = { collaborative: 0.6, content: 0.4, popularity: 0 };

  test('a proven product outranks an unproven one with the same content', () => {
    const results = createRecommender(model, catalogue).recommend({ history, weights, k: 2, diversity: 0 });
    expect(results.map((r) => r.productId)).toEqual(['proven', 'unproven']);
  });

  test('the discount sets how much of the moved weight an unproven product keeps', () => {
    const score = (unprovenDiscount) =>
      createRecommender(model, catalogue, { unprovenDiscount })
        .recommend({ history, weights, k: 2, diversity: 0 })
        .find((r) => r.productId === 'unproven').score;
    expect(score(0)).toBeCloseTo(0.4, 10);
    expect(score(0.5)).toBeCloseTo(0.7, 10);
    expect(score(1)).toBeCloseTo(1, 10);
  });

  test('confidence grows in proportion to visitors, up to full trust', () => {
    const score = (confidenceVisitors) =>
      createRecommender(model, catalogue, { confidenceVisitors, unprovenDiscount: 0 }).recommend({
        history,
        weights,
        k: 1,
        diversity: 0,
      })[0].components.collaborative;
    expect(score(40)).toBeCloseTo(0.6, 10);
    expect(score(80)).toBeCloseTo(0.6 * 0.5 * 0.5, 10);
  });

  test('with the fallback off, each model stands alone', () => {
    const [first] = createRecommender(model, catalogue).recommend({
      history,
      weights: { collaborative: 1, content: 0, popularity: 0 },
      fallback: false,
      k: 1,
      diversity: 0,
    });
    expect(first.productId).toBe('proven');
    expect(first.components.content).toBe(0);
  });

  test('tunable settings keep their documented range', () => {
    expect(config.UNPROVEN_DISCOUNT).toBeGreaterThanOrEqual(0);
    expect(config.UNPROVEN_DISCOUNT).toBeLessThanOrEqual(1);
    const { collaborative, content, popularity } = config.DEFAULT_WEIGHTS;
    expect(collaborative + content + popularity).toBeCloseTo(1, 10);
  });
});

describe('published evaluation', () => {
  const report = require('../data/evaluation.json');

  test('reports the settings the recommender actually uses', () => {
    expect(report.tuning.chosen.weights).toEqual(config.DEFAULT_WEIGHTS);
    expect(report.tuning.chosen.diversity).toBe(config.DEFAULT_DIVERSITY);
    expect(report.tuning.chosen.excludeSeenLines).toBe(config.EXCLUDE_SEEN_LINES);
  });

  test('the test data comes from a different seed than the tuning data', () => {
    expect(report.protocol.testSeed).not.toBe(report.protocol.tuningSeed);
  });
});
