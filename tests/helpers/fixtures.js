let eventCounter = 0;

/** A small product with only the fields the recommender reads. */
function makeProduct(id, overrides = {}) {
  const { attributes, ...rest } = overrides;
  return {
    id,
    lineId: id,
    category: 'shirts',
    shape: 'shirt',
    color: { id: 'navy' },
    description: { en: '' },
    attributes: {
      style: 'heritage',
      material: 'cotton',
      season: 'all',
      formality: 3,
      palette: 'neutral',
      ...attributes,
    },
    ...rest,
  };
}

function makeEvent(visitorId, productId, type = 'view_product', overrides = {}) {
  eventCounter += 1;
  return {
    eventId: `e${eventCounter}`,
    visitorId,
    sessionId: `session-${visitorId}`,
    type,
    timestamp: '2026-09-01T10:00:00.000Z',
    properties: { productId },
    ...overrides,
  };
}

module.exports = { makeProduct, makeEvent };
