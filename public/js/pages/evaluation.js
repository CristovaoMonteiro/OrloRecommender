import { initPage } from '../layout.js';
import { t, formatDecimal, formatNumber, formatPercent } from '../i18n.js';
import { getEvaluation } from '../api.js';
import { applyWidths, showError } from '../components.js';

const RANKERS = ['random', 'popularity', 'same_category', 'content', 'collaborative', 'hybrid'];
const LIFTS = ['same_category', 'content', 'collaborative'];

function rankingTable(results) {
  const best = Math.max(...RANKERS.map((name) => results[name]['recall@4'].mean));
  const rows = RANKERS.map((name) => {
    const row = results[name];
    const recall = row['recall@4'].mean;
    return `
      <tr class="${name === 'hybrid' ? 'is-highlight' : ''}">
        <th scope="row">${t(`eval.ranker.${name}`)}</th>
        <td>
          <div class="metric-bar"><span data-width="${recall / best}"></span></div>
          ${formatDecimal(recall)}
        </td>
        <td>${formatDecimal(row['ndcg@10'].mean)}</td>
        <td>${formatPercent(row['coverage@4'], 1)}</td>
      </tr>`;
  }).join('');
  return `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th scope="col">${t('eval.ranker')}</th>
            <th scope="col" abbr="${t('eval.recallHint')}">${t('eval.recall')}</th>
            <th scope="col" abbr="${t('eval.ndcgHint')}">${t('eval.ndcg')}</th>
            <th scope="col" abbr="${t('eval.coverageHint')}">${t('eval.coverage')}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <dl class="definitions">
      <div><dt>${t('eval.recall')}</dt><dd>${t('eval.recallHint')}</dd></div>
      <div><dt>${t('eval.ndcg')}</dt><dd>${t('eval.ndcgHint')}</dd></div>
      <div><dt>${t('eval.coverage')}</dt><dd>${t('eval.coverageHint')}</dd></div>
    </dl>`;
}

function liftList(improvements) {
  return `
    <ul class="lift-list">
      ${LIFTS.map((name) => {
        const { mean, low, high } = improvements[name];
        return `
          <li>
            <span>${t(`eval.ranker.${name}`)}</span>
            <strong>+${formatDecimal(mean)}</strong>
            <span class="muted">${t('eval.liftInterval', { low: formatDecimal(low), high: formatDecimal(high) })}</span>
          </li>`;
      }).join('')}
    </ul>`;
}

function controlBars(control) {
  const rows = [
    ['eval.control.real', control.collaborative_real],
    ['eval.control.shuffled', control.collaborative_shuffled],
    ['eval.control.popularity', control.popularity],
  ];
  return `
    <ul class="control-list">
      ${rows
        .map(
          ([key, value]) => `
        <li>
          <span>${t(key)}</span>
          <div class="metric-bar"><span data-width="${value / control.collaborative_real}"></span></div>
          <strong>${formatDecimal(value)}</strong>
        </li>`,
        )
        .join('')}
    </ul>`;
}

function pageHTML(report) {
  const { protocol, results, improvementOverNdcg10, control, completeTheLook, slicesRecall10 } = report;
  const ratio = results.hybrid['recall@4'].mean / results.same_category['recall@4'].mean;
  const newProducts = slicesRecall10.new_products_only;

  return `
    <p class="headline">${t('eval.headline', { ratio: formatDecimal(ratio, 1) })}</p>
    <ul class="facts-row">
      <li><strong>${formatNumber(protocol.testCases)}</strong> ${t('eval.fact.lists')}</li>
      <li><strong>${formatNumber(protocol.testVisitors)}</strong> ${t('eval.fact.visitors')}</li>
      <li><strong>${formatNumber(protocol.trainEvents)}</strong> ${t('eval.fact.events')}</li>
    </ul>

    <section class="section">
      <h2 class="section__title">${t('eval.comparison')}</h2>
      ${rankingTable(results)}
    </section>

    <div class="two-columns">
      <section class="section">
        <h2 class="section__title">${t('eval.lift')}</h2>
        <p>${t('eval.liftText')}</p>
        ${liftList(improvementOverNdcg10)}
      </section>
      <section class="section">
        <h2 class="section__title">${t('eval.control')}</h2>
        <p>${t('eval.controlText')}</p>
        ${controlBars(control)}
      </section>
    </div>

    <section class="section">
      <h2 class="section__title">${t('eval.look')}</h2>
      <p>${t('eval.lookText', {
        complements: formatPercent(completeTheLook.complements.mean),
        cases: formatNumber(completeTheLook.cases),
        popular: formatPercent(completeTheLook.popular_other_category.mean),
      })}</p>
    </section>

    <div class="two-columns">
      <section class="section">
        <h2 class="section__title">${t('eval.method')}</h2>
        <ul class="plain-list">
          <li>${t('eval.method.1')}</li>
          <li>${t('eval.method.2')}</li>
          <li>${t('eval.method.3')}</li>
        </ul>
      </section>
      <section class="section">
        <h2 class="section__title">${t('eval.limits')}</h2>
        <ul class="plain-list">
          <li>${t('eval.limit.1')}</li>
          <li>${t('eval.limit.2', {
            hybrid: formatDecimal(newProducts.hybrid, 2),
            content: formatDecimal(newProducts.content, 2),
          })}</li>
          <li>${t('eval.limit.3')}</li>
        </ul>
      </section>
    </div>`;
}

async function render() {
  const root = document.querySelector('[data-report]');
  try {
    root.innerHTML = pageHTML(await getEvaluation());
    applyWidths(root);
  } catch {
    showError(root, render);
  }
}

initPage({ active: 'evaluation', titleKey: 'meta.evaluation', render });
