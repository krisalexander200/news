const crypto = require('node:crypto');
const path = require('node:path');
const express = require('express');
const { XMLParser } = require('fast-xml-parser');
const he = require('he');

const app = express();
const HOST = process.env.HOST || '0.0.0.0';
const PORT = process.env.PORT || 3000;
const CACHE_TTL_MS = 3 * 60 * 1000;
const FEED_TIMEOUT_MS = 8000;
const RESULT_LIMIT = 80;
const USER_AGENT = 'NewsDrip/1.0 (https://github.com/krisalexander200/news)';
// Only sources with documented reuse permissions belong in this allowlist.
// Images and AI rewriting are deliberately absent from the release pipeline.
const SOURCES = [
  {
    name: 'Global Voices',
    url: 'https://globalvoices.org/feed/',
    host: 'globalvoices.org',
    licenseName: 'CC BY 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
    policyUrl: 'https://globalvoices.org/about/global-voices-attribution-policy/'
  },
  {
    name: 'Wikinews',
    url: 'https://en.wikinews.org/w/api.php',
    host: 'en.wikinews.org',
    policyUrl: 'https://en.wikinews.org/wiki/Wikinews:Copyright'
  }
];
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', textNodeName: '#text' });
const cache = { data: null, expiresAt: 0, pending: null };
const asArray = (value) => value == null ? [] : Array.isArray(value) ? value : [value];
function textValue(value) {
  return typeof value === 'string' ? value : value && typeof value === 'object' ? textValue(value['#text']) : '';
}
function cleanText(value) {
  return he.decode(String(value || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}
function validArticleLink(value, host) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === host && !url.username && !url.password ? url.toString() : '';
  } catch { return ''; }
}
function dateFrom(value) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}
function makeStory(source, title, link, author, publishedAt, licenseName, licenseUrl) {
  return {
    id: crypto.createHash('sha1').update(`${source.name}::${link}`).digest('hex').slice(0, 16),
    source: source.name, title, originalTitle: title, link, author, publishedAt,
    tldr: '', image: '',
    attribution: `${author} · ${source.name}`,
    licenseName, licenseUrl, policyUrl: source.policyUrl,
    changes: 'Original headline; article text and images are not reproduced.'
  };
}
function parseGlobalVoices(xml, source = SOURCES[0]) {
  const parsed = parser.parse(xml);
  const entries = asArray(parsed?.rss?.channel?.item);
  if (!parsed?.rss?.channel) throw new Error('Publisher did not return an RSS feed');
  return entries.slice(0, 40).flatMap((entry) => {
    const title = cleanText(textValue(entry.title));
    const author = cleanText(textValue(entry['dc:creator']));
    const link = validArticleLink(textValue(entry.link), source.host);
    const body = textValue(entry['content:encoded']);
    // Guest/partner work and separately licensed text require individual clearance.
    const exception = /guest contributor|republication|originally (?:appeared|published) (?:in|by)|all rights reserved|not (?:covered|available) under|used (?:with|by) permission/i;
    if (!title || !link || !author || exception.test(`${author} ${body}`)) return [];
    return [makeStory(source, title, link, author, dateFrom(textValue(entry.pubDate)), source.licenseName, source.licenseUrl)];
  });
}
async function request(url, fetchImpl = fetch) {
  const response = await fetchImpl(url, {
    signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
    headers: { 'User-Agent': USER_AGENT }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response;
}
function wikiUrl(params) {
  const url = new URL(SOURCES[1].url);
  url.search = new URLSearchParams({ action: 'query', format: 'json', ...params }).toString();
  return url.toString();
}
async function fetchWikinews(fetchImpl = fetch) {
  const source = SOURCES[1];
  const response = await request(wikiUrl({ list: 'categorymembers', cmtitle: 'Category:Published', cmtype: 'page', cmsort: 'timestamp', cmdir: 'desc', cmlimit: '15', cmprop: 'ids|title|timestamp' }), fetchImpl);
  const data = await response.json();
  if (!Array.isArray(data?.query?.categorymembers)) throw new Error('Wikinews did not return published stories');
  const candidates = data.query.categorymembers.filter((entry) => entry.ns === 0);
  // Query each page's creation revision to choose the correct license version.
  const settled = await Promise.allSettled(candidates.map(async (entry) => {
    const detailResponse = await request(wikiUrl({ pageids: String(entry.pageid), prop: 'info|revisions', inprop: 'url', rvprop: 'timestamp', rvdir: 'newer', rvlimit: '1' }), fetchImpl);
    const detail = await detailResponse.json();
    const page = detail?.query?.pages?.[entry.pageid];
    const created = dateFrom(page?.revisions?.[0]?.timestamp);
    const link = validArticleLink(page?.fullurl, source.host);
    const title = cleanText(page?.title);
    if (!created || !link || !title || page.ns !== 0) return null;
    const version = created >= '2024-12-16T00:00:00.000Z' ? '4.0' : created >= '2005-09-25T00:00:00.000Z' ? '2.5' : null;
    if (!version) return null;
    return makeStory(source, title, link, 'Wikinews contributors', dateFrom(entry.timestamp) || created, `CC BY ${version}`, `https://creativecommons.org/licenses/by/${version}/`);
  }));
  const items = settled.flatMap((result) => result.status === 'fulfilled' && result.value ? [result.value] : []);
  if (candidates.length && !items.length) throw new Error('Could not verify Wikinews story attribution and licenses');
  return items;
}
function dedupeAndSort(items) {
  const stories = new Map();
  const oldest = Date.now() - 30 * 24 * 60 * 60 * 1000;
  for (const item of items) {
    const published = Date.parse(item.publishedAt);
    if (published >= oldest && published <= Date.now() + 24 * 60 * 60 * 1000 && !stories.has(item.link)) stories.set(item.link, item);
  }
  return [...stories.values()].sort((a, b) => (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0)).slice(0, RESULT_LIMIT);
}
async function aggregateNews(fetchImpl = fetch) {
  const settled = await Promise.allSettled([
    request(SOURCES[0].url, fetchImpl).then((response) => response.text()).then((xml) => parseGlobalVoices(xml)),
    fetchWikinews(fetchImpl)
  ]);
  const items = [], errors = [];
  settled.forEach((result, index) => {
    if (result.status === 'fulfilled') items.push(...result.value);
    else errors.push({ source: SOURCES[index].name, error: result.reason?.message || 'Source unavailable' });
  });
  return { generatedAt: new Date().toISOString(), items: dedupeAndSort(items), errors };
}
async function getNews(forceRefresh = false) {
  if (!forceRefresh && cache.data && Date.now() < cache.expiresAt) return cache.data;
  if (cache.pending) return cache.pending;
  cache.pending = aggregateNews().then((result) => {
    if (!result.items.length) {
      if (cache.data) return { ...cache.data, stale: true, errors: result.errors };
      throw new Error('News sources are temporarily unavailable. Please try refreshing.');
    }
    cache.data = result;
    cache.expiresAt = Date.now() + CACHE_TTL_MS;
    return result;
  }).finally(() => { cache.pending = null; });
  return cache.pending;
}
const webPublicDir = path.join(__dirname, 'apps', 'web', 'public');
app.use(express.static(webPublicDir));
app.get('/healthz', (req, res) => res.json({ status: 'ok' }));
app.get('/privacy-policy', (req, res) => res.sendFile(path.join(__dirname, 'docs', 'privacy-policy.html')));
app.get('/content-sources', (req, res) => res.sendFile(path.join(__dirname, 'docs', 'content-sources.html')));
app.get('/api/news', async (req, res) => {
  try { res.json(await getNews(req.query.refresh === '1')); }
  catch (error) { res.status(503).json({ error: error.message }); }
});
app.get('*', (req, res) => res.sendFile(path.join(webPublicDir, 'index.html')));
if (require.main === module) app.listen(PORT, HOST, () => console.log(`NewsDrip running on port ${PORT}`));
module.exports = { app, SOURCES, parseGlobalVoices, fetchWikinews, aggregateNews, dedupeAndSort, validArticleLink };
