/**
 * Turns the catalogue and a set of events into a plain, JSON-ready model.
 * It only ever sees the events it is given, so evaluation can train on the
 * past alone by passing the output of temporalSplit.
 */
const { EVENT_WEIGHTS } = require('./config');
const { buildContentSimilarity } = require('./content');
const { buildCollaborativeSimilarity } = require('./collaborative');
const { buildComplements } = require('./complements');

/** Weighted event counts per item, scaled so the most popular item is 1. */
function buildPopularity(events, index) {
  const scores = new Array(index.size).fill(0);
  events.forEach(({ type, properties }) => {
    const item = index.get(properties.productId);
    if (item !== undefined) scores[item] += EVENT_WEIGHTS[type];
  });
  const top = Math.max(...scores, 1);
  return scores.map((score) => score / top);
}

function buildModel({ products, events }) {
  const index = new Map(products.map((p, i) => [p.id, i]));
  const content = buildContentSimilarity(products);
  const { similarity: collaborative, visitors } = buildCollaborativeSimilarity(events, index);
  return {
    productIds: products.map((p) => p.id),
    content,
    collaborative,
    complements: buildComplements(events, products, index, content),
    popularity: buildPopularity(events, index),
    visitors,
  };
}

module.exports = { buildModel };
