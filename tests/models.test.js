const { tokenize, tfidfSimilarity, buildContentSimilarity } = require('../server/recommender/content');
const { buildCollaborativeSimilarity } = require('../server/recommender/collaborative');
const { buildBaskets, shrunkLift, buildComplements } = require('../server/recommender/complements');
const { buildModel } = require('../server/recommender/buildModel');
const { temporalSplit } = require('../server/recommender/split');
const { makeProduct, makeEvent } = require('./helpers/fixtures');

const indexOf = (ids) => new Map(ids.map((id, i) => [id, i]));

describe('content model', () => {
  test('tokenize lowercases, strips accents and drops stop words', () => {
    expect(tokenize('A Piqué polo, with a clean placket')).toEqual(['pique', 'polo', 'clean', 'placket']);
  });

  test('TF-IDF cosine matches a value computed by hand', () => {
    // idf(x) = ln(3/3) + 1 = 1 and idf(y) = idf(z) = ln(3/2) + 1 = 1.40547.
    // cos = 1 / (1 + 1.40547^2) = 0.33609.
    const documents = [
      new Map([
        ['x', 1],
        ['y', 1],
      ]),
      new Map([
        ['x', 1],
        ['z', 1],
      ]),
    ];
    const matrix = tfidfSimilarity(documents);
    expect(matrix[0][1]).toBeCloseTo(0.33609, 4);
    expect(matrix[1][0]).toBe(matrix[0][1]);
    expect(matrix[0][0]).toBe(0);
  });

  test('products with no terms in common score 0', () => {
    const matrix = tfidfSimilarity([new Map([['x', 1]]), new Map([['y', 1]])]);
    expect(matrix[0][1]).toBe(0);
  });

  test('sharing a style counts for more than sharing a colour', () => {
    const base = makeProduct('a', { attributes: { style: 'heritage' }, color: { id: 'navy' } });
    const sameStyle = makeProduct('b', {
      attributes: { style: 'heritage', material: 'wool', season: 'cold', formality: 1, palette: 'rich' },
      category: 'knitwear',
      shape: 'knit',
      color: { id: 'rust' },
    });
    const sameColour = makeProduct('c', {
      attributes: { style: 'coastal', material: 'linen', season: 'warm', formality: 5, palette: 'earth' },
      category: 'polos',
      shape: 'polo',
      color: { id: 'navy' },
    });
    const matrix = buildContentSimilarity([base, sameStyle, sameColour]);
    expect(matrix[0][1]).toBeGreaterThan(matrix[0][2]);
  });
});

describe('collaborative model', () => {
  // Item vectors over visitors v1, v2, v3: a = (1, 1, 0), b = (1, 1, 0), c = (0, 5, 5).
  const events = [
    makeEvent('v1', 'a'),
    makeEvent('v1', 'b'),
    makeEvent('v2', 'a'),
    makeEvent('v2', 'b'),
    makeEvent('v2', 'c', 'purchase'),
    makeEvent('v3', 'c', 'purchase'),
  ];
  const index = indexOf(['a', 'b', 'c']);

  test('shrunken cosine matches values computed by hand', () => {
    const { similarity } = buildCollaborativeSimilarity(events, index, { shrinkage: 2 });
    // a, b: dot 2, norms sqrt(2) each: 2 / (2 + 2) = 0.5
    expect(similarity[0][1]).toBeCloseTo(0.5, 10);
    // a, c: dot 5, norms sqrt(2) and sqrt(50): 5 / (10 + 2) = 0.41667
    expect(similarity[0][2]).toBeCloseTo(5 / 12, 10);
  });

  test('without shrinkage, identical vectors have similarity 1', () => {
    const { similarity } = buildCollaborativeSimilarity(events, index, { shrinkage: 0 });
    expect(similarity[0][1]).toBeCloseTo(1, 10);
  });

  test('shrinkage penalises pairs backed by few visitors the most', () => {
    const many = [];
    for (let i = 0; i < 50; i += 1) many.push(makeEvent(`m${i}`, 'a'), makeEvent(`m${i}`, 'b'));
    const few = [makeEvent('f1', 'c'), makeEvent('f1', 'd')];
    const items = indexOf(['a', 'b', 'c', 'd']);
    const raw = buildCollaborativeSimilarity([...many, ...few], items, { shrinkage: 0 }).similarity;
    const shrunk = buildCollaborativeSimilarity([...many, ...few], items, { shrinkage: 10 }).similarity;
    // Both pairs are perfectly similar, but only one is backed by real evidence.
    expect(raw[0][1]).toBeCloseTo(raw[2][3], 10);
    expect(shrunk[0][1]).toBeCloseTo(50 / 60, 10);
    expect(shrunk[2][3]).toBeCloseTo(1 / 11, 10);
  });

  test('a stronger event replaces a weaker one for the same product', () => {
    const mixed = [makeEvent('v1', 'a'), makeEvent('v1', 'a', 'purchase'), makeEvent('v1', 'b', 'purchase')];
    const { similarity, visitors } = buildCollaborativeSimilarity(mixed, indexOf(['a', 'b']), {
      shrinkage: 0,
    });
    expect(similarity[0][1]).toBeCloseTo(1, 10);
    expect(visitors).toEqual([1, 1]);
  });

  test('events for unknown products are ignored', () => {
    const { visitors } = buildCollaborativeSimilarity([makeEvent('v1', 'ghost')], indexOf(['a']));
    expect(visitors).toEqual([0]);
  });
});

