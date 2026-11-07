import { productSVG } from './placeholder.js';
import { t, localized, formatPrice, formatPercent, joinList } from './i18n.js';
import { getHistory, clearHistory } from './history.js';

const NEW_SINCE = '2026-09-01';

export const productName = (product) => localized(product.name);
const productUrl = (product) => `/product?slug=${product.slug}`;

export function priceHTML(product) {
  if (product.compareAtPrice == null) return formatPrice(product.price);
  return `<span class="price--sale">${formatPrice(product.price)}</span>
    <s class="price--was">${formatPrice(product.compareAtPrice)}</s>`;
}

function badgeHTML(product) {
  if (product.compareAtPrice != null) return `<span class="badge">${t('product.sale')}</span>`;
  if (product.releasedAt >= NEW_SINCE) return `<span class="badge badge--new">${t('product.new')}</span>`;
  return '';
}

export function productCardHTML(product, { footer = '' } = {}) {
  const name = productName(product);
  return `
    <article class="product-card">
      <a href="${productUrl(product)}" class="product-card__link">
        <div class="product-card__media">${productSVG(product, { label: name })}${badgeHTML(product)}</div>
        <h3 class="product-card__name">${name}</h3>
        <p class="product-card__meta">${localized(product.color.name)}</p>
        <p class="product-card__price">${priceHTML(product)}</p>
      </a>
      ${footer}
    </article>`;
}

function reasonText(reason, byId) {
  const product = reason.productId ? byId.get(reason.productId) : null;
  const name = product ? productName(product) : '';
  const attributes = joinList((reason.shared ?? []).map((key) => t(`attribute.${key}`)));

  if (reason.model === 'collaborative') return t('reason.collaborative', { product: name });
  if (reason.model === 'popularity') return t('reason.popularity');
  if (reason.model === 'complement') {
    return attributes
      ? t('reason.complementShared', { product: name, attributes })
      : t('reason.complement', { product: name });
  }
  return attributes
    ? t('reason.content', { product: name, attributes })
    : t('reason.contentPlain', { product: name });
}

/** Stacked bar plus text, so the split does not depend on colour alone. */
function shareBarHTML(components, score) {
  const shares = Object.entries(components)
    .map(([model, value]) => ({ model, share: score > 0 ? value / score : 0 }))
    .filter(({ share }) => share >= 0.01);
  return `
    <div class="share" role="img" aria-label="${t('share.label')}: ${shares
      .map(({ model, share }) => `${t(`share.${model}`)} ${formatPercent(share)}`)
      .join(', ')}">
      <div class="share__bar" aria-hidden="true">
        ${shares.map(({ model, share }) => `<span class="share__part share__part--${model}" data-width="${share}"></span>`).join('')}
      </div>
      <p class="share__legend" aria-hidden="true">
        ${shares.map(({ model, share }) => `<span>${t(`share.${model}`)} ${formatPercent(share)}</span>`).join('')}
      </p>
    </div>`;
}

/** The "why" under a recommended product. */
export function explanationHTML(item, byId) {
  const [mainReason] = item.reasons;
  return `
    <div class="why">
      <p class="why__reason">${mainReason ? reasonText(mainReason, byId) : ''}</p>
      ${item.components ? shareBarHTML(item.components, item.score) : ''}
    </div>`;
}

export function recommendationGridHTML(items, byId) {
  return items
    .map((item) => productCardHTML(byId.get(item.productId), { footer: explanationHTML(item, byId) }))
    .join('');
}

/** Placeholder cards while a list loads. Lists that already have content are left alone. */
export function showLoading(root, count) {
  if (root.children.length > 0) return;
  root.setAttribute('aria-busy', 'true');
  root.innerHTML =
    `<div class="skeleton" aria-hidden="true"><div class="product-card__media"></div></div>`.repeat(count);
}

/** Bar widths are set here because the content security policy blocks inline style attributes. */
export function applyWidths(root) {
  root.removeAttribute('aria-busy');
  root.querySelectorAll('[data-width]').forEach((element) => {
    element.style.width = `${Number(element.dataset.width) * 100}%`;
  });
}

export function errorHTML() {
  return `
    <div class="notice" role="alert">
      <p>${t('error.load')}</p>
      <button type="button" class="btn btn--secondary btn--small" data-retry>${t('error.retry')}</button>
    </div>`;
}

export function showError(root, retry) {
  root.removeAttribute('aria-busy');
  root.innerHTML = errorHTML();
  root.querySelector('[data-retry]').addEventListener('click', retry);
}

/** The visitor's browsing, with a way to delete it. */
export function renderHistoryPanel(root, byId, onChange) {
  const entries = getHistory();
  // One chip per product, newest first, showing the strongest thing done with it.
  const latest = new Map();
  [...entries].reverse().forEach(({ productId, type }) => {
    if (!latest.has(productId) || type === 'add_to_cart') latest.set(productId, type);
  });
  const chips = [...latest]
    .slice(0, 8)
    .map(([productId, type]) => {
      const product = byId.get(productId);
      if (!product) return '';
      const label = type === 'add_to_cart' ? t('history.cart') : t('history.view');
      return `<li class="chip"><a href="${productUrl(product)}">${productName(product)}</a> <span class="chip__tag">${label}</span></li>`;
    })
    .join('');

  root.innerHTML = `
    <div class="history__head">
      <h2 class="history__title">${t('history.title')}</h2>
      ${entries.length ? `<button type="button" class="link-btn" data-clear>${t('history.clear')}</button>` : ''}
    </div>
    ${entries.length ? `<ul class="chip-list">${chips}</ul>` : `<p class="muted history__empty">${t('history.empty')}</p>`}
    <p class="fine-print">${t('history.note')}</p>`;

  root.querySelector('[data-clear]')?.addEventListener('click', () => {
    clearHistory();
    onChange();
  });
}
