/**
 * Evaluation tasks. Each case mirrors the live page: a visitor opens a product,
 * and the list should contain what they go on to look at in that session.
 */

/** Sessions of one visitor in chronological order. */
function sessionsByVisitor(events) {
  const visitors = new Map();
  events.forEach((event) => {
    if (!visitors.has(event.visitorId)) visitors.set(event.visitorId, new Map());
    const sessions = visitors.get(event.visitorId);
    if (!sessions.has(event.sessionId)) sessions.set(event.sessionId, []);
    sessions.get(event.sessionId).push(event);
  });
  return visitors;
}

const toHistoryEntry = ({ type, properties }) => ({ productId: properties.productId, type });

/**
 * Builds one case per session that starts inside [from, to).
 * The history is everything before the session, plus the opening product; the
 * targets are the other products of that session the visitor had not seen yet.
 * With `lineOf`, other colours of seen products are not targets either, because the
 * store never suggests them. `allTargets` keeps them, to report what that choice changes.
 * @param {object[]} events chronological events
 * @returns {{ visitorId: string, history: object[], contextProductId: string,
 *   targets: Set<string>, allTargets: Set<string>, priorProducts: number }[]}
 */
function buildCases(events, { from, to, lineOf }) {
  const cases = [];
  sessionsByVisitor(events).forEach((sessions, visitorId) => {
    const prior = [];
    sessions.forEach((session) => {
      const [first] = session;
      if (first.timestamp >= from && first.timestamp < to) {
        const seen = new Set(prior.map((entry) => entry.productId));
        const contextProductId = first.properties.productId;
        const allTargets = new Set(
          session
            .map((event) => event.properties.productId)
            .filter((id) => id !== contextProductId && !seen.has(id)),
        );
        const seenLines = new Set(lineOf ? [...seen, contextProductId].map(lineOf) : []);
        const targets = new Set([...allTargets].filter((id) => !lineOf || !seenLines.has(lineOf(id))));
        if (targets.size > 0) {
          cases.push({
            visitorId,
            history: [...prior, toHistoryEntry(first)],
            contextProductId,
            targets,
            allTargets,
            priorProducts: seen.size,
          });
        }
      }
      prior.push(...session.map(toHistoryEntry));
    });
  });
  return cases;
}

/**
 * Builds one "complete the look" case per basket in [from, to) that spans
 * categories: from the first carted product, predict the rest of the basket.
 */
function buildLookCases(events, products, { from, to }) {
  const categoryOf = new Map(products.map((p) => [p.id, p.category]));
  const baskets = new Map();
  events.forEach(({ sessionId, visitorId, type, timestamp, properties }) => {
    if (type !== 'add_to_cart' || timestamp < from || timestamp >= to) return;
    if (!baskets.has(sessionId)) baskets.set(sessionId, { visitorId, items: [] });
    baskets.get(sessionId).items.push(properties.productId);
  });

  const cases = [];
  baskets.forEach(({ visitorId, items }) => {
    const [productId, ...rest] = items;
    const targets = new Set(rest.filter((id) => categoryOf.get(id) !== categoryOf.get(productId)));
    if (targets.size > 0) cases.push({ visitorId, productId, targets });
  });
  return cases;
}

module.exports = { buildCases, buildLookCases };
