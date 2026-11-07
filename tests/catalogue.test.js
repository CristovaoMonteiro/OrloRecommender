const products = require('../data/products.json');
const { buildCatalogue } = require('../scripts/build-catalogue');

describe('catalogue', () => {
  test('data/products.json matches the build script', () => {
    expect(products).toEqual(buildCatalogue());
  });

  test('has 120 products with unique ids and slugs', () => {
    expect(products).toHaveLength(120);
    expect(new Set(products.map((p) => p.id)).size).toBe(120);
    expect(new Set(products.map((p) => p.slug)).size).toBe(120);
  });

  test('every category has at least 18 products', () => {
    const counts = {};
    products.forEach((p) => {
      counts[p.category] = (counts[p.category] ?? 0) + 1;
    });
    expect(Object.keys(counts)).toHaveLength(6);
    Object.values(counts).forEach((count) => expect(count).toBeGreaterThanOrEqual(18));
  });

  test('every product is complete in both languages', () => {
    products.forEach((p) => {
      ['en', 'pt'].forEach((lang) => {
        expect(p.name[lang]).toBeTruthy();
        expect(p.description[lang]).toBeTruthy();
        expect(p.color.name[lang]).toBeTruthy();
        expect(p.details[lang].length).toBeGreaterThan(0);
      });
    });
  });

  test('sale prices are below the original price', () => {
    const onSale = products.filter((p) => p.compareAtPrice != null);
    expect(onSale).toHaveLength(20);
    onSale.forEach((p) => expect(p.price).toBeLessThan(p.compareAtPrice));
  });

  test('contains recent releases for the cold start', () => {
    const recent = products.filter((p) => p.releasedAt >= '2026-09-01');
    expect(recent).toHaveLength(12);
  });
});
