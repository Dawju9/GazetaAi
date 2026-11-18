import { mkdir, readFile, writeFile, copyFile, rm, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const DIST_IMG = path.join(DIST, 'assets', 'img');
const SEED = path.join(ROOT, 'data');
const SEED_IMG = path.join(SEED, 'img');
const OUT_FILE = path.join(DIST, 'data', 'news.json');
const SEED_FILE = path.join(SEED, 'news.json');

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const NOW = new Date();

const FEEDS = [
  { id: 'swiat', name: 'Świat', topic: 'WORLD', priority: 6, limit: 14 },
  { id: 'kraj', name: 'Kraj', topic: 'NATION', priority: 5, limit: 12 },
  { id: 'biznes', name: 'Biznes', topic: 'BUSINESS', priority: 4, limit: 12 },
  { id: 'technologia', name: 'Technologia', topic: 'TECHNOLOGY', priority: 3, limit: 10 },
  { id: 'sport', name: 'Sport', topic: 'SPORTS', priority: 2, limit: 10 },
  { id: 'kultura', name: 'Kultura', topic: 'ENTERTAINMENT', priority: 2, limit: 8 },
  { id: 'nauka', name: 'Nauka', topic: 'SCIENCE', priority: 2, limit: 8 },
  { id: 'zdrowie', name: 'Zdrowie', topic: 'HEALTH', priority: 1, limit: 8 }
];

const feedUrl = (topic) =>
  `https://news.google.com/rss/headlines/section/topic/${topic}?hl=pl&gl=PL&ceid=PL:pl`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function decodeEntities(input = '') {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'");
}

function tag(block, name) {
  const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'));
  return match ? decodeEntities(match[1]).trim() : '';
}

function stripTags(value = '') {
  return decodeEntities(value.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function hashId(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, '0');
}

function normalizeTitle(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function parseRelated(description) {
  const items = [...description.matchAll(/<li>([\s\S]*?)<\/li>/gi)]
    .map((match) => {
      const link = match[1].match(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
      const source = match[1].match(/<font[^>]*>([\s\S]*?)<\/font>/i);
      if (!link) return null;
      return {
        title: stripTags(link[2]),
        source: source ? stripTags(source[1]) : '',
        url: decodeEntities(link[1])
      };
    })
    .filter((item) => item && item.title);
  return items.slice(1, 4);
}

function parseFeed(xml, feed) {
  const blocks = xml.split('<item>').slice(1);
  const articles = [];

  for (const raw of blocks) {
    const block = raw.split('</item>')[0];
    const rawTitle = tag(block, 'title');
    const sourceNode = block.match(/<source\s+url="([^"]+)"[^>]*>([\s\S]*?)<\/source>/i);
    const source = sourceNode ? stripTags(sourceNode[2]) : rawTitle.split(' - ').pop().trim();
    let title = sourceNode ? rawTitle : rawTitle.replace(/\s+-\s+[^-]+$/, '');
    if (title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3));
    title = stripTags(title);
    const url = tag(block, 'link');
    const publishedAt = new Date(tag(block, 'pubDate'));
    const age = NOW.getTime() - publishedAt.getTime();

    if (!title || !url || Number.isNaN(age) || age < -60 * 60 * 1000 || age > WEEK_MS) continue;

    articles.push({
      id: hashId(url),
      title,
      source,
      sourceUrl: sourceNode ? decodeEntities(sourceNode[1]) : '',
      url,
      publishedAt: publishedAt.toISOString(),
      category: feed.id,
      categoryName: feed.name,
      related: parseRelated(tag(block, 'description')),
      ageHours: age / 3600000,
      categoryPriority: feed.priority
    });
  }

  return articles;
}

async function fetchFeed(feed) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(feedUrl(feed.topic), {
      signal: controller.signal,
      headers: { 'User-Agent': 'GazetaAi/1.0 (+https://github.com)', Accept: 'application/rss+xml, application/xml' }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const parsed = parseFeed(await response.text(), feed);
    console.log(`  ${feed.name}: ${parsed.length} wiadomości z ostatnich 7 dni`);
    return parsed;
  } catch (error) {
    console.warn(`  ${feed.name}: pominięto (${error.message})`);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

function uniqueArticles(articles) {
  const seen = new Set();
  return articles
    .sort((a, b) => a.ageHours - b.ageHours)
    .filter((article) => {
      const key = normalizeTitle(article.title);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function score(article) {
  return Math.max(0, 100 - article.ageHours * 0.75) + article.related.length * 2 + article.categoryPriority * 2;
}

const NEWS_UA = 'Mozilla/5.0 (compatible; GazetaAi/1.0)';
const NEWS_COOKIE = 'CONSENT=YES+cb; SOCS=CAI';

async function fetchHtml(url, cookie) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': NEWS_UA,
        Accept: 'text/html',
        ...(cookie ? { Cookie: cookie } : {})
      }
    });
    return response.ok ? response.text() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function extractImages(html, base) {
  const found = [];
  const add = (value, kind = 'photo') => {
    if (!value) return;
    try {
      const url = new URL(decodeEntities(value.trim()), base).href;
      if (/^https?:\/\//.test(url) && !found.some((item) => item.url === url)) found.push({ url, kind });
    } catch {}
  };

  const patterns = [
    /<meta[^>]+property=["']og:image(?::url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::url)?["']/i,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i,
    /<meta[^>]+itemprop=["']image["'][^>]+content=["']([^"']+)["']/i,
    /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i
  ];
  patterns.forEach((pattern) => add(html.match(pattern)?.[1]));

  for (const match of html.matchAll(/"image"\s*:\s*("(?:[^"\\]|\\.)+"|\[[\s\S]{0,400}?\])/gi)) {
    try {
      const parsed = JSON.parse(match[1]);
      const value = Array.isArray(parsed) ? parsed[0] : parsed;
      add(typeof value === 'string' ? value : value?.url);
    } catch {}
  }

  for (const match of html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)) {
    if (/(logo|icon|sprite|pixel|avatar|blank|placeholder|tracking)/i.test(match[1])) continue;
    add(match[1]);
  }
  return found;
}

function faviconUrl(article) {
  try {
    const host = new URL(article.sourceUrl || article.url).hostname;
    return host ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128` : null;
  } catch {
    return null;
  }
}

async function resolvePublisherUrl(article) {
  const id = new URL(article.url).pathname.split('/articles/')[1];
  if (!id) return null;
  const html = await fetchHtml(`https://news.google.com/rss/articles/${id}`, NEWS_COOKIE);
  if (!html) return null;
  const signature = html.match(/data-n-a-sg="([^"]+)"/)?.[1];
  const timestamp = html.match(/data-n-a-ts="([^"]+)"/)?.[1];
  if (!signature || !timestamp) return null;

  const request = `["garturlreq",[["X","X",["X","X"],null,null,1,1,"US:en",null,1,null,null,null,null,null,0,1],"X","X",1,[1,1,1],1,1,null,0,0,null,0],"${id}",${timestamp},"${signature}"]`;
  const body = new URLSearchParams({ 'f.req': JSON.stringify([[['Fbv4je', request, null, 'generic']]]) });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch('https://news.google.com/_/DotsSplashUi/data/batchexecute', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'User-Agent': NEWS_UA,
        Cookie: NEWS_COOKIE,
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
      },
      body
    });
    if (!response.ok) return null;
    const raw = await response.text();
    const line = raw.split('\n\n')[1];
    if (!line) return null;
    const row = JSON.parse(line)[0]?.[2];
    if (!row) return null;
    const url = JSON.parse(row)[1];
    return typeof url === 'string' && /^https?:\/\//.test(url) ? url : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function downloadImage(imageUrl, article, kind) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(imageUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': NEWS_UA, Accept: 'image/avif,image/webp,image/apng,image/*,*/*' }
    });
    if (!response.ok) return null;
    const type = response.headers.get('content-type') || '';
    if (!type.startsWith('image/')) return null;
    const ext = type.includes('jpeg') || type.includes('jpg') ? 'jpg' : type.includes('webp') ? 'webp' : 'png';
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 200 || bytes.length > 3_000_000) return null;
    const filename = `${article.id}${kind === 'logo' ? '-logo' : ''}.${ext}`;
    await writeFile(path.join(DIST_IMG, filename), bytes);
    return `assets/img/${filename}`;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function enrichImages(articles, ids) {
  const targets = articles.filter((article) => ids.has(article.id)).slice(0, 80);
  const queue = [...targets];
  const workers = Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const article = queue.shift();
      let publisherHtml = null;
      const publisherUrl = await resolvePublisherUrl(article);
      if (publisherUrl) {
        article.googleUrl = article.url;
        article.url = publisherUrl;
        publisherHtml = await fetchHtml(publisherUrl);
      }

      if (publisherHtml) {
        for (const candidate of extractImages(publisherHtml, publisherUrl).slice(0, 3)) {
          const local = await downloadImage(candidate.url, article, candidate.kind);
          if (local) {
            article.image = local;
            article.imageKind = candidate.kind;
            break;
          }
        }
      }

      if (!article.image) {
        const fallback = faviconUrl(article);
        const local = fallback && (await downloadImage(fallback, article, 'logo'));
        if (local) {
          article.image = local;
          article.imageKind = 'logo';
        }
      }
      await sleep(200);
    }
  });
  await Promise.all(workers);
  console.log(
    `  Rozwiązano ${targets.filter((a) => a.googleUrl).length} adresów wydawców, pobrano ${targets.filter((a) => a.imageKind === 'photo').length} zdjęć i ${targets.filter((a) => a.imageKind === 'logo').length} miniatur`
  );
}

