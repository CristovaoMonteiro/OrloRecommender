/**
 * Splits events at one instant for every visitor. A per-visitor "last item"
 * split would let the model train on other people's future behaviour.
 * @param {{ timestamp: string }[]} events
 * @param {string} cutoff ISO date: events before it train, the rest test
 */
function temporalSplit(events, cutoff) {
  const train = [];
  const test = [];
  events.forEach((event) => (event.timestamp < cutoff ? train : test).push(event));
  return { train, test };
}

module.exports = { temporalSplit };
