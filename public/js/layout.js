import { t, getLang, setLang, LANGS, applyTranslations } from './i18n.js';

const REPOSITORY_URL = 'https://github.com/CristovaoMonteiro/OrloRecommender';
const VISITOR_JOURNEY_URL = 'https://visitor-journey.onrender.com';

function headerHTML(active) {
  const link = (id, href) =>
    `<li><a href="${href}" ${active === id ? 'aria-current="page"' : ''}>${t(`nav.${id}`)}</a></li>`;
  const languages = LANGS.map(
    (lang) =>
      `<button type="button" class="lang-btn" data-lang="${lang}" aria-pressed="${lang === getLang()}">${lang.toUpperCase()}</button>`,
  ).join('<span aria-hidden="true">/</span>');

  return `
    <a class="skip-link" href="#main">${t('nav.skip')}</a>
    <div class="header-bar container">
      <a href="/" class="logo">Orlo <span class="logo__tag">${t('brand.tag')}</span></a>
      <nav class="main-nav" aria-label="${t('nav.main')}">
        <ul>${link('store', '/')}${link('lab', '/lab')}${link('evaluation', '/evaluation')}</ul>
      </nav>
      <div class="lang-switch" role="group" aria-label="${t('lang.label')}">${languages}</div>
    </div>`;
}

function footerHTML() {
  return `
    <div class="container footer-grid">
      <div>
        <p class="footer-note">${t('footer.note')}</p>
        <p class="muted">${t('footer.privacy')}</p>
      </div>
      <ul class="footer-links">
        <li><a href="${REPOSITORY_URL}">${t('footer.code')}</a></li>
        <li><a href="${VISITOR_JOURNEY_URL}">${t('footer.journey')}</a></li>
      </ul>
    </div>`;
}

/**
 * Draws the shared header and footer and runs `render`, again after each language change.
 * @param {{ active: string, titleKey: string, render: () => (void | Promise<void>) }} page
 */
export function initPage({ active, titleKey, render }) {
  const header = document.getElementById('site-header');
  const footer = document.getElementById('site-footer');

  function draw() {
    document.title = `${t(titleKey)} | Orlo Recommender`;
    header.innerHTML = headerHTML(active);
    footer.innerHTML = footerHTML();
    applyTranslations();
    header.querySelectorAll('[data-lang]').forEach((button) =>
      button.addEventListener('click', () => {
        if (button.dataset.lang === getLang()) return;
        setLang(button.dataset.lang);
        draw();
      }),
    );
    render();
  }

  draw();
}
