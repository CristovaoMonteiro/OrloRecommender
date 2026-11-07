import { initPage } from '../layout.js';
import { t, formatDecimal, formatPercent } from '../i18n.js';
import { getProducts, getRecommendations, getSettings } from '../api.js';
import { getHistory, setHistory } from '../history.js';
import {
  applyWidths,
  explanationHTML,
  productCardHTML,
  renderHistoryPanel,
  showError,
  showLoading,
} from '../components.js';

const RESULTS = 8;
const DEBOUNCE_MS = 150;
const WEIGHTS = ['collaborative', 'content'];
// The margin slider runs from 0 to 100%, which maps to a weight from 0 to 2.
const MARGIN_SCALE = 2;

// Three products that define each sample visitor, oldest first.
const SAMPLE_VISITORS = {
  new: [],
  heritage: ['waxed-field-jacket-olive', 'corduroy-trousers-chestnut', 'lambswool-crew-moss'],
  coastal: ['linen-blazer-sand', 'camp-collar-shirt-sand', 'linen-drawstring-sand'],
  tailored: ['wool-overcoat-charcoal', 'pleated-wool-trousers-charcoal', 'merino-rollneck-charcoal'],
};

const state = { weights: null, diversity: null, marginWeight: null, tuned: null, visitor: null };
let timer;
let latestRequest = 0;

const sliderHTML = (id, labelKey, hintKey, value) => `
  <div class="slider">
    <label class="slider__label" for="slider-${id}">
      <span>${t(labelKey)}</span>
      <output data-output="${id}">${formatPercent(value)}</output>
    </label>
    <input id="slider-${id}" type="range" min="0" max="1" step="0.05" value="${value}" data-slider="${id}"
           aria-describedby="hint-${id}" />
    <p class="fine-print" id="hint-${id}">${t(hintKey)}</p>
  </div>`;

function renderControls(run) {
  const root = document.querySelector('[data-sliders]');
  root.innerHTML = `
    ${WEIGHTS.map((id) => sliderHTML(id, `lab.${id}`, `lab.${id}Hint`, state.weights[id])).join('')}
    ${sliderHTML('diversity', 'lab.diversity', 'lab.diversityHint', state.diversity)}
    ${sliderHTML('margin', 'lab.margin', 'lab.marginHint', state.marginWeight)}
    <button type="button" class="link-btn" data-reset>${t('lab.reset')}</button>
    <p class="fine-print">${t('lab.tuned', {
      collaborative: formatPercent(state.tuned.weights.collaborative),
      content: formatPercent(state.tuned.weights.content),
    })}</p>`;

  root.querySelectorAll('[data-slider]').forEach((input) =>
    input.addEventListener('input', () => {
      const value = Number(input.value);
      if (input.dataset.slider === 'diversity') state.diversity = value;
      else if (input.dataset.slider === 'margin') state.marginWeight = value;
      else state.weights[input.dataset.slider] = value;
      root.querySelector(`[data-output="${input.dataset.slider}"]`).textContent = formatPercent(value);
      clearTimeout(timer);
      timer = setTimeout(run, DEBOUNCE_MS);
    }),
  );
  root.querySelector('[data-reset]').addEventListener('click', () => {
    state.weights = { ...state.tuned.weights };
    state.diversity = state.tuned.diversity;
    state.marginWeight = state.tuned.marginWeight / MARGIN_SCALE;
    renderControls(run);
    run();
  });
}

async function renderResults(byId) {
  const list = document.querySelector('[data-results]');
  const status = document.querySelector('[data-status]');
  if (WEIGHTS.every((key) => state.weights[key] === 0)) {
    status.textContent = t('lab.zero');
    list.innerHTML = '';
    return;
  }

  latestRequest += 1;
  const current = latestRequest;
  try {
    const { items } = await getRecommendations({
      history: getHistory(),
      k: RESULTS,
      weights: state.weights,
      diversity: state.diversity,
      marginWeight: state.marginWeight * MARGIN_SCALE,
    });
    if (current !== latestRequest) return;
    status.textContent = '';
    list.innerHTML = items
      .map((item) => {
        const product = byId.get(item.productId);
        const score = `<p class="fine-print">${t('lab.score', { score: formatDecimal(item.score, 2) })} · ${t('lab.marginValue', { margin: formatPercent(product.margin) })}</p>`;
        return productCardHTML(byId.get(item.productId), { footer: explanationHTML(item, byId) + score });
      })
      .join('');
    applyWidths(list);
  } catch {
    if (current === latestRequest) showError(list, () => renderResults(byId));
  }
}

function renderVisitors(slugToId, run) {
  const root = document.querySelector('[data-visitors]');
  root.innerHTML = Object.keys(SAMPLE_VISITORS)
    .map(
      (id) =>
        `<button type="button" class="pill" data-visitor="${id}" aria-pressed="${id === state.visitor}">${t(`lab.visitor.${id}`)}</button>`,
    )
    .join('');
  root.querySelectorAll('[data-visitor]').forEach((button) =>
    button.addEventListener('click', () => {
      setHistory(
        SAMPLE_VISITORS[button.dataset.visitor].map((slug) => ({
          productId: slugToId.get(slug),
          type: 'view_product',
        })),
      );
      state.visitor = button.dataset.visitor;
      renderVisitors(slugToId, run);
      run();
    }),
  );
}

async function render() {
  showLoading(document.querySelector('[data-results]'), RESULTS);
  try {
    const [products, settings] = await Promise.all([getProducts(), getSettings()]);
    state.tuned ??= settings;
    state.weights ??= { ...settings.weights };
    state.diversity ??= settings.diversity;
    state.marginWeight ??= settings.marginWeight / MARGIN_SCALE;

    const byId = new Map(products.map((p) => [p.id, p]));
    const slugToId = new Map(products.map((p) => [p.slug, p.id]));
    const run = () => {
      renderHistoryPanel(document.querySelector('[data-history]'), byId, run);
      renderResults(byId);
    };
    renderVisitors(slugToId, run);
    renderControls(run);
    run();
  } catch {
    showError(document.querySelector('[data-results]'), render);
  }
}

initPage({ active: 'lab', titleKey: 'meta.lab', render });
