/**
 * Seeded pseudo-random generator (mulberry32) plus small helpers.
 * Every random decision goes through one instance, so the same seed always
 * produces exactly the same dataset.
 */
function createRandom(seed) {
  let state = seed >>> 0;

  /** Uniform float in [0, 1). */
  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  const rng = {
    next,
    /** Integer in [min, max], both inclusive. */
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    float: (min, max) => min + next() * (max - min),
    chance: (p) => next() < p,
    pick: (list) => list[Math.floor(next() * list.length)],
    /** Picks one index of `weights` proportionally to its weight. */
    weightedIndex(weights) {
      const total = weights.reduce((sum, w) => sum + w, 0);
      let roll = next() * total;
      for (let i = 0; i < weights.length; i += 1) {
        roll -= weights[i];
        if (roll < 0) return i;
      }
      return weights.length - 1;
    },
    /** `count` distinct items from `list`, in random order. */
    sample(list, count) {
      const copy = [...list];
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(next() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy.slice(0, Math.min(count, copy.length));
    },
    /** RFC 4122 v4-shaped UUID built from the seeded stream. */
    uuid() {
      const hex = Array.from({ length: 32 }, () => Math.floor(next() * 16).toString(16));
      hex[12] = '4';
      hex[16] = ['8', '9', 'a', 'b'][Math.floor(next() * 4)];
      const h = hex.join('');
      return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
    },
  };
  return rng;
}

module.exports = { createRandom };
