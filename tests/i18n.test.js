const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const source = fs.readFileSync(path.join(PUBLIC_DIR, 'js', 'i18n.js'), 'utf8');
const strings = source.slice(0, source.indexOf('// Catalogue vocabulary'));
const [english, portuguese] = strings.split('\n  pt: {');
const keysOf = (block) => new Set([...block.matchAll(/^\s+'([a-zA-Z0-9.]+)':/gm)].map((match) => match[1]));

function filesIn(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? filesIn(full) : [full];
  });
}

describe('translations', () => {
  const en = keysOf(english);
  const pt = keysOf(portuguese);

  test('both languages have the same keys', () => {
    expect(en.size).toBeGreaterThan(100);
    expect([...en].filter((key) => !pt.has(key))).toEqual([]);
    expect([...pt].filter((key) => !en.has(key))).toEqual([]);
  });

  test('every key used by the pages exists', () => {
    const used = filesIn(PUBLIC_DIR)
      .filter((file) => /\.(js|html)$/.test(file) && !file.endsWith('i18n.js'))
      .flatMap((file) => {
        const text = fs.readFileSync(file, 'utf8');
        return [...text.matchAll(/(?:\bt\(|data-i18n=|titleKey: )['"]([a-zA-Z0-9.]+)['"]/g)].map((m) => m[1]);
      });
    expect(used.length).toBeGreaterThan(50);
    expect([...new Set(used)].filter((key) => !en.has(key))).toEqual([]);
  });
});
