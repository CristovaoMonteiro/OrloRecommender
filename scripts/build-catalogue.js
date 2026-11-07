/**
 * Expands scripts/data/lines.js into data/products.json.
 * Deterministic: re-running it always writes the same catalogue.
 */
const fs = require('fs');
const path = require('path');

const { createRandom } = require('./data/random');
const { COLOURS, MATERIALS, SIZES, LINES } = require('./data/lines');

const CATALOGUE_SEED = 20261107;
const OUTPUT = path.join(__dirname, '..', 'data', 'products.json');
// The fixed end of the simulated period, shared with the interaction generator.
const ANCHOR = Date.UTC(2026, 8, 30);
const CATALOGUE_START = Date.UTC(2026, 3, 1);
const NEW_ARRIVALS = 12;
const NEW_ARRIVAL_WINDOW_DAYS = 21;
const DAY_MS = 24 * 60 * 60 * 1000;
const SALE_SHARE = 1 / 6;
const SALE_FACTOR = 0.75;
// Fictional gross margin of each garment line at full price.
const MARGIN_RANGE = [0.35, 0.7];

function buildCatalogue() {
  const rng = createRandom(CATALOGUE_SEED);

  const products = LINES.flatMap((line) =>
    line.colours.map((colourId) => {
      const colour = COLOURS[colourId];
      const material = MATERIALS[line.material];
      return {
        slug: `${line.slug}-${colourId}`,
        lineId: line.slug,
        category: line.category,
        shape: line.shape,
        price: line.price,
        compareAtPrice: null,
        color: { id: colourId, hex: colour.hex, name: { en: colour.en, pt: colour.pt } },
        sizes: SIZES[line.sizes],
        name: line.name,
        description: line.description,
        details: { en: [material.en], pt: [material.pt] },
        attributes: {
          style: line.style,
          material: line.material,
          season: line.season,
          formality: line.formality,
          palette: colour.palette,
        },
        releasedAt: new Date(CATALOGUE_START).toISOString(),
      };
    }),
  );

  rng.sample(products, Math.round(products.length * SALE_SHARE)).forEach((product) => {
    product.compareAtPrice = product.price;
    product.price = Math.round(product.price * SALE_FACTOR);
  });

  // Recent releases have few or no interactions: they exercise the item cold start.
  rng.sample(products, NEW_ARRIVALS).forEach((product) => {
    const daysAgo = rng.int(1, NEW_ARRIVAL_WINDOW_DAYS);
    product.releasedAt = new Date(ANCHOR - daysAgo * DAY_MS).toISOString();
  });

  const lineMargin = new Map(LINES.map((line) => [line.slug, rng.float(...MARGIN_RANGE)]));
  products.forEach((product) => {
    const cost = (product.compareAtPrice ?? product.price) * (1 - lineMargin.get(product.lineId));
    product.margin = Number(((product.price - cost) / product.price).toFixed(2));
  });

  return products.map((product, index) => ({ id: `p${String(index + 1).padStart(3, '0')}`, ...product }));
}

if (require.main === module) {
  const products = buildCatalogue();
  fs.writeFileSync(OUTPUT, `${JSON.stringify(products, null, 2)}\n`);
  console.log(`Wrote ${products.length} products to data/products.json`);
}

module.exports = { buildCatalogue, ANCHOR };
