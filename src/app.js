const $ = (id) => document.getElementById(id);

const els = {
  home: $('home-btn'),
  edition: $('edition'),
  tickerTrack: $('ticker-track'),
  page: $('page'),
  curl: $('curl'),
  grabTip: $('grab-tip'),
  counter: $('counter'),
  pagesList: $('pages-list'),
  prev: $('prev-btn'),
  next: $('next-btn'),
  first: $('first-btn'),
  last: $('last-btn'),
  prevSmall: $('prev-small'),
  nextSmall: $('next-small'),
  refresh: $('refresh-link'),
  sourceNote: $('source-note'),
  searchOpen: $('search-open'),
  searchOverlay: $('search-overlay'),
  searchInput: $('search-input'),
  searchChips: $('search-chips'),
  resultCount: $('result-count'),
  results: $('results'),
  webSearch: $('web-search'),
  articleOverlay: $('article-overlay'),
  articleContent: $('article-content'),
  toast: $('toast')
};

const state = {
  data: null,
  byId: new Map(),
  pageIndex: 0,
  animating: false,
  category: 'all',
  query: '',
  drag: null,
  suppressClick: false,
  lastTransform: 'translateX(0) rotateY(0deg) scale(1)',
  toastTimer: null,
  lastCheck: Date.now()
};

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const esc = (value = '') =>
  String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

const norm = (value = '') =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pl');

const timeFmt = new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit' });
const dateFmt = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });

const timeLabel = (iso) => timeFmt.format(new Date(iso));
const fullDate = (iso) => dateFmt.format(new Date(iso));

