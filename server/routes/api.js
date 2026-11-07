const express = require('express');

const products = require('../../data/products.json');
const model = require('../../data/model.json');
const evaluation = require('../../data/evaluation.json');
const realEvaluation = require('../../data/evaluation-real.json');
const { createRecommender } = require('../recommender/recommend');
const { DEFAULT_WEIGHTS, DEFAULT_DIVERSITY, MARGIN_WEIGHT } = require('../recommender/config');
const { validateRecommendationRequest, LIMITS } = require('../validateRequest');

const productIds = new Set(products.map((p) => p.id));
const recommender = createRecommender(model, products);

const round = (value) => Number(value.toFixed(4));
const roundComponents = (components) =>
  Object.fromEntries(Object.entries(components).map(([key, value]) => [key, round(value)]));

function presentItem({ productId, score, components, reasons, trending }) {
  return {
    productId,
    score: round(score),
    ...(components ? { components: roundComponents(components) } : {}),
    ...(trending ? { trending } : {}),
    reasons: reasons.map(({ share, ...reason }) => ({
      ...reason,
      ...(share === undefined ? {} : { share: round(share) }),
    })),
  };
}

/** @param {{ rateLimit: import('express').RequestHandler }} options */
function createApiRouter({ rateLimit }) {
  const router = express.Router();

  router.get('/products', (req, res) => {
    res.set('Cache-Control', 'public, max-age=300');
    res.json(products);
  });

  router.get('/products/:slug', (req, res) => {
    const product = products.find((p) => p.slug === req.params.slug);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    return res.json(product);
  });

  router.get('/settings', (req, res) => {
    res.json({
      weights: DEFAULT_WEIGHTS,
      diversity: DEFAULT_DIVERSITY,
      marginWeight: MARGIN_WEIGHT,
      maxResults: LIMITS.k,
    });
  });

  router.get('/evaluation', (req, res) => {
    res.set('Cache-Control', 'public, max-age=300');
    res.json({ ...evaluation, real: realEvaluation });
  });

  // POST keeps the visitor's history out of URLs and access logs. Nothing is stored.
  router.post('/recommendations', rateLimit, (req, res) => {
    res.set('Cache-Control', 'no-store');
    const errors = validateRecommendationRequest(req.body, productIds);
    if (errors.length > 0) return res.status(400).json({ error: 'Invalid request', details: errors });

    const { history = [], contextProductId = null, k = 4, weights, diversity, marginWeight } = req.body;
    const items = recommender.recommend({
      history,
      contextProductId,
      k,
      ...(weights ? { weights } : {}),
      ...(diversity === undefined ? {} : { diversity }),
      ...(marginWeight === undefined ? {} : { marginWeight }),
    });
    const strategy = history.length > 0 || contextProductId ? 'personalised' : 'popular';
    return res.json({ strategy, items: items.map(presentItem) });
  });

  router.get('/look/:productId', rateLimit, (req, res) => {
    if (!productIds.has(req.params.productId)) return res.status(404).json({ error: 'Product not found' });
    const k = Number(req.query.k ?? 4);
    if (!Number.isInteger(k) || k < 1 || k > LIMITS.k) {
      return res.status(400).json({ error: `k must be an integer from 1 to ${LIMITS.k}` });
    }
    const items = recommender.completeTheLook({ productId: req.params.productId, k });
    return res.json({ items: items.map(presentItem) });
  });

  return router;
}

module.exports = { createApiRouter };
