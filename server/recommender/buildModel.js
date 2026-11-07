/**
 * Turns the catalogue and a set of events into a plain, JSON-ready model.
 * It only ever sees the events it is given, so evaluation can train on the
 * past alone by passing the output of temporalSplit.
 */
const { EVENT_WEIGHTS, RECENT_DAYS } = require('./config');
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

/**
 * How demand for each season group moved lately: its share of the last days
 * divided by its share of the whole period. Above 1 means rising.
 */
function buildSeasonTrend(events, products) {
  const seasonOf = new Map(products.map((p) => [p.id, p.attributes.season]));
  const seasons = [...new Set(seasonOf.values())];
  const neutral = Object.fromEntries(seasons.map((season) => [season, 1]));
  if (events.length === 0) return neutral;

  const last = Math.max(...events.map((e) => Date.parse(e.timestamp)));
  const cutoff = last - RECENT_DAYS * 24 * 60 * 60 * 1000;
  const totals = Object.fromEntries(seasons.map((season) => [season, 0]));
  const recent = { ...totals };
  let allCount = 0;
  let recentCount = 0;
  events.forEach(({ timestamp, properties }) => {
    const season = seasonOf.get(properties.productId);
    if (season === undefined) return;
    totals[season] += 1;
    allCount += 1;
    if (Date.parse(timestamp) >= cutoff) {
      recent[season] += 1;
      recentCount += 1;
    }
  });
  if (recentCount === 0) return neutral;
  return Object.fromEntries(
    seasons.map((season) => {
      const overall = totals[season] / allCount;
      return [season, overall > 0 ? recent[season] / recentCount / overall : 1];
    }),
  );
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
    seasonTrend: buildSeasonTrend(events, products),
  };
}

module.exports = { buildModel, buildSeasonTrend, buildPopularity };