function toast(message) {
  clearTimeout(state.toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add('show');
  state.toastTimer = setTimeout(() => els.toast.classList.remove('show'), 3600);
}

function imageUrl(article) {
  return article.image ? new URL(article.image, document.baseURI).href : '';
}

function noImageHTML(article) {
  const initial = esc((article.categoryName || 'KŚ').slice(0, 2).toUpperCase());
  return `<div class="no-image"><span class="no-image-mark">${initial}</span><span class="no-image-label">Ilustracja · ${esc(article.source)}</span></div>`;
}

function mediaInner(article) {
  return article.image
    ? `<img src="${esc(imageUrl(article))}" alt="" loading="lazy" />`
    : noImageHTML(article);
}

function mediaHTML(article, className) {
  const extra = article.imageKind === 'logo' ? ' is-logo' : '';
  return `<div class="${className}${extra}">${mediaInner(article)}</div>`;
}

function relatedHTML(article) {
  if (!article.related?.length) return '';
  return `<div class="related-block"><h4>Czytaj także</h4><ul>${article.related
    .map((item) => `<li><a href="${esc(item.url)}" target="_blank" rel="noopener">${esc(item.title)}</a> <span>— ${esc(item.source)}</span></li>`)
    .join('')}</ul></div>`;
}

function leadHTML(article, heading = 'h1') {
  return `
    <section class="lead">
      <div class="lead-figure">
        ${mediaHTML(article, 'lead-media')}
        <div class="lead-photo-credit">MATERIAŁ: ${esc(article.source)}</div>
      </div>
      <div class="lead-text clickable" data-article="${esc(article.id)}">
        <p class="kicker">${esc(article.categoryName)} · ${esc(article.source)}</p>
        <${heading} class="headline">${esc(article.title)}</${heading}>
        <p class="byline">${fullDate(article.publishedAt)} · godz. ${timeLabel(article.publishedAt)} · Źródło: ${esc(article.source)}</p>
        ${relatedHTML(article)}
      </div>
    </section>`;
}

function storyHTML(article) {
  return `<article class="story clickable" data-article="${esc(article.id)}">
    ${mediaHTML(article, 'story-media')}
    <p class="kicker">${esc(article.categoryName)}</p>
    <h3 class="headline">${esc(article.title)}</h3>
    <p class="story-meta">${esc(article.source)} · ${timeLabel(article.publishedAt)}</p>
  </article>`;
}

function cardHTML(article) {
  return `<article class="card clickable" data-article="${esc(article.id)}">
    ${mediaHTML(article, 'card-media')}
    <div>
      <p class="kicker">${esc(article.categoryName)} · ${esc(article.source)}</p>
      <h3 class="headline">${esc(article.title)}</h3>
      <p class="story-meta">${timeLabel(article.publishedAt)}</p>
    </div>
  </article>`;
}

function briefsHTML(articles, title = 'W skrócie') {
  if (!articles.length) return '';
  return `<section class="briefs">
    <h2 class="section-title">${esc(title)}</h2>
    <ol>${articles
      .map(
        (article) => `<li class="clickable" data-article="${esc(article.id)}">
          <span class="brief-thumb${article.imageKind === 'logo' ? ' is-logo' : ''}">${mediaInner(article)}</span>
          <span class="brief-title">${esc(article.title)}</span>
          <span class="brief-meta">${esc(article.source)} · ${timeLabel(article.publishedAt)}</span>
        </li>`
      )
      .join('')}</ol>
  </section>`;
}

function masthead() {
  const meta = state.data.meta;
  return `<header class="masthead">
    <div class="masthead-top">
      <span>Warszawa · ${esc(meta.printDate)}</span>
      <span>Rok ${meta.year} · Nr ${meta.edition}</span>
      <span>Wydanie cyfrowe</span>
    </div>
    <div class="masthead-title">Kurier Świata</div>
    <div class="masthead-sub">
      <span>Niezależny przegląd tygodnia</span>
      <span class="red">Prawdziwe informacje · ostatnie 7 dni</span>
    </div>
  </header>`;
}

function footerHTML(page) {
  return `<footer class="page-footer">
    <span>Kurier Świata · ${esc(state.data.meta.sourceLabel)} · ${esc(state.data.meta.printDate)}</span>
    <span class="folio">${page.number}</span>
  </footer>`;
}

function frontPageHTML(page, articles) {
  const [lead, second, third, ...briefs] = articles;
  return `${masthead()}
    <div class="page-body">
      ${lead ? leadHTML(lead) : '<p class="empty-state">Brak wiadomości w tym wydaniu.</p>'}
      <div class="rule-thick"></div>
      <section class="secondary">${[second, third].filter(Boolean).map(storyHTML).join('')}</section>
      ${briefs.length ? `<div class="rule-thin"></div>${briefsHTML(briefs)}` : ''}
    </div>
    ${footerHTML(page)}`;
}

function sectionPageHTML(page, articles) {
  const [lead, ...rest] = articles;
  const cards = rest.slice(0, 6);
  const briefs = rest.slice(6);
  return `${masthead()}
    <div class="page-body">
      <header class="section-header">
        <span class="section-no">${String(page.number).padStart(2, '0')}</span>
        <h1>${esc(page.title)}</h1>
        <p>${articles.length} wiadomości · ostatnie 7 dni</p>
      </header>
      ${lead ? leadHTML(lead, 'h2') : ''}
      ${cards.length ? `<div class="story-grid">${cards.map(cardHTML).join('')}</div>` : ''}
      ${briefs.length ? `<div class="rule-thin"></div>${briefsHTML(briefs, 'Więcej z działu')}` : ''}
    </div>
    ${footerHTML(page)}`;
}

function indexPageHTML(page, articles) {
  const groups = state.data.categories
    .map((category) => ({
      category,
      items: articles.filter((article) => article.category === category.id)
    }))
    .filter((group) => group.items.length);

  return `${masthead()}
    <div class="page-body">
      <header class="section-header">
        <span class="section-no">${String(page.number).padStart(2, '0')}</span>
        <h1>Indeks wydania</h1>
        <p>${articles.length} wiadomości · ${state.data.meta.sourceCount} źródeł</p>
      </header>
      ${groups
        .map(
          (group) => `<section class="index-group">
            <h3>${esc(group.category.name)} <small>(${group.items.length})</small></h3>
            ${group.items
              .map(
                (article) => `<div class="index-row clickable" data-article="${esc(article.id)}">
                  <time>${timeLabel(article.publishedAt)}</time>
                  <span>${esc(article.title)}</span>
                  <em>${esc(article.source)}</em>
                </div>`
              )
              .join('')}
          </section>`
        )
        .join('')}
    </div>
    ${footerHTML(page)}`;
}

function renderPage(index) {
  const page = state.data.pages[index];
  const articles = page.articleIds.map((id) => state.byId.get(id)).filter(Boolean);
  els.page.innerHTML =
    page.kind === 'front'
      ? frontPageHTML(page, articles)
      : page.kind === 'index'
        ? indexPageHTML(page, articles)
        : sectionPageHTML(page, articles);

  els.page.scrollTop = 0;
  els.page.style.transform = '';
  els.page.style.opacity = '';
  els.curl.style.opacity = '0';
  state.lastTransform = 'translateX(0) rotateY(0deg) scale(1)';
  state.pageIndex = index;

  els.counter.textContent = `${index + 1} / ${state.data.pages.length}`;
  els.prev.disabled = els.prevSmall.disabled = els.first.disabled = index === 0;
  els.next.disabled = els.nextSmall.disabled = els.last.disabled = index === state.data.pages.length - 1;
  [...els.pagesList.children].forEach((button, i) => {
    button.classList.toggle('active', i === index);
    button.setAttribute('aria-current', i === index ? 'page' : 'false');
  });
  els.grabTip.classList.toggle('hidden', index > 1);

  els.page.querySelectorAll('img').forEach((img) => {
    img.addEventListener('error', () => {
      const node = img.closest('[data-article]');
      const article = node ? state.byId.get(node.dataset.article) : null;
      const holder = document.createElement('div');
      holder.innerHTML = noImageHTML(article || {});
      img.replaceWith(holder.firstElementChild);
    });
  });
}

async function goTo(index) {
  const total = state.data.pages.length;
  if (state.animating || index < 0 || index >= total || index === state.pageIndex) return;

  const direction = index > state.pageIndex ? 1 : -1;
  if (reducedMotion || !els.page.animate) {
    renderPage(index);
    return;
  }

  state.animating = true;
  els.grabTip.classList.add('hidden');
  const page = els.page;
  const outgoing = page.animate(
    [
      { transform: state.lastTransform, opacity: 1 },
      { transform: `translateX(${-18 * direction}%) rotateY(${-58 * direction}deg) scale(.93)`, opacity: 0.25 }
    ],
    { duration: 330, easing: 'cubic-bezier(.4,0,.8,.3)', fill: 'forwards' }
  );
  await outgoing.finished.catch(() => {});
  outgoing.cancel();

  renderPage(index);
  const incoming = page.animate(
    [
      { transform: `translateX(${18 * direction}%) rotateY(${58 * direction}deg) scale(.93)`, opacity: 0.25 },
      { transform: 'translateX(0) rotateY(0deg) scale(1)', opacity: 1 }
    ],
    { duration: 400, easing: 'cubic-bezier(.16,.85,.28,1)' }
  );
  await incoming.finished.catch(() => {});
  state.animating = false;
}

function findPage(articleId) {
  return state.data.pages.findIndex((page) => page.articleIds.includes(articleId));
}

async function showInPaper(articleId) {
  closeOverlays();
  const index = findPage(articleId);
  if (index < 0) return;
  await goTo(index);
  const node = els.page.querySelector(`[data-article="${CSS.escape(articleId)}"]`);
  if (node) {
    node.scrollIntoView({ block: 'center', behavior: reducedMotion ? 'auto' : 'smooth' });
    node.classList.add('is-target');
    setTimeout(() => node.classList.remove('is-target'), 2400);
  }
}

/* ---------- drag to turn paper ---------- */

function onPointerDown(event) {
  if (state.animating || event.target.closest('a, button, input')) return;
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  state.drag = { id: event.pointerId, x: event.clientX, y: event.clientY, dx: 0, moved: false };
  els.page.setPointerCapture(event.pointerId);
  els.page.classList.add('dragging');
  els.grabTip.classList.add('hidden');
}

function onPointerMove(event) {
  if (!state.drag || event.pointerId !== state.drag.id) return;
  const dx = event.clientX - state.drag.x;
  const dy = event.clientY - state.drag.y;
  state.drag.dx = dx;
  if (Math.abs(dy) > Math.abs(dx) * 1.3) return;
  state.drag.moved = true;
  const limited = Math.max(-120, Math.min(120, dx));
  state.lastTransform = `translateX(${limited * 0.22}px) rotateY(${limited * 0.17}deg) scale(${1 - Math.abs(limited) * 0.0004})`;
  els.page.style.transform = state.lastTransform;
  els.curl.style.opacity = String(Math.min(0.7, Math.abs(limited) / 150));
}

function onPointerUp(event) {
  if (!state.drag || event.pointerId !== state.drag.id) return;
  const dx = state.drag.dx;
  state.drag = null;
  els.page.classList.remove('dragging');
  if (Math.abs(dx) > 8) state.suppressClick = true;
  const threshold = Math.max(55, Math.min(120, els.page.clientWidth * 0.14));

  if (Math.abs(dx) > threshold) {
    goTo(state.pageIndex + (dx < 0 ? 1 : -1));
  } else {
    const start = state.lastTransform;
    state.lastTransform = 'translateX(0) rotateY(0deg) scale(1)';
    els.page.style.transition = 'transform .28s cubic-bezier(.2,.9,.3,1)';
    els.page.style.transform = state.lastTransform;
    els.curl.style.opacity = '0';
    setTimeout(() => {
      els.page.style.transition = '';
      els.page.style.transform = '';
    }, 300);
    void start;
  }
}

/* ---------- search ---------- */

function closeOverlays() {
  els.searchOverlay.hidden = true;
  els.articleOverlay.hidden = true;
}

function openSearch() {
  els.searchOverlay.hidden = false;
  els.articleOverlay.hidden = true;
  els.searchInput.value = state.query;
  runSearch();
  requestAnimationFrame(() => els.searchInput.focus());
}

function renderResult(article) {
  return `<div class="result">
    <div class="result-title clickable" data-article="${esc(article.id)}">
      <span class="result-cat">${esc(article.categoryName)} · ${esc(article.source)}</span>
      <span>${esc(article.title)}</span>
      <span class="result-meta">${fullDate(article.publishedAt)} · godz. ${timeLabel(article.publishedAt)}</span>
    </div>
    <div class="result-actions">
      <button type="button" data-show="${esc(article.id)}">W gazecie</button>
      <a href="${esc(article.url)}" target="_blank" rel="noopener">Źródło ↗</a>
    </div>
  </div>`;
}

function runSearch() {
  const query = norm(state.query.trim());
  const terms = query.split(/\s+/).filter(Boolean);
  const articles = state.data.articles.filter((article) => {
    if (state.category !== 'all' && article.category !== state.category) return false;
    if (!terms.length) return false;
    const haystack = norm(
      [article.title, article.source, article.categoryName, ...(article.related || []).map((item) => item.title)].join(' ')
    );
    return terms.every((term) => haystack.includes(term));
  });

  els.resultCount.textContent = terms.length
    ? `${articles.length} ${articles.length === 1 ? 'wynik' : 'wyników'} w tym wydaniu`
    : 'Wpisz frazę, aby wyszukać';
  els.results.innerHTML = terms.length
    ? articles.map(renderResult).join('') || '<p class="empty-state">Brak wyników. Spróbuj innej frazy lub sprawdź w internecie.</p>'
    : '<p class="empty-state">Szukaj w nagłówkach zebranych w tym wydaniu.</p>';

  const phrase = state.query.trim() || 'najnowsze wiadomości ze świata';
  els.webSearch.href = `https://news.google.com/search?q=${encodeURIComponent(phrase)}&hl=pl&gl=PL&ceid=PL:pl`;
}

function openArticle(id) {
  const article = state.byId.get(id);
  if (!article) return;
  els.articleContent.innerHTML = `
    <p class="kicker">${esc(article.categoryName)} · ${esc(article.source)}</p>
    <h2 class="headline" id="article-title">${esc(article.title)}</h2>
    <p class="byline">${fullDate(article.publishedAt)} · godz. ${timeLabel(article.publishedAt)} · ${esc(article.source)}</p>
    ${imageUrl(article) ? `<img class="article-media" src="${esc(imageUrl(article))}" alt="" />` : ''}
    <div class="article-actions">
      <a class="primary-btn" href="${esc(article.url)}" target="_blank" rel="noopener">Otwórz oryginalny artykuł ↗</a>
      <button class="secondary-btn" type="button" data-show="${esc(article.id)}">Pokaż w gazecie</button>
    </div>
    ${relatedHTML(article)}
    <div class="rule-thin"></div>
    <p class="search-foot">Nagłówek, data i źródło pochodzą bezpośrednio z kanału RSS Google News. Kurier Świata nie dopisuje treści informacyjnej.</p>`;
  els.articleOverlay.hidden = false;
  els.searchOverlay.hidden = true;
}

/* ---------- boot ---------- */

async function checkForUpdates(silent = true) {
  try {
    const response = await fetch(`./data/news.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) return;
    const fresh = await response.json();
    if (fresh.meta.generatedAt !== state.data.meta.generatedAt) {
      toast(silent ? 'Dostępne jest nowsze wydanie — odśwież stronę, aby je zobaczyć.' : 'Wydanie jest aktualne.');
    } else if (!silent) {
      toast('Wydanie jest aktualne.');
    }
    state.lastCheck = Date.now();
  } catch {
    if (!silent) toast('Nie udało się sprawdzić aktualizacji.');
  }
}

function buildShell() {
  const meta = state.data.meta;
  els.edition.innerHTML = `<strong>Wydanie nr ${meta.edition}/${meta.year}</strong><span class="sep">·</span>${esc(meta.printDate)}<span class="sep">·</span>${meta.articleCount} wiadomości<span class="sep">·</span>${meta.sourceCount} źródeł`;

  const headlines = state.data.articles.slice(0, 9);
  els.tickerTrack.innerHTML = headlines
    .map((article) => `<span><b>${esc(article.source)}:</b> ${esc(article.title)} <i>◆</i></span>`)
    .join('');

  els.pagesList.innerHTML = state.data.pages
    .map(
      (page, index) =>
        `<button class="page-dot" type="button" data-page="${index}" title="${esc(page.title)}" aria-label="Strona ${page.number}: ${esc(page.title)}">${page.number}</button>`
    )
    .join('');

  els.searchChips.innerHTML = [
    `<button class="chip ${state.category === 'all' ? 'active' : ''}" type="button" data-cat="all">Wszystkie</button>`,
    ...state.data.categories.map(
      (category) =>
        `<button class="chip ${state.category === category.id ? 'active' : ''}" type="button" data-cat="${esc(category.id)}">${esc(category.name)}</button>`
    )
  ].join('');

  els.sourceNote.textContent = `${meta.note} Wydanie wygenerowano ${fullDate(meta.generatedAt)} o ${timeLabel(meta.generatedAt)}. Źródła: ${meta.sourceLabel}.`;

  if (meta.repository) {
    els.refresh.href = `https://github.com/${meta.repository}/actions/workflows/deploy.yml`;
    els.refresh.title = 'Uruchom akcję GitHub, aby pobrać świeże wiadomości';
  } else {
    els.refresh.href = 'https://docs.github.com/en/actions';
  }
}

function bindEvents() {
  els.home.addEventListener('click', () => {
    els.page.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
    if (state.pageIndex !== 0) goTo(0);
  });

  [els.prev, els.prevSmall, els.first].forEach((button) => button.addEventListener('click', () => goTo(state.pageIndex - 1)));
  [els.next, els.nextSmall, els.last].forEach((button) => button.addEventListener('click', () => goTo(state.pageIndex + 1)));

  els.first.addEventListener('click', () => goTo(0));
  els.last.addEventListener('click', () => goTo(state.data.pages.length - 1));

  els.pagesList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-page]');
    if (button) goTo(Number(button.dataset.page));
  });

  els.page.addEventListener('pointerdown', onPointerDown);
  els.page.addEventListener('pointermove', onPointerMove);
  els.page.addEventListener('pointerup', onPointerUp);
  els.page.addEventListener('pointercancel', onPointerUp);

  els.page.addEventListener('click', (event) => {
    if (state.suppressClick) {
      state.suppressClick = false;
      return;
    }
    const node = event.target.closest('[data-article]');
    if (node) openArticle(node.dataset.article);
  });

  els.searchOpen.addEventListener('click', openSearch);
  els.searchInput.addEventListener('input', () => {
    state.query = els.searchInput.value;
    runSearch();
  });

  els.searchChips.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-cat]');
    if (!chip) return;
    state.category = chip.dataset.cat;
    [...els.searchChips.children].forEach((button) => button.classList.toggle('active', button === chip));
    runSearch();
  });

  els.results.addEventListener('click', (event) => {
    const show = event.target.closest('[data-show]');
    if (show) {
      showInPaper(show.dataset.show);
      return;
    }
    const title = event.target.closest('[data-article]');
    if (title) openArticle(title.dataset.article);
  });

  els.articleContent.addEventListener('click', (event) => {
    const show = event.target.closest('[data-show]');
    if (show) showInPaper(show.dataset.show);
  });

  document.querySelectorAll('[data-close]').forEach((node) => {
    node.addEventListener('click', closeOverlays);
  });

  els.refresh.addEventListener('click', () => toast('Uruchom akcję „Run workflow”, aby pobrać nowe wiadomości.'));

  document.addEventListener('keydown', (event) => {
    const typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName || '');
    if (event.key === 'Escape') {
      closeOverlays();
      return;
    }
    if (typing) return;
    if (event.key === '/') {
      event.preventDefault();
      openSearch();
    } else if (!els.searchOverlay.hidden || !els.articleOverlay.hidden) {
      return;
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      goTo(state.pageIndex + 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      goTo(state.pageIndex - 1);
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && Date.now() - state.lastCheck > 5 * 60 * 1000) checkForUpdates();
  });
}

async function init() {
  try {
    const response = await fetch('./data/news.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.data = await response.json();
    state.byId = new Map(state.data.articles.map((article) => [article.id, article]));
    buildShell();
    renderPage(0);
    bindEvents();
  } catch (error) {
    els.edition.textContent = 'Nie udało się wczytać wydania';
    els.page.innerHTML = `<p class="empty-state">Brak pliku z wiadomościami. Uruchom <code>npm run build</code> lub sprawdź akcję GitHub Actions.</p>`;
    console.error(error);
  }
}

init();