function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

function buildPages(articles, categories) {
  const pages = [];
  const frontIds = articles.slice(0, 6).map((article) => article.id);
  pages.push({ number: 1, kind: 'front', title: 'Strona 1', label: 'Czołówka', articleIds: frontIds });

  categories.forEach((category) => {
    const items = articles.filter((article) => article.category === category.id).slice(0, 10);
    if (!items.length) return;
    pages.push({
      number: pages.length + 1,
      kind: 'section',
      title: category.name,
      label: category.name,
      articleIds: items.map((article) => article.id)
    });
  });

  pages.push({
    number: pages.length + 1,
    kind: 'index',
    title: 'Indeks',
    label: 'Wszystkie wiadomości',
    articleIds: articles.map((article) => article.id)
  });

  return pages;
}

function cleanArticle(article) {
  delete article.ageHours;
  delete article.categoryPriority;
  article.image = article.image || null;
  return article;
}

async function prepareDist() {
  await rm(DIST, { recursive: true, force: true });
  await mkdir(path.join(DIST, 'data'), { recursive: true });
  await mkdir(DIST_IMG, { recursive: true });
  for (const file of ['index.html', 'styles.css', 'app.js']) {
    await copyFile(path.join(ROOT, 'src', file), path.join(DIST, file));
  }
  await writeFile(path.join(DIST, '.nojekyll'), '');
}

