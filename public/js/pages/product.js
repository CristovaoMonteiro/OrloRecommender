import { initPage } from '../layout.js';
import { t, attributeValue, localized } from '../i18n.js';
import { getLook, getProduct, getProducts, getRecommendations } from '../api.js';
import { getHistory, recordInteraction } from '../history.js';
import { productSVG } from '../placeholder.js';
import {
  applyWidths,
  priceHTML,
  productName,
  recommendationGridHTML,
  renderHistoryPanel,
  showError,
  showLoading,
} from '../components.js';

const slug = new URLSearchParams(window.location.search).get('slug');

function coloursHTML(product, products) {
  const others = products.filter((p) => p.lineId === product.lineId && p.id !== product.id);
  if (others.length === 0) return '';
  const links = others
    .map((p) => `<a href="/product?slug=${p.slug}">${localized(p.color.name)}</a>`)
    .join(', ');
  return `<p class="product__colours">${t('product.colours')} ${links}</p>`;
}

function detailHTML(product, products, added) {
  const { attributes } = product;
  const facts = [
    ['product.style', attributeValue(attributes.style)],
    ['product.material', localized(product.details)[0]],
    ['product.season', attributeValue(attributes.season)],
    ['product.palette', attributeValue(attributes.palette)],
  ];
  return `
    <a class="back-link" href="/">${t('product.back')}</a>
    <div class="product">
      <div class="product__media">${productSVG(product, { label: productName(product), shadow: true })}</div>
      <div class="product__info">
        <h1 class="product__title">${productName(product)}</h1>
        <p class="product__price">${priceHTML(product)}</p>
        <p class="muted product__colour">${localized(product.color.name)}</p>
        ${coloursHTML(product, products)}
        <p>${localized(product.description)}</p>
        <dl class="facts">
          ${facts.map(([key, value]) => `<div><dt>${t(key)}</dt><dd>${value}</dd></div>`).join('')}
        </dl>
        <button type="button" class="btn btn--primary" data-add>${t('product.add')}</button>
        <p class="fine-print" data-add-status role="status">${added ? t('product.added') : t('product.demo')}</p>
      </div>
    </div>`;
}

async function renderSimilar(product, byId) {
  const list = document.querySelector('[data-similar]');
  try {
    const { items } = await getRecommendations({ history: getHistory(), contextProductId: product.id, k: 4 });
    list.innerHTML = recommendationGridHTML(items, byId);
    applyWidths(list);
  } catch {
    showError(list, () => renderSimilar(product, byId));
  }
}

async function renderLook(product, byId) {
  const list = document.querySelector('[data-look]');
  try {
    const { items } = await getLook(product.id);
    list.innerHTML = recommendationGridHTML(items, byId);
    applyWidths(list);
  } catch {
    showError(list, () => renderLook(product, byId));
  }
}

async function render(added = false) {
  const root = document.querySelector('[data-product]');
  const sections = document.querySelector('[data-sections]');
  if (!root.firstChild) root.innerHTML = `<p class="muted">${t('state.loading')}</p>`;
  try {
    const [product, products] = await Promise.all([getProduct(slug), getProducts()]);
    const byId = new Map(products.map((p) => [p.id, p]));
    document.title = `${productName(product)} | Orlo Recommender`;
    recordInteraction(product.id, 'view_product');

    root.innerHTML = detailHTML(product, products, added);
    sections.hidden = false;
    showLoading(document.querySelector('[data-similar]'), 4);
    showLoading(document.querySelector('[data-look]'), 4);
    root.querySelector('[data-add]').addEventListener('click', () => {
      recordInteraction(product.id, 'add_to_cart');
      render(true);
    });

    const refreshHistory = () => {
      renderHistoryPanel(document.querySelector('[data-history]'), byId, refreshHistory);
      renderSimilar(product, byId);
    };
    refreshHistory();
    renderLook(product, byId);
  } catch {
    sections.hidden = true;
    root.innerHTML = `<div class="notice" role="alert"><p>${t('product.notFound')}</p><a class="btn btn--secondary btn--small" href="/">${t('product.back')}</a></div>`;
  }
}

initPage({ active: 'store', titleKey: 'meta.product', render: () => render() });
