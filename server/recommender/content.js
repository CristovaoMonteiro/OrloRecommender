/**
 * Content model: TF-IDF over product attributes and English descriptions.
 * It needs no interactions, so it also covers products nobody has seen yet.
 */
const { ATTRIBUTE_WEIGHTS } = require('./config');

const STOP_WORDS = new Set(
  'a an and any at by for from in into near no of on or that the to with without'.split(' '),
);

/** Lowercase word tokens of a description, minus stop words. */
function tokenize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));
}

/** Term frequencies of one product: prefixed attribute tokens plus description words. */
function productTerms(product) {
  const { style, material, season, formality, palette } = product.attributes;
  const terms = new Map();
  const add = (term, weight = 1) => terms.set(term, (terms.get(term) ?? 0) + weight);

  add(`style:${style}`, ATTRIBUTE_WEIGHTS.style);
  add(`material:${material}`, ATTRIBUTE_WEIGHTS.material);
  add(`category:${product.category}`, ATTRIBUTE_WEIGHTS.category);
  add(`shape:${product.shape}`, ATTRIBUTE_WEIGHTS.shape);
  add(`season:${season}`, ATTRIBUTE_WEIGHTS.season);
  add(`palette:${palette}`, ATTRIBUTE_WEIGHTS.palette);
  add(`formality:${formality}`, ATTRIBUTE_WEIGHTS.formality);
  add(`color:${product.color.id}`, ATTRIBUTE_WEIGHTS.color);
  tokenize(product.description.en).forEach((word) => add(word));
  return terms;
}

/**
 * Pairwise cosine similarity of TF-IDF vectors, with smoothed
 * idf = ln((1 + N) / (1 + df)) + 1, as in common text libraries.
 * @param {Map<string, number>[]} documents term frequencies per document
 * @returns {number[][]} symmetric matrix with a zero diagonal
 */
function tfidfSimilarity(documents) {
  const documentFrequency = new Map();
  documents.forEach((terms) => {
    terms.forEach((_, term) => documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1));
  });

  const idf = (term) => Math.log((1 + documents.length) / (1 + documentFrequency.get(term))) + 1;
  const vectors = documents.map((terms) => {
    const vector = new Map();
    terms.forEach((tf, term) => vector.set(term, tf * idf(term)));
    const norm = Math.sqrt([...vector.values()].reduce((sum, v) => sum + v * v, 0));
    vector.forEach((value, term) => vector.set(term, value / norm));
    return vector;
  });

  const matrix = documents.map(() => new Array(documents.length).fill(0));
  for (let i = 0; i < vectors.length; i += 1) {
    for (let j = i + 1; j < vectors.length; j += 1) {
      let dot = 0;
      vectors[i].forEach((value, term) => {
        dot += value * (vectors[j].get(term) ?? 0);
      });
      matrix[i][j] = dot;
      matrix[j][i] = dot;
    }
  }
  return matrix;
}

function buildContentSimilarity(products) {
  return tfidfSimilarity(products.map(productTerms));
}

module.exports = { tokenize, productTerms, tfidfSimilarity, buildContentSimilarity };
