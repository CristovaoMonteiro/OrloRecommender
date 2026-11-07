/**
 * Trains the production model on the whole demo dataset and writes
 * data/model.json. The server only reads that file, so it needs no database
 * and no event data at runtime.
 */
const fs = require('fs');
const path = require('path');

const products = require('../data/products.json');
const { generateInteractions } = require('./data/generate');
const { buildModel } = require('../server/recommender/buildModel');

const OUTPUT = path.join(__dirname, '..', 'data', 'model.json');
const DECIMALS = 5;

const round = (value) => Number(value.toFixed(DECIMALS));
const roundMatrix = (matrix) => matrix.map((row) => row.map(round));

function buildPublishedModel() {
  const model = buildModel({ products, events: generateInteractions({ products }).events });
  return {
    ...model,
    content: roundMatrix(model.content),
    collaborative: roundMatrix(model.collaborative),
    complements: roundMatrix(model.complements),
    popularity: model.popularity.map(round),
  };
}

if (require.main === module) {
  const model = buildPublishedModel();
  fs.writeFileSync(OUTPUT, JSON.stringify(model));
  console.log(`Wrote data/model.json (${(fs.statSync(OUTPUT).size / 1e6).toFixed(2)} MB)`);
}

module.exports = { buildPublishedModel };
