const request = require('supertest');

const products = require('../data/products.json');
const published = require('../data/model.json');
const { buildPublishedModel } = require('../scripts/build-model');
const { createApp } = require('../server/app');
const { createRateLimiter } = require('../server/middleware/rateLimit');
const { DEFAULT_WEIGHTS } = require('../server/recommender/config');

const app = createApp();
const view = (productId) => ({ productId, type: 'view_product' });
const post = (body) => request(app).post('/api/recommendations').send(body);

describe('published model', () => {
  test('data/model.json matches the build script', () => {
    expect(published).toEqual(buildPublishedModel());
  });
});

describe('catalogue routes', () => {
  test('GET /api/products returns the whole catalogue', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(products.length);
  });

  test('GET /api/products/:slug finds a product or returns 404', async () => {
    expect((await request(app).get(`/api/products/${products[0].slug}`)).body.id).toBe(products[0].id);
    expect((await request(app).get('/api/products/nope')).status).toBe(404);
  });

  test('GET /api/settings and /api/evaluation describe the live model', async () => {
    const settings = await request(app).get('/api/settings');
    expect(settings.body.weights).toEqual(DEFAULT_WEIGHTS);
    const evaluation = await request(app).get('/api/evaluation');
    expect(evaluation.body.results.hybrid).toBeDefined();
  });
});

describe('POST /api/recommendations', () => {
  test('returns best sellers for an empty request', async () => {
    const res = await post({});
    expect(res.status).toBe(200);
    expect(res.body.strategy).toBe('popular');
    expect(res.body.items).toHaveLength(4);
    expect(res.body.items[0].reasons[0].model).toBe('popularity');
  });

  test('personalises from a history and explains the result', async () => {
    const res = await post({ history: [view('p001'), view('p010')], k: 6 });
    expect(res.status).toBe(200);
    expect(res.body.strategy).toBe('personalised');
    expect(res.body.items).toHaveLength(6);
    const [first] = res.body.items;
    expect(first).toEqual({
      productId: expect.any(String),
      score: expect.any(Number),
      components: {
        collaborative: expect.any(Number),
        content: expect.any(Number),
      },
      reasons: expect.any(Array),
    });
    expect(['p001', 'p010']).toContain(first.reasons[0].productId);
  });

  test('uses the product on screen and never returns it', async () => {
    const res = await post({ contextProductId: 'p001', k: 12 });
    expect(res.body.strategy).toBe('personalised');
    expect(res.body.items.map((i) => i.productId)).not.toContain('p001');
  });

  test('weights and diversity change the result', async () => {
    const history = [view('p001'), view('p040')];
    const base = await post({ history, k: 6, weights: { collaborative: 1, content: 0 } });
    const other = await post({ history, k: 6, weights: { collaborative: 0, content: 1 } });
    expect(base.body.items.map((i) => i.productId)).not.toEqual(other.body.items.map((i) => i.productId));
  });

  test('tells caches not to keep personal requests', async () => {
    expect((await post({})).headers['cache-control']).toBe('no-store');
  });

  test.each([
    ['a non-object body', []],
    ['an unknown field', { visitorId: 'abc' }],
    ['a history that is not a list', { history: 'p001' }],
    ['an unknown product', { history: [view('ghost')] }],
    ['an unknown event type', { history: [{ productId: 'p001', type: 'hack' }] }],
    ['an extra history field', { history: [{ ...view('p001'), email: 'a@b.c' }] }],
    ['an inherited property as type', { history: [{ productId: 'p001', type: 'constructor' }] }],
    ['too long a history', { history: new Array(51).fill(view('p001')) }],
    ['an unknown context', { contextProductId: 'ghost' }],
    ['k of 0', { k: 0 }],
    ['k above the limit', { k: 13 }],
    ['a fractional k', { k: 1.5 }],
    ['partial weights', { weights: { collaborative: 1 } }],
    ['an unknown weight', { weights: { collaborative: 1, content: 0, popularity: 1 } }],
    ['negative weights', { weights: { collaborative: -1, content: 1 } }],
    ['all-zero weights', { weights: { collaborative: 0, content: 0 } }],
    ['diversity above 1', { diversity: 2 }],
  ])('rejects %s', async (_, body) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test('rejects malformed JSON and oversized bodies', async () => {
    const malformed = await request(app)
      .post('/api/recommendations')
      .set('Content-Type', 'application/json')
      .send('{"broken"');
    expect(malformed.status).toBe(400);
    const huge = await post({ history: 'x'.repeat(40_000) });
    expect(huge.status).toBe(413);
  });
});

describe('GET /api/look/:productId', () => {
  test('returns explained complements from other categories', async () => {
    const res = await request(app).get('/api/look/p001');
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(4);
    expect(res.body.items[0].reasons[0]).toMatchObject({ model: 'complement', productId: 'p001' });
  });

  test('rejects unknown products and invalid sizes', async () => {
    expect((await request(app).get('/api/look/ghost')).status).toBe(404);
    expect((await request(app).get('/api/look/p001?k=99')).status).toBe(400);
  });
});

describe('protection', () => {
  test('rate limiting returns 429 with Retry-After and spares the catalogue', async () => {
    const limited = createApp({ rateLimit: createRateLimiter({ max: 1 }) });
    const send = () => request(limited).post('/api/recommendations').send({});
    expect((await send()).status).toBe(200);
    const blocked = await send();
    expect(blocked.status).toBe(429);
    expect(blocked.headers['retry-after']).toBeDefined();
    expect((await request(limited).get('/api/products')).status).toBe(200);
  });

  test('sends security headers and hides the framework', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
