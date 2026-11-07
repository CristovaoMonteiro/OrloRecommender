import { initPage } from '../layout.js';
import { t, formatNumber } from '../i18n.js';
import { getProducts, getRecommendations } from '../api.js';
import { getHistory } from '../history.js';
import {
  applyWidths,
  productCardHTML,
  recommendationGridHTML,
  renderHistoryPanel,
  showError,
  showLoading,
} from '../components.js';

const CATEGORIES = ['all', 'shirts', 'polos', 'knitwear', 'trousers', 'outerwear', 'accessories'];

let selectedCategory = 'all';

function renderCatalogue(products) {
  const filters = document.querySelector('[data-filters]');
  const grid = document.querySelector('[data-catalogue]');
  const visible = products.filter((p) => selectedCategory === 'all' || p.category === selectedCategory);

  filters.innerHTML = CATEGORIES.map(
    (category) =>
      `<button type="button" class="pill" data-category="${category}" aria-pressed="${category === selectedCategory}">${t(`category.${category}`)}</button>`,
  ).join('');
  filters.querySelectorAll('[data-category]').forEach((button) =>
    button.addEventListener('click', () => {
      selectedCategory = button.dataset.category;
      renderCatalogue(products);
    }),
  );

  document.querySelector('[data-count]').textContent = t('home.count', {
    count: formatNumber(visible.length),
  });
  grid.innerHTML = visible.map((product) => productCardHTML(product)).join('');
  applyWidths(grid);
}

async function renderForYou(byId) {
  const list = document.querySelector('[data-for-you]');
  const history = getHistory();
  try {
    const { strategy, items } = await getRecommendations({ history, k: 4 });
    const personal = strategy === 'personalised';
    document.querySelector('[data-for-you-title]').textContent = t(personal ? 'home.forYou' : 'home.popular');
    const opened = new Set(history.map((h) => h.productId)).size;
    document.querySelector('[data-for-you-hint]').textContent = !personal
      ? t('home.popularHint')
      : opened === 1
        ? t('home.personalHintOne')
        : t('home.personalHint', { count: formatNumber(opened) });
    list.innerHTML = recommendationGridHTML(items, byId);
    applyWidths(list);
  } catch {
    showError(list, () => renderForYou(byId));
  }
}

async function render() {
  showLoading(document.querySelector('[data-for-you]'), 4);
  showLoading(document.querySelector('[data-catalogue]'), 8);
  try {
    const products = await getProducts();
    const byId = new Map(products.map((p) => [p.id, p]));
    const refresh = () => {
      renderHistoryPanel(document.querySelector('[data-history]'), byId, refresh);
      renderForYou(byId);
    };
    renderCatalogue(products);
    refresh();
  } catch {
    showError(document.querySelector('[data-catalogue]'), render);
  }
}

initPage({ active: 'store', titleKey: 'meta.store', render });
