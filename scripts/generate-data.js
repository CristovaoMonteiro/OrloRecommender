/** Writes the synthetic events to data/generated/events.json and prints a summary. */
const fs = require('fs');
const path = require('path');

const products = require('../data/products.json');
const { generateInteractions } = require('./data/generate');

const OUTPUT_DIR = path.join(__dirname, '..', 'data', 'generated');

function summarise({ visitors, events }) {
  const byType = {};
  const byProduct = {};
  events.forEach(({ type, properties }) => {
    byType[type] = (byType[type] ?? 0) + 1;
    byProduct[properties.productId] = (byProduct[properties.productId] ?? 0) + 1;
  });
  const counts = Object.values(byProduct).sort((a, b) => b - a);
  const top20 = counts.slice(0, Math.ceil(products.length * 0.2)).reduce((sum, n) => sum + n, 0);
  return {
    visitors: visitors.length,
    events: events.length,
    ...byType,
    productsWithEvents: counts.length,
    top20PercentShare: Number((top20 / events.length).toFixed(3)),
  };
}

if (require.main === module) {
  const dataset = generateInteractions({ products });
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT_DIR, 'events.json'), JSON.stringify(dataset.events));
  console.table(summarise(dataset));
}

module.exports = { summarise };
