/**
 * Generates neutral SVG product illustrations: a colour block with a simple
 * line drawing of the garment. No photography, no real brand imagery.
 * All drawings share a 300 x 400 viewBox.
 */

const LONG_SLEEVE =
  'M120 75 Q150 92 180 75 L215 90 L240 255 L216 261 L195 145 L195 325 L105 325 L105 145 L84 261 L60 255 L85 90 Z';
const SHORT_SLEEVE =
  'M120 75 Q150 92 180 75 L215 90 L242 152 L216 165 L195 145 L195 325 L105 325 L105 145 L84 165 L58 152 L85 90 Z';

const buttons = (ys, x = 150) => ys.map((y) => `<circle cx="${x}" cy="${y}" r="2.6"/>`).join('');

const SHAPES = {
  shirt: `
    <path d="${LONG_SLEEVE}"/>
    <path d="M128 76 L150 104 L172 76"/>
    <path d="M150 104 L150 325"/>
    <path d="M218 238 L238 236"/><path d="M82 238 L62 236"/>
    <g class="fill">${buttons([130, 170, 210, 250, 290])}</g>`,
  polo: `
    <path d="${SHORT_SLEEVE}"/>
    <path d="M126 76 L142 100 L150 92 L158 100 L174 76"/>
    <path d="M150 92 L150 140"/>
    <path d="M222 145 L240 137"/><path d="M78 145 L60 137"/>
    <g class="fill">${buttons([110, 128])}</g>`,
  knit: `
    <path d="${LONG_SLEEVE}"/>
    <path d="M124 78 Q150 104 176 78"/>
    <path d="M105 305 L195 305"/><path d="M105 312 L195 312"/>
    <path d="M220 242 L240 238"/><path d="M80 242 L60 238"/>`,
  cardigan: `
    <path d="${LONG_SLEEVE}"/>
    <path d="M124 78 L150 175 L176 78"/>
    <path d="M150 175 L150 325"/>
    <path d="M126 150 Q132 220 126 300"/><path d="M174 150 Q168 220 174 300"/>
    <path d="M105 308 L195 308"/>
    <g class="fill">${buttons([200, 235, 270, 300], 156)}</g>`,
  trousers: `
    <path d="M108 70 L192 70 L204 335 L163 335 L150 150 L137 335 L96 335 Z"/>
    <path d="M108 86 L192 86"/>
    <path d="M150 86 L150 150"/>
    <path d="M115 100 Q125 115 120 130"/><path d="M185 100 Q175 115 180 130"/>
    <path d="M128 86 L130 98"/><path d="M172 86 L170 98"/>`,
  blazer: `
    <path d="${LONG_SLEEVE}"/>
    <path d="M124 78 L138 170 L150 205 L162 170 L176 78"/>
    <path d="M138 170 L126 150"/><path d="M162 170 L174 150"/>
    <path d="M150 205 L150 325"/>
    <path d="M112 265 L138 265"/><path d="M162 265 L188 265"/>
    <path d="M166 120 L186 118"/>
    <g class="fill">${buttons([225, 255], 156)}</g>`,
  jacket: `
    <path d="${LONG_SLEEVE}"/>
    <path d="M118 80 L132 108 L150 96 L168 108 L182 80"/>
    <path d="M150 96 L150 325"/>
    <rect x="112" y="150" width="28" height="30" rx="2"/><rect x="160" y="150" width="28" height="30" rx="2"/>
    <rect x="110" y="240" width="32" height="40" rx="2"/><rect x="158" y="240" width="32" height="40" rx="2"/>`,
  belt: `
    <path d="M40 178 L240 178 Q262 178 262 200 Q262 222 240 222 L40 222"/>
    <rect x="138" y="168" width="40" height="64" rx="5"/>
    <path d="M158 168 L158 232"/>
    <g class="fill"><circle cx="90" cy="200" r="3"/><circle cx="70" cy="200" r="3"/><circle cx="110" cy="200" r="3"/></g>`,
  scarf: `
    <path d="M112 62 L188 62 L176 330 L146 330 L150 118 L128 330 L98 330 Z"/>
    <path d="M98 330 L98 352 M106 330 L106 352 M114 330 L114 352 M122 330 L122 352 M128 330 L128 352"/>
    <path d="M146 330 L146 352 M154 330 L154 352 M162 330 L162 352 M170 330 L170 352 M176 330 L176 352"/>
    <path d="M118 62 L112 130"/><path d="M182 62 L170 200"/>`,
};

/** Relative luminance (sRGB) used to choose a readable stroke colour. */
function luminance(hex) {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Mixes a hex colour towards black (amount > 0) or white (amount < 0). */
function shade(hex, amount) {
  const target = amount > 0 ? 0 : 255;
  const a = Math.abs(amount);
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgb(${channels.map((c) => Math.round(c + (target - c) * a)).join(',')})`;
}

// One neutral studio backdrop for every product (matches --color-stone in styles.css).
const BACKDROP = '#ECE8E1';

let svgId = 0;

/**
 * Product illustration: the garment in its own colour on a neutral backdrop.
 * `shadow: true` adds a soft floor shadow (used on the product page only).
 * @param {{ id: string, shape: string, color: { hex: string } }} product
 * @param {{ label?: string, shadow?: boolean }} [options]
 */
export function productSVG(product, { label = '', shadow = false } = {}) {
  const fill = product.color.hex;
  const isDark = luminance(fill) < 0.2;
  // Detail lines: darker than the fabric on light colours, lighter on dark ones.
  const stroke = isDark ? shade(fill, -0.45) : shade(fill, 0.45);
  const shape = SHAPES[product.shape] ?? SHAPES.shirt;
  const filterId = `soft-shadow-${(svgId += 1)}`;

  return `
    <svg class="product-svg" viewBox="0 0 300 400" ${label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"'}
         xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
      ${
        shadow
          ? `<defs><filter id="${filterId}" x="-20%" y="-20%" width="140%" height="150%">
               <feDropShadow dx="0" dy="10" stdDeviation="10" flood-color="#3a3226" flood-opacity="0.16"/>
             </filter></defs>`
          : ''
      }
      <rect width="300" height="400" fill="${BACKDROP}"/>
      <g transform="translate(30 40) scale(0.8)" fill="${fill}" stroke="${stroke}" stroke-width="1.6"
         stroke-linejoin="round" stroke-linecap="round" ${shadow ? `filter="url(#${filterId})"` : ''}>
        ${shape.replace(/class="fill"/g, `fill="${stroke}" stroke="none"`)}
      </g>
    </svg>`;
}

/** Brand monogram: the first letter of the brand name inside a fine ring. */
export function monogramSVG(letter, { size = 64 } = {}) {
  return `
    <svg class="monogram" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true"
         xmlns="http://www.w3.org/2000/svg">
      <circle cx="32" cy="32" r="30" fill="none" stroke="currentColor" stroke-width="1"/>
      <circle cx="32" cy="32" r="26.5" fill="none" stroke="currentColor" stroke-width="0.5"/>
      <text x="32" y="33" text-anchor="middle" dominant-baseline="middle" fill="currentColor"
            font-family="'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif" font-size="28"
            letter-spacing="0">${letter}</text>
    </svg>`;
}
