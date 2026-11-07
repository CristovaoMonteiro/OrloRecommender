/**
 * Deterministic interaction dataset: same seed => same visitors and events.
 *
 * Each visitor has hidden tastes (style, palette, budget). Tastes shape which
 * products get viewed, carted and bought, which is the signal a recommender
 * can learn. They are returned for tests only: the models see events alone.
 *
 * Events use the same field names as the Visitor Journey tracker, limited to
 * the three types that matter here: view_product, add_to_cart and purchase.
 */
const { createRandom } = require('./random');
const { ANCHOR } = require('../build-catalogue');

const DEFAULT_SEED = 20261108;
const DEFAULT_VISITORS = 4000;
const WINDOW_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;
const STYLES = ['tailored', 'smart_casual', 'heritage', 'coastal'];
const PALETTES = ['neutral', 'earth', 'rich'];

// How strongly each hidden factor drives a visitor's choices.
const UTILITY = { style: 3.2, palette: 1.6, budget: 1.4, popularity: 0.7, noise: 0.4 };
// Popularity follows a long tail: rank r gets weight 1 / r^POPULARITY_EXPONENT.
const POPULARITY_EXPONENT = 0.8;
// Add-to-cart probability is a logistic curve of utility, centred on this value.
const CART_MIDPOINT = 12;
const PURCHASE_RATE = 0.55;
const OUTFIT_RATE = 0.6;
const SAME_CATEGORY_RATE = 0.7;

// What is usually worn with each category: this drives "complete the look".
const OUTFIT_PAIRS = {
  shirts: ['trousers', 'knitwear'],
  polos: ['trousers', 'accessories'],
  knitwear: ['trousers', 'shirts'],
  trousers: ['shirts', 'accessories'],
  outerwear: ['knitwear', 'accessories'],
  accessories: ['outerwear', 'trousers'],
};

/** Concentrated random weights that sum to 1: most visitors lean towards one or two options. */
function tasteWeights(rng, keys) {
  const raw = keys.map(() => rng.next() ** 4 + 0.01);
  const total = raw.reduce((sum, w) => sum + w, 0);
  return Object.fromEntries(keys.map((key, i) => [key, raw[i] / total]));
}

function createVisitor(rng) {
  return {
    id: rng.uuid(),
    device: rng.chance(0.62) ? 'mobile' : 'desktop',
    style: tasteWeights(rng, STYLES),
    palette: tasteWeights(rng, PALETTES),
    // Typical spend per item, log-normal around EUR 120.
    budget: Math.exp(Math.log(120) + 0.5 * (rng.next() + rng.next() + rng.next() - 1.5) * 2),
    // Mostly one or two sessions, with a long tail of frequent visitors.
    sessions: 1 + Math.floor(-Math.log(1 - rng.next()) * 2),
  };
}

/** The hidden reward a visitor gets from a product, before random noise. */
function utility(visitor, product, popularity) {
  const { style, palette } = product.attributes;
  return (
    UTILITY.style * visitor.style[style] * STYLES.length +
    UTILITY.palette * visitor.palette[palette] * PALETTES.length -
    UTILITY.budget * Math.abs(Math.log(product.price / visitor.budget)) +
    UTILITY.popularity * Math.log(popularity[product.id])
  );
}

function pickProduct(rng, candidates, visitor, popularity) {
  const weights = candidates.map((p) => Math.exp(utility(visitor, p, popularity)));
  return candidates[rng.weightedIndex(weights)];
}

function generateInteractions({ products, seed = DEFAULT_SEED, visitors: visitorCount = DEFAULT_VISITORS }) {
  const rng = createRandom(seed);
  const start = ANCHOR - WINDOW_DAYS * DAY_MS;

  const popularity = {};
  rng.sample(products, products.length).forEach((product, rank) => {
    popularity[product.id] = 1 / (rank + 1) ** POPULARITY_EXPONENT;
  });

  const visitors = Array.from({ length: visitorCount }, () => createVisitor(rng));
  const events = [];

  visitors.forEach((visitor) => {
    const sessionStarts = Array.from({ length: visitor.sessions }, () => rng.float(start, ANCHOR)).sort(
      (a, b) => a - b,
    );

    sessionStarts.forEach((sessionStart) => {
      const sessionId = rng.uuid();
      let t = sessionStart;
      const emit = (type, product) => {
        t += rng.int(15, 240) * 1000;
        events.push({
          eventId: rng.uuid(),
          visitorId: visitor.id,
          sessionId,
          type,
          timestamp: new Date(t).toISOString(),
          device: visitor.device,
          properties: {
            productId: product.id,
            category: product.category,
            price: product.price,
            onSale: product.compareAtPrice != null,
          },
        });
      };

      const available = products.filter((p) => Date.parse(p.releasedAt) <= sessionStart);
      const browse = (product, cart) => {
        emit('view_product', product);
        const reward = utility(visitor, product, popularity) + UTILITY.noise * (rng.next() - 0.5);
        if (rng.chance(1 / (1 + Math.exp(CART_MIDPOINT - reward)))) {
          emit('add_to_cart', product);
          cart.push(product);
        }
      };

      const anchorProduct = pickProduct(rng, available, visitor, popularity);
      const sameCategory = available.filter((p) => p.category === anchorProduct.category);
      const cart = [];
      browse(anchorProduct, cart);

      const views = rng.int(1, 6);
      for (let i = 0; i < views; i += 1) {
        const pool = rng.chance(SAME_CATEGORY_RATE) ? sameCategory : available;
        browse(pickProduct(rng, pool, visitor, popularity), cart);
      }

      // Buyers often finish the outfit: a piece from a matching category.
      if (cart.length > 0 && rng.chance(OUTFIT_RATE)) {
        const paired = OUTFIT_PAIRS[cart[0].category];
        const style = cart[0].attributes.style;
        const matches = available.filter((p) => paired.includes(p.category) && p.attributes.style === style);
        if (matches.length > 0) {
          const match = pickProduct(rng, matches, visitor, popularity);
          emit('view_product', match);
          emit('add_to_cart', match);
          cart.push(match);
        }
      }

      if (cart.length > 0 && rng.chance(PURCHASE_RATE)) {
        const unique = [...new Map(cart.map((p) => [p.id, p])).values()];
        unique.forEach((product) => emit('purchase', product));
      }
    });
  });

  events.sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.eventId.localeCompare(b.eventId));
  return { visitors, events };
}

module.exports = { generateInteractions, OUTFIT_PAIRS, STYLES, DEFAULT_SEED };