async function updateSeed(data) {
  await mkdir(SEED_IMG, { recursive: true });
  for (const file of await readdir(SEED_IMG)) {
    await rm(path.join(SEED_IMG, file), { force: true });
  }
  for (const filename of await readdir(DIST_IMG)) {
    await copyFile(path.join(DIST_IMG, filename), path.join(SEED_IMG, filename));
  }
  await writeFile(SEED_FILE, `${JSON.stringify(data, null, 2)}\n`);
}

async function useSeed() {
  const raw = await readFile(SEED_FILE, 'utf8');
  const data = JSON.parse(raw);
  for (const filename of await readdir(SEED_IMG)) {
    await copyFile(path.join(SEED_IMG, filename), path.join(DIST_IMG, filename));
  }
  await writeFile(OUT_FILE, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`  Użyto zapisanego wydania z ${data.meta.generatedAt}`);
  return data;
}

async function main() {
  console.log('Pobieranie prawdziwych wiadomości z ostatnich 7 dni...');
  await prepareDist();

  const fetched = (await Promise.all(FEEDS.map(fetchFeed))).flat();
  let data;

  if (fetched.length < 8) {
    console.warn('Za mało świeżych wiadomości — używam ostatniego zapisanego wydania.');
    data = await useSeed();
  } else {
    const articles = uniqueArticles(fetched);
    articles.forEach((article, index) => {
      article.score = score(article);
      article.position = index;
    });

    articles.sort((a, b) => b.score - a.score || a.position - b.position);

    const quotas = { swiat: 28, kraj: 24, biznes: 18, technologia: 14, sport: 12, kultura: 10, nauka: 9, zdrowie: 9 };
    const selected = [];
    const usedIds = new Set();
    FEEDS.forEach((feed) => {
      articles
        .filter((article) => article.category === feed.id)
        .slice(0, quotas[feed.id] || 10)
        .forEach((article) => {
          if (selected.length >= 120 || usedIds.has(article.id)) return;
          selected.push(article);
          usedIds.add(article.id);
        });
    });
    for (const article of articles) {
      if (selected.length >= 120) break;
      if (!usedIds.has(article.id)) {
        selected.push(article);
        usedIds.add(article.id);
      }
    }
    selected.sort((a, b) => b.score - a.score || a.position - b.position);
    const pages = buildPages(selected, FEEDS);

    const imageIds = new Set();
    pages.forEach((page) => {
      const limit = page.kind === 'front' ? 3 : page.kind === 'section' ? 7 : 0;
      page.articleIds.slice(0, limit).forEach((id) => imageIds.add(id));
    });
    await enrichImages(selected, imageIds);

    data = {
      meta: {
        title: 'Kurier Świata',
        generatedAt: NOW.toISOString(),
        weekStart: new Date(NOW.getTime() - WEEK_MS).toISOString(),
        weekEnd: NOW.toISOString(),
        edition: isoWeek(NOW),
        year: NOW.getFullYear(),
        printDate: new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' }).format(NOW),
        articleCount: selected.length,
        sourceCount: new Set(selected.map((article) => article.source)).size,
        repository: process.env.GITHUB_REPOSITORY || '',
        branch: process.env.GITHUB_REF_NAME || '',
        note: 'Nagłówki, daty i linki pochodzą z kanałów RSS Google News. Gazeta nie generuje treści informacyjnej.',
        sourceLabel: 'Google News / wydawcy oryginalni'
      },
      categories: FEEDS.map((feed) => ({
        id: feed.id,
        name: feed.name,
        count: selected.filter((article) => article.category === feed.id && usedIds.has(article.id)).length
      })),
      pages,
      articles: selected.map(cleanArticle)
    };

    await writeFile(OUT_FILE, `${JSON.stringify(data, null, 2)}\n`);
    await updateSeed(data);
    console.log(`  Gotowe: ${selected.length} artykułów, ${pages.length} stron, ${data.meta.sourceCount} źródeł`);
  }
}

main().catch((error) => {
  console.error('Błąd budowy gazety:', error);
  process.exitCode = 1;
});
