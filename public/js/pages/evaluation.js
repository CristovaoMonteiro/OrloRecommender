import { initPage } from '../layout.js';
import { t, formatDecimal, formatNumber, formatPercent } from '../i18n.js';
import { getEvaluation } from '../api.js';
import { applyWidths, showError } from '../components.js';

const PLAN_URL = 'https://github.com/CristovaoMonteiro/OrloRecommender/blob/main/docs/experiment-plan.md';
const RANKERS = [
  'random',
  'popularity',
  'same_category',
  'same_category_popular',
  'content',
  'collaborative',
  'hybrid',
];
const LIFTS = ['same_category_popular', 'content', 'collaborative'];

const signed = (value) => `${value >= 0 ? '+' : ''}${formatDecimal(value)}`;

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
            <th scope="col">${t('eval.recall')}</th>
            <th scope="col">${t('eval.ndcg')}</th>
            <th scope="col">${t('eval.coverage')}</th>
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

function liftList(improvements, total) {
  return `
    <ul class="lift-list">
      ${LIFTS.map((name) => {
        const { mean, low, high, datasetsAhead } = improvements[name];
        const tie = low <= 0 && high >= 0;
        return `
          <li>
            <span>${t(`eval.ranker.${name}`)}</span>
            <strong>${tie ? t('eval.tie') : signed(mean)}</strong>
            <span class="muted">
              ${tie ? `${signed(mean)}, ` : ''}${t('eval.liftInterval', { low: formatDecimal(low), high: formatDecimal(high) })},
              ${t('eval.liftAhead', { count: datasetsAhead, total })}
            </span>
          </li>`;
      }).join('')}
    </ul>`;
}

function reachTable({ results, slicesRecall10 }) {
  const { collaborative, hybrid } = results;
  const rows = [
    [
      'eval.reach.new',
      formatDecimal(slicesRecall10.new_products_only.collaborative, 2),
      formatDecimal(slicesRecall10.new_products_only.hybrid, 2),
    ],
    [
      'eval.reach.coverage',
      formatPercent(collaborative['coverage@4'], 1),
      formatPercent(hybrid['coverage@4'], 1),
    ],
    [
      'eval.reach.diversity',
      formatDecimal(collaborative['diversity@4'], 2),
      formatDecimal(hybrid['diversity@4'], 2),
    ],
  ];
  return `
    <div class="table-wrap">
      <table class="data-table data-table--compact">
        <thead>
          <tr>
            <th scope="col">${t('eval.reach.metric')}</th>
            <th scope="col">${t('eval.ranker.collaborative')}</th>
            <th scope="col">${t('eval.ranker.hybrid')}</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              ([key, before, after]) =>
                `<tr><th scope="row">${t(key)}</th><td>${before}</td><td>${after}</td></tr>`,
            )
            .join('')}
        </tbody>
      </table>
    </div>`;
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
  const { headline, experiment } = report;
  const newProducts = slicesRecall10.new_products_only;
  const datasets = protocol.testSeeds.length;
  const tenPercent = experiment.perGroup.find(({ lift }) => lift === 0.1);

  return `
    <p class="headline">${t('eval.headline', {
      datasets,
      ratio: formatDecimal(headline.mean, 1),
      min: formatDecimal(headline.min, 1),
      max: formatDecimal(headline.max, 1),
    })}</p>
    <ul class="facts-row">
      <li><strong>${formatNumber(datasets)}</strong> ${t('eval.fact.datasets')}</li>
      <li><strong>${formatNumber(protocol.testCases)}</strong> ${t('eval.fact.lists')}</li>
      <li><strong>${formatNumber(protocol.testVisitors)}</strong> ${t('eval.fact.visitors')}</li>
      <li><strong>${formatNumber(protocol.trainEventsPerDataset)}</strong> ${t('eval.fact.events')}</li>
    </ul>

    <section class="section">
      <h2 class="section__title">${t('eval.comparison')}</h2>
      ${rankingTable(results)}
    </section>

    <div class="two-columns">
      <section class="section">
        <h2 class="section__title">${t('eval.lift')}</h2>
        <p>${t('eval.liftText')}</p>
        ${liftList(improvementOverNdcg10, datasets)}
      </section>
      <section class="section">
        <h2 class="section__title">${t('eval.reach')}</h2>
        <p>${t('eval.reachText')}</p>
        ${reachTable(report)}
      </section>
    </div>

    <div class="two-columns">
      <section class="section">
        <h2 class="section__title">${t('eval.control')}</h2>
        <p>${t('eval.controlText')}</p>
        ${controlBars(control)}
      </section>
      <section class="section">
        <h2 class="section__title">${t('eval.colours')}</h2>
        <p>${t('eval.coloursText', {
          with: formatDecimal(report.colourRule.targetsIncludeIfShown),
          without: formatDecimal(report.colourRule.targetsInclude),
        })}</p>
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
    </div>

    <section class="section">
      <h2 class="section__title">${t('eval.next')}</h2>
      <p>${t('eval.nextText', {
        baseline: formatPercent(experiment.baseline),
        visitors: formatNumber(tenPercent.visitors),
      })}</p>
      <a class="btn btn--secondary btn--small" href="${PLAN_URL}">${t('eval.nextLink')}</a>
    </section>`;
}

async function render() {
  const root = document.querySelector('[data-report]');
  if (!root.firstChild) root.innerHTML = `<p class="muted">${t('state.loading')}</p>`;
  try {
    root.innerHTML = pageHTML(await getEvaluation());
    applyWidths(root);
  } catch {
    showError(root, render);
  }
}

initPage({ active: 'evaluation', titleKey: 'meta.evaluation', render });
