const products = require('../data/products.json');
const { generateInteractions } = require('../scripts/data/generate');
const { buildModel } = require('../server/recommender/buildModel');
const { createRecommender, normaliseWeights } = require('../server/recommender/recommend');
const { DEFAULT_WEIGHTS } = require('../server/recommender/config');
const { makeProduct, makeEvent } = require('./helpers/fixtures');

const byId = new Map(products.map((p) => [p.id, p]));
const { events } = generateInteractions({ products, visitors: 1500 });
const model = buildModel({ products, events });
const recommender = createRecommender(model, products);

const styleOf = (id) => byId.get(id).attributes.style;
const view = (productId) => ({ productId, type: 'view_product' });
const firstOfStyle = (style, count) =>
  products
    .filter((p) => p.attributes.style === style && p.releasedAt < '2026-09-01')
    .slice(0, count)
    .map((p) => p.id);

describe('normaliseWeights', () => {
  test('scales weights to sum to 1', () => {
    expect(normaliseWeights({ collaborative: 3, content: 1 })).toEqual({
      collaborative: 0.75,
      content: 0.25,
    });
  });

  test('falls back to defaults on zero, negative or invalid input', () => {
    expect(normaliseWeights({ collaborative: 0, content: 0 })).toEqual(DEFAULT_WEIGHTS);
    expect(normaliseWeights({ collaborative: -1, content: 2 })).toEqual(DEFAULT_WEIGHTS);
    expect(normaliseWeights({ collaborative: 'x', content: 1 })).toEqual(DEFAULT_WEIGHTS);
    expect(normaliseWeights(undefined)).toEqual(DEFAULT_WEIGHTS);
  });
});

describe('recommend', () => {
  test('with no history, returns best sellers and says so', () => {
    const results = recommender.recommend({ k: 4 });
    expect(results).toHaveLength(4);
    results.forEach((r) => expect(r.reasons.map((reason) => reason.model)).toEqual(['popularity']));
    const top = model.popularity.indexOf(1);
    expect(results[0].productId).toBe(model.productIds[top]);
  });

  test('is a pure function: same input, same output', () => {
    const request = { history: [view('p001'), view('p010')], k: 4 };
    expect(recommender.recommend(request)).toEqual(recommender.recommend(request));
  });

  test('never recommends what the visitor already touched or the product on screen', () => {
    const history = [view('p001'), view('p002')];
    const results = recommender.recommend({ history, contextProductId: 'p003', k: 12 });
    const ids = results.map((r) => r.productId);
    ['p001', 'p002', 'p003'].forEach((id) => expect(ids).not.toContain(id));
  });

  test('ignores unknown products and event types', () => {
    const history = [view('ghost'), { productId: 'p001', type: 'hack' }];
    const results = recommender.recommend({ history, k: 2 });
    expect(results[0].reasons[0].model).toBe('popularity');
  });

  test('returns at most one colour of each line', () => {
    const results = recommender.recommend({ history: [view('p001')], k: 10 });
    const lines = results.map((r) => byId.get(r.productId).lineId);
    expect(new Set(lines).size).toBe(lines.length);
  });

  test('hides other colours of anything already seen, unless asked not to', () => {
    const history = [view('p001')];
    const line = (id) => byId.get(id).lineId;
    const hidden = recommender.recommend({ history, k: 12 }).map((r) => line(r.productId));
    expect(hidden).not.toContain(line('p001'));

    const shown = recommender.recommend({ history, k: 12, excludeSeenLines: false, diversity: 0 });
    expect(shown.map((r) => line(r.productId))).toContain(line('p001'));
  });

  test('components add up to the score', () => {
    const [first] = recommender.recommend({ history: [view('p001')], k: 1 });
    const { collaborative, content } = first.components;
    expect(collaborative + content).toBeCloseTo(first.score, 10);
  });

  test.each(['tailored', 'smart_casual', 'heritage', 'coastal'])(
    'a %s history leads mostly to %s products',
    (style) => {
      const history = firstOfStyle(style, 4).map(view);
      const results = recommender.recommend({ history, k: 8, seasonWeight: 0 });
      const matches = results.filter((r) => styleOf(r.productId) === style).length;
      expect(matches).toBeGreaterThanOrEqual(4);
    },
  );

  test("the season adjustment cannot bury a visitor's taste", () => {
    const history = firstOfStyle('coastal', 4).map(view);
    const results = recommender.recommend({ history, k: 8 });
    const matches = results.filter((r) => styleOf(r.productId) === 'coastal').length;
    expect(matches).toBeGreaterThanOrEqual(2);
  });

  test('recent interactions weigh more than old ones', () => {
    const [tailored, coastal] = [firstOfStyle('tailored', 2), firstOfStyle('coastal', 2)];
    const results = recommender.recommend({
      history: [...tailored, ...coastal].map(view),
      k: 8,
      seasonWeight: 0,
    });
    const count = (style) => results.filter((r) => styleOf(r.productId) === style).length;
    expect(count('coastal')).toBeGreaterThan(count('tailored'));
  });

  test('weights change the ranking and the explanation', () => {
    const history = firstOfStyle('heritage', 2).map(view);
    const onlyContent = recommender.recommend({
      history,
      k: 1,
      weights: { collaborative: 0, content: 1 },
    });
    const onlyCollaborative = recommender.recommend({
      history,
      k: 1,
      weights: { collaborative: 1, content: 0 },
    });
    expect(onlyContent[0].reasons[0].model).toBe('content');
    expect(onlyCollaborative[0].reasons[0].model).toBe('collaborative');
  });

  test('explanations name a product from the history and the attributes it shares', () => {
    const history = firstOfStyle('heritage', 3).map(view);
    const [first] = recommender.recommend({ history, k: 1 });
    const ids = history.map((h) => h.productId);
    const content = first.reasons.find((r) => r.model === 'content');
    expect(ids).toContain(content.productId);
    content.shared.forEach((key) => {
      expect(byId.get(content.productId).attributes[key]).toBe(byId.get(first.productId).attributes[key]);
    });
  });

  test('diversity makes the list less redundant and keeps it relevant', () => {
    const history = firstOfStyle('heritage', 2).map(view);
    const position = new Map(model.productIds.map((id, i) => [id, i]));
    const redundancy = (diversity) => {
      const ids = recommender.recommend({ history, k: 6, diversity }).map((r) => position.get(r.productId));
      const pairs = ids.flatMap((a, i) => ids.slice(i + 1).map((b) => model.content[a][b]));
      return pairs.reduce((sum, value) => sum + value, 0) / pairs.length;
    };
    expect(redundancy(0.6)).toBeLessThan(redundancy(0));

    const diverse = recommender.recommend({ history, k: 6, diversity: 0.6 });
    expect(diverse.filter((r) => styleOf(r.productId) === 'heritage').length).toBeGreaterThanOrEqual(3);
  });
});

