const { buildModel, buildSeasonTrend } = require('../server/recommender/buildModel');
const { createRecommender } = require('../server/recommender/recommend');
const { makeProduct, makeEvent } = require('./helpers/fixtures');

const history = [{ productId: 'seed', type: 'view_product' }];
const options = { history, k: 3, diversity: 0, priceWeight: 0, seasonWeight: 0, marginWeight: 0 };

function setup(products) {
  const events = [];
  for (let i = 0; i < 40; i += 1) {
    products.forEach((p) => events.push(makeEvent(`v${i}`, p.id)));
  }
  return { model: buildModel({ products, events }), recommender: createRecommender };
}

describe('business adjustments', () => {
  test('price fit favours the price level of what the visitor looked at', () => {
    const products = [
      makeProduct('seed', { price: 100, category: 'polos' }),
      makeProduct('same', { price: 100 }),
      makeProduct('far', { price: 400 }),
    ];
    const { model } = setup(products);
    const recommender = createRecommender(model, products);
    const ranked = recommender.recommend({ ...options, priceWeight: 1 });
    expect(ranked.map((r) => r.productId)).toEqual(['same', 'far']);
    expect(ranked[1].score).toBeCloseTo(ranked[0].score * Math.exp(-Math.log(4)), 10);
  });

  test('margin favours the more profitable of two equal products', () => {
    const products = [
      makeProduct('seed', { margin: 0.5, category: 'polos' }),
      makeProduct('low', { margin: 0.3 }),
      makeProduct('high', { margin: 0.7 }),
    ];
    const { model } = setup(products);
    const ranked = createRecommender(model, products).recommend({ ...options, marginWeight: 1 });
    expect(ranked[0].productId).toBe('high');
  });

  test('a season trend moves scores, within its limit', () => {
    const products = [
      makeProduct('seed', { category: 'polos' }),
      makeProduct('warm', { attributes: { season: 'warm' } }),
      makeProduct('cold', { attributes: { season: 'cold' } }),
    ];
    const { model } = setup(products);
    const trended = { ...model, seasonTrend: { all: 1, warm: 0.1, cold: 9 } };
    const ranked = createRecommender(trended, products).recommend({ ...options, seasonWeight: 1 });
    expect(ranked[0].productId).toBe('cold');
    // 9 and 0.1 are limited to 1.5 and 1 / 1.5, so the gap is 2.25 and not 90.
    expect(ranked[0].score / ranked[1].score).toBeCloseTo(2.25, 1);
    expect(ranked[0].trending).toBe(true);
  });

  test('components still add up to the adjusted score', () => {
    const products = [makeProduct('seed', { price: 10, category: 'polos' }), makeProduct('a', { price: 40 })];
    const { model } = setup(products);
    const [first] = createRecommender(model, products).recommend({ ...options, priceWeight: 1 });
    expect(first.components.collaborative + first.components.content).toBeCloseTo(first.score, 10);
  });
});

describe('buildSeasonTrend', () => {
  const products = [
    makeProduct('warm', { attributes: { season: 'warm' } }),
    makeProduct('cold', { attributes: { season: 'cold' } }),
  ];

  test('shows a season rising near the end of the data', () => {
    const at = (id, timestamp) => makeEvent('v', id, 'view_product', { timestamp });
    const events = [
      at('warm', '2026-06-01T00:00:00.000Z'),
      at('warm', '2026-06-02T00:00:00.000Z'),
      at('warm', '2026-06-03T00:00:00.000Z'),
      at('cold', '2026-09-30T00:00:00.000Z'),
    ];
    const trend = buildSeasonTrend(events, products);
    expect(trend.cold).toBeCloseTo(4, 10);
    expect(trend.warm).toBe(0);
  });

  test('is neutral with no events', () => {
    expect(buildSeasonTrend([], products)).toEqual({ warm: 1, cold: 1 });
  });
});

describe('lending behaviour to new products', () => {
  const products = [
    makeProduct('seed', { category: 'polos' }),
    makeProduct('twin', { description: { en: 'waxed cotton field jacket' } }),
    makeProduct('fresh', { description: { en: 'waxed cotton field jacket' } }),
    makeProduct('other', {
      attributes: { style: 'coastal', material: 'linen', season: 'warm', formality: 1, palette: 'rich' },
      category: 'trousers',
      shape: 'trousers',
      color: { id: 'rust' },
    }),
  ];
  const events = [];
  for (let i = 0; i < 40; i += 1) {
    events.push(makeEvent(`v${i}`, 'seed'), makeEvent(`v${i}`, 'twin'), makeEvent(`w${i}`, 'other'));
  }
  const model = buildModel({ products, events });
  const request = { ...options, weights: { collaborative: 1, content: 0 }, unprovenDiscount: 1, k: 3 };

  test('a product with no history inherits from its closest products', () => {
    const lent = createRecommender(model, products).recommend(request);
    const fresh = lent.find((r) => r.productId === 'fresh');
    expect(fresh.components.collaborative).toBeGreaterThan(0);
  });

  test('the explanation does not claim behaviour the product never had', () => {
    const lent = createRecommender(model, products).recommend({
      ...request,
      weights: { collaborative: 0.8, content: 0.2 },
    });
    const fresh = lent.find((r) => r.productId === 'fresh');
    expect(fresh.reasons.map((r) => r.model)).not.toContain('collaborative');
  });

  test('switching the fallback off uses raw behaviour only', () => {
    const raw = createRecommender(model, products).recommend({ ...request, fallback: false });
    expect(raw.find((r) => r.productId === 'fresh')?.score ?? 0).toBe(0);
  });
});
