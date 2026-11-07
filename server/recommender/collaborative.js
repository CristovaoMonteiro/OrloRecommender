/**
 * Collaborative model: item-to-item similarity over implicit feedback.
 * Chosen over matrix factorisation because every score traces back to a
 * product the visitor touched, which is what the explanations need.
 */
const { EVENT_WEIGHTS, COLLABORATIVE_SHRINKAGE } = require('./config');

/** Strongest signal per visitor and product: { visitorId: Map(itemIndex => weight) }. */
function visitorProfiles(events, index) {
  const profiles = new Map();
  events.forEach(({ visitorId, type, properties }) => {
    const item = index.get(properties.productId);
    if (item === undefined) return;
    if (!profiles.has(visitorId)) profiles.set(visitorId, new Map());
    const profile = profiles.get(visitorId);
    profile.set(item, Math.max(profile.get(item) ?? 0, EVENT_WEIGHTS[type]));
  });
  return profiles;
}

/**
 * Shrunken cosine: sim(i, j) = dot(i, j) / (|i| * |j| + shrinkage).
 * @returns {{ similarity: number[][], visitors: number[] }} the symmetric
 *   matrix, plus how many distinct visitors touched each item
 */
function buildCollaborativeSimilarity(events, index, { shrinkage = COLLABORATIVE_SHRINKAGE } = {}) {
  const size = index.size;
  const dots = Array.from({ length: size }, () => new Array(size).fill(0));
  const squaredNorms = new Array(size).fill(0);
  const visitors = new Array(size).fill(0);

  visitorProfiles(events, index).forEach((profile) => {
    const items = [...profile.entries()];
    items.forEach(([i, weightI]) => {
      squaredNorms[i] += weightI * weightI;
      visitors[i] += 1;
      items.forEach(([j, weightJ]) => {
        if (i < j) dots[i][j] += weightI * weightJ;
      });
    });
  });

  const similarity = Array.from({ length: size }, () => new Array(size).fill(0));
  for (let i = 0; i < size; i += 1) {
    for (let j = i + 1; j < size; j += 1) {
      if (dots[i][j] === 0) continue;
      const score = dots[i][j] / (Math.sqrt(squaredNorms[i] * squaredNorms[j]) + shrinkage);
      similarity[i][j] = score;
      similarity[j][i] = score;
    }
  }
  return { similarity, visitors };
}

module.exports = { visitorProfiles, buildCollaborativeSimilarity };
