const test = require('node:test');
const assert = require('node:assert/strict');
const { SOURCES, parseGlobalVoices, aggregateNews, validArticleLink, dedupeAndSort } = require('../server');
const rss = (entry) => `<rss><channel>${entry}</channel></rss>`;
const entry = (extra = '') => `<item><title>A verified original headline</title><link>https://globalvoices.org/2026/10/03/story/</link><dc:creator>Jane Reporter</dc:creator><pubDate>Sat, 03 Oct 2026 12:00:00 GMT</pubDate><description>Feed summary must not be redistributed</description><media:thumbnail url="https://example.com/unlicensed.jpg"/>${extra}</item>`;
const response = (body, json = false) => ({ ok: true, text: async () => body, json: async () => json ? body : JSON.parse(body) });

test('only documented sources are configured', () => {
  assert.deepEqual(SOURCES.map((s) => s.name), ['Global Voices', 'Wikinews']);
  assert.ok(SOURCES.every((s) => s.policyUrl.startsWith('https://')));
});
test('original headline has author and license without excerpts or images', () => {
  const [item] = parseGlobalVoices(rss(entry()));
  assert.equal(item.title, 'A verified original headline');
  assert.equal(item.originalTitle, item.title);
  assert.equal(item.author, 'Jane Reporter');
  assert.equal(item.licenseName, 'CC BY 3.0');
  assert.equal(item.image, ''); assert.equal(item.tldr, '');
});
test('guest and explicitly restricted entries fail closed', () => {
  assert.equal(parseGlobalVoices(rss(entry().replace('Jane Reporter', 'Guest Contributor'))).length, 0);
  assert.equal(parseGlobalVoices(rss(entry('<content:encoded>All rights reserved</content:encoded>'))).length, 0);
  assert.equal(parseGlobalVoices(rss(entry().replace('<dc:creator>Jane Reporter</dc:creator>', ''))).length, 0);
});
test('HTML error pages are rejected rather than cached as successful feeds', () => {
  assert.throws(() => parseGlobalVoices('<html>Unavailable</html>'), /RSS/);
});
test('external, credential-bearing and non-HTTPS article links are excluded', () => {
  for (const link of ['http://globalvoices.org/story', 'https://evil.test/story', 'https://name:pass@globalvoices.org/story', 'javascript:alert(1)']) assert.equal(validArticleLink(link, 'globalvoices.org'), '');
});
test('Wikinews creation dates select license version and no AI or legacy source is fetched', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url); const u = new URL(url);
    if (u.hostname === 'globalvoices.org') return response(rss(entry()));
    assert.equal(u.hostname, 'en.wikinews.org');
    if (u.searchParams.get('list')) return response({query:{categorymembers:[{ns:0,pageid:1,timestamp:'2026-10-03T12:00:00Z'},{ns:0,pageid:2,timestamp:'2026-10-02T12:00:00Z'}]}},true);
    const id = Number(u.searchParams.get('pageids'));
    return response({query:{pages:{[id]:{ns:0,title:`Story ${id}`,fullurl:`https://en.wikinews.org/wiki/Story_${id}`,revisions:[{timestamp:id===1?'2026-10-01T12:00:00Z':'2020-01-01T12:00:00Z'}]}}}},true);
  };
  const result = await aggregateNews(fetchImpl);
  assert.equal(result.items.length, 3);
  assert.equal(result.items.find(i=>i.title==='Story 1').licenseName,'CC BY 4.0');
  assert.equal(result.items.find(i=>i.title==='Story 2').licenseName,'CC BY 2.5');
  assert.ok(result.items.every(i=>!i.image && !i.tldr && i.title===i.originalTitle));
  assert.equal(calls.length,4);
});
test('one failed publisher leaves the other source usable', async () => {
  const result = await aggregateNews(async (url) => {
    if(new URL(url).hostname==='globalvoices.org') return response(rss(entry()));
    throw new Error('Publisher outage');
  });
  assert.equal(result.items.length,1); assert.equal(result.errors.length,1);
});

test('archived and invalid-date articles cannot appear as current news', () => {
  const stories = [{link:'old',publishedAt:'2020-01-01'}, {link:'invalid',publishedAt:null}, {link:'current',publishedAt:new Date().toISOString()}];
  assert.deepEqual(dedupeAndSort(stories).map(s=>s.link), ['current']);
});