describe('item cold start', () => {
  const catalogue = [
    makeProduct('seen', { attributes: { style: 'heritage' } }),
    makeProduct('friend', { attributes: { style: 'heritage' }, category: 'polos' }),
    makeProduct('fresh', { attributes: { style: 'heritage' }, category: 'knitwear' }),
    makeProduct('other', {
      attributes: { style: 'coastal', material: 'linen', season: 'warm', formality: 1, palette: 'rich' },
      category: 'trousers',
      shape: 'trousers',
      color: { id: 'rust' },
    }),
  ];
  const coldEvents = [];
  for (let i = 0; i < 80; i += 1) {
    coldEvents.push(makeEvent(`v${i}`, 'seen'), makeEvent(`v${i}`, 'friend'), makeEvent(`v${i}`, 'other'));
  }
  const cold = createRecommender(buildModel({ products: catalogue, events: coldEvents }), catalogue);

  test('a product with no interactions is still recommended, through content', () => {
    const results = cold.recommend({ history: [view('seen')], k: 3 });
    const fresh = results.find((r) => r.productId === 'fresh');
    expect(fresh).toBeDefined();
    expect(fresh.reasons[0].model).toBe('content');
  });

  test('with a new product as the only seed, the blend relies on content', () => {
    const results = cold.recommend({ history: [view('fresh')], k: 3 });
    expect(results[0].reasons[0].model).toBe('content');
  });
});

describe('completeTheLook', () => {
  const look = recommender.completeTheLook({ productId: 'p001', k: 4 });

  test('returns pieces from other categories only', () => {
    expect(look).toHaveLength(4);
    look.forEach((r) => expect(byId.get(r.productId).category).not.toBe(byId.get('p001').category));
  });

  test('shows at most two pieces per category and one colour per line', () => {
    const categories = look.map((r) => byId.get(r.productId).category);
    categories.forEach((c) => expect(categories.filter((x) => x === c).length).toBeLessThanOrEqual(2));
    const lines = look.map((r) => byId.get(r.productId).lineId);
    expect(new Set(lines).size).toBe(lines.length);
  });

  test('prefers the same style as the product', () => {
    const matching = look.filter((r) => styleOf(r.productId) === styleOf('p001')).length;
    expect(matching).toBeGreaterThanOrEqual(2);
  });

  test('skips excluded products and unknown ids', () => {
    const skip = look[0].productId;
    const next = recommender.completeTheLook({ productId: 'p001', k: 4, exclude: [skip] });
    expect(next.map((r) => r.productId)).not.toContain(skip);
    expect(recommender.completeTheLook({ productId: 'ghost' })).toEqual([]);
  });

  test('explains itself with the source product and shared attributes', () => {
    expect(look[0].reasons[0]).toMatchObject({ model: 'complement', productId: 'p001' });
  });
});
