/** Validates the body of POST /api/recommendations. Unknown fields are rejected. */
const { DEFAULT_WEIGHTS, EVENT_WEIGHTS } = require('./recommender/config');

const LIMITS = { history: 50, k: 12 };
const ALLOWED_FIELDS = ['history', 'contextProductId', 'k', 'weights', 'diversity'];
const WEIGHT_KEYS = Object.keys(DEFAULT_WEIGHTS);

const isRatio = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * @param {unknown} body
 * @param {Set<string>} productIds known catalogue ids
 * @returns {string[]} error messages; empty when the body is valid
 */
function validateRecommendationRequest(body, productIds) {
  if (!isPlainObject(body)) return ['Body must be a JSON object'];

  const errors = [];
  Object.keys(body)
    .filter((key) => !ALLOWED_FIELDS.includes(key))
    .forEach((key) => errors.push(`Unknown field: ${key}`));

  const { history, contextProductId, k, weights, diversity } = body;

  if (history !== undefined) {
    if (!Array.isArray(history)) {
      errors.push('history must be an array');
    } else if (history.length > LIMITS.history) {
      errors.push(`history holds at most ${LIMITS.history} entries`);
    } else {
      const valid = history.every(
        (entry) =>
          isPlainObject(entry) &&
          productIds.has(entry.productId) &&
          Object.hasOwn(EVENT_WEIGHTS, entry.type) &&
          Object.keys(entry).length === 2,
      );
      if (!valid) errors.push('history entries need a known productId and a valid type');
    }
  }

  if (contextProductId !== undefined && contextProductId !== null && !productIds.has(contextProductId)) {
    errors.push('Unknown contextProductId');
  }
  if (k !== undefined && !(Number.isInteger(k) && k >= 1 && k <= LIMITS.k)) {
    errors.push(`k must be an integer from 1 to ${LIMITS.k}`);
  }
  if (diversity !== undefined && !isRatio(diversity)) errors.push('diversity must be from 0 to 1');

  if (weights !== undefined) {
    const complete =
      isPlainObject(weights) &&
      Object.keys(weights).length === WEIGHT_KEYS.length &&
      WEIGHT_KEYS.every((key) => isRatio(weights[key]));
    if (!complete) errors.push(`weights need ${WEIGHT_KEYS.join(', ')}, each from 0 to 1`);
    else if (WEIGHT_KEYS.every((key) => weights[key] === 0))
      errors.push('At least one weight must be above 0');
  }
  return errors;
}

module.exports = { validateRecommendationRequest, LIMITS };
