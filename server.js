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
const RESULT_LIMIT = 280;
const USER_AGENT = 'NewsDrip/1.0 (https://github.com/krisalexander200/news)';
// Headline-only source inventory; risk ratings are not claims of permission.
const SOURCES = require('./config/news-sources.json');
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', textNodeName: '#text', processEntities: false });
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
function extractLink(entry) {
  for (const value of asArray(entry.link)) {
    if (typeof value === 'string') return value;
    if (value && (!value['@_rel'] || value['@_rel'] === 'alternate')) return value['@_href'] || textValue(value);
  }
  return '';
}
function safeLink(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.toString() : '';
  } catch { return ''; }
}
function parseFeed(xml, source) {
  const parsed = parser.parse(xml);
  const channel = parsed?.rss?.channel;
  const feed = parsed?.feed;
  const rdf = parsed?.['rdf:RDF'];
  if (!channel && !feed && !rdf) throw new Error('Publisher did not return RSS or Atom');
  return asArray(channel?.item || feed?.entry || rdf?.item).slice(0, 40).flatMap(entry => {
    const title = cleanText(textValue(entry.title));
    const link = safeLink(extractLink(entry));
    const publishedAt = dateFrom(textValue(entry.pubDate) || textValue(entry.published) || textValue(entry.updated) || textValue(entry['dc:date']));
    if (!title || !link || !publishedAt) return [];
    return [{...makeStory(source, title, link, '', publishedAt, '', ''), attribution: source.name}];
  });
}
async function request(url, fetchImpl = fetch) {
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(FEED_TIMEOUT_MS), headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error('HTTP ' + response.status);
  return response;
}
async function fetchSource(source, fetchImpl = fetch) {
  return parseFeed(await (await request(source.url, fetchImpl)).text(), source);
}
function dedupeAndSort(items) {
  const oldest = Date.now() - 7 * 86400000;
  const unique = new Map();
  for (const item of items) {
    const timestamp = Date.parse(item.publishedAt);
    if (!Number.isFinite(timestamp) || timestamp < oldest || timestamp > Date.now() + 86400000) continue;
    // Keep distinct publisher/editorial versions; suppress exact duplicates within a source.
    const key = item.source + '::' + item.link;
    if (!unique.has(key)) unique.set(key, item);
  }
  const groups = new Map();
  for (const item of [...unique.values()].sort((a,b) => Date.parse(b.publishedAt)-Date.parse(a.publishedAt))) {
    if (!groups.has(item.source)) groups.set(item.source, []);
    groups.get(item.source).push(item);
  }
  // Round-robin selection prevents a high-volume outlet crowding out smaller sources.
  const selected = [];
  for (let round = 0; selected.length < RESULT_LIMIT; round++) {
    let added = false;
    for (const group of groups.values()) if (group[round]) { selected.push(group[round]); added = true; }
    if (!added) break;
  }
  return selected.slice(0, RESULT_LIMIT).sort((a,b) => Date.parse(b.publishedAt)-Date.parse(a.publishedAt));
}
async function aggregateNews(fetchImpl = fetch) {
  const settled = await Promise.allSettled(SOURCES.map(source => fetchSource(source, fetchImpl)));
  const items = [], errors = [], sourceStatus = [];
  settled.forEach((result, index) => {
    const source = SOURCES[index];
    if (result.status === 'fulfilled') {
      items.push(...result.value);
      sourceStatus.push({source:source.name, fetched:result.value.length, newest:result.value[0]?.publishedAt || null});
    } else {
      errors.push({source:source.name, error:result.reason?.message || 'Source unavailable'});
      sourceStatus.push({source:source.name, fetched:0, error:result.reason?.message || 'Source unavailable'});
    }
  });
  return {generatedAt:new Date().toISOString(), items:dedupeAndSort(items), errors, sourceStatus};
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
module.exports = { app, SOURCES, parseFeed, fetchSource, aggregateNews, dedupeAndSort, validArticleLink };