describe('complements model', () => {
  test('shrunk lift matches a value computed by hand', () => {
    // Expected together = 10 * 10 / 100 = 1, so (4 + 5) / (1 + 5) = 1.5.
    expect(shrunkLift(4, 10, 10, 100, 5)).toBeCloseTo(1.5, 10);
  });

  test('shrunk lift of a pair seen at the expected rate is 1', () => {
    expect(shrunkLift(1, 10, 10, 100, 5)).toBeCloseTo(1, 10);
  });

  test('baskets group carted products by session and skip views', () => {
    const baskets = buildBaskets(
      [makeEvent('v1', 'a', 'add_to_cart'), makeEvent('v1', 'b', 'add_to_cart'), makeEvent('v2', 'a')],
      indexOf(['a', 'b']),
    );
    expect(baskets).toEqual([new Set([0, 1])]);
  });

  test('products bought together rank above those that are not; same category scores 0', () => {
    const products = [
      makeProduct('shirt', { category: 'shirts' }),
      makeProduct('shirt2', { category: 'shirts' }),
      makeProduct('jeans', { category: 'trousers' }),
      makeProduct('belt', { category: 'accessories' }),
    ];
    const index = indexOf(products.map((p) => p.id));
    const events = [];
    for (let i = 0; i < 12; i += 1) {
      events.push(makeEvent(`v${i}`, 'shirt', 'add_to_cart'), makeEvent(`v${i}`, 'jeans', 'add_to_cart'));
      events.push(makeEvent(`w${i}`, 'belt', 'add_to_cart'));
    }
    const content = products.map(() => products.map(() => 0));
    const matrix = buildComplements(events, products, index, content);
    expect(matrix[0][2]).toBeGreaterThan(matrix[0][3]);
    expect(matrix[0][1]).toBe(0);
    expect(matrix[0][2]).toBeCloseTo(matrix[2][0], 10);
  });
});

describe('buildModel', () => {
  const products = [makeProduct('a'), makeProduct('b'), makeProduct('c')];

  test('produces a JSON-safe model with matrices the size of the catalogue', () => {
    const model = buildModel({ products, events: [makeEvent('v1', 'a'), makeEvent('v1', 'b')] });
    expect(JSON.parse(JSON.stringify(model))).toEqual(model);
    ['content', 'collaborative', 'complements'].forEach((key) => {
      expect(model[key]).toHaveLength(3);
      model[key].forEach((row) => expect(row).toHaveLength(3));
    });
  });

  test('popularity is scaled to the most popular product', () => {
    const model = buildModel({
      products,
      events: [makeEvent('v1', 'a', 'purchase'), makeEvent('v1', 'b')],
    });
    expect(model.popularity).toEqual([1, 0.2, 0]);
  });

  test('works with no events at all', () => {
    const model = buildModel({ products, events: [] });
    expect(model.popularity).toEqual([0, 0, 0]);
    expect(model.visitors).toEqual([0, 0, 0]);
  });
});

describe('temporalSplit', () => {
  const at = (timestamp) => makeEvent('v1', 'a', 'view_product', { timestamp });

  test('sends events before the cutoff to train and the rest to test', () => {
    const before = at('2026-09-14T23:59:59.000Z');
    const exact = at('2026-09-15T00:00:00.000Z');
    const after = at('2026-09-20T00:00:00.000Z');
    const { train, test: held } = temporalSplit([after, before, exact], '2026-09-15T00:00:00.000Z');
    expect(train).toEqual([before]);
    expect(held).toEqual([after, exact]);
  });

  test('a model trained on the split knows nothing about the held-out period', () => {
    const products = [makeProduct('a'), makeProduct('b')];
    const events = [
      makeEvent('v1', 'a', 'view_product', { timestamp: '2026-09-01T00:00:00.000Z' }),
      makeEvent('v1', 'b', 'purchase', { timestamp: '2026-09-20T00:00:00.000Z' }),
    ];
    const { train } = temporalSplit(events, '2026-09-15T00:00:00.000Z');
    const model = buildModel({ products, events: train });
    expect(model.visitors).toEqual([1, 0]);
    expect(model.collaborative[0][1]).toBe(0);
  });
});
