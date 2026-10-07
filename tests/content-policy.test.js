const test = require('node:test');
const assert = require('node:assert/strict');
const { SOURCES, parseFeed, aggregateNews, dedupeAndSort } = require('../server');
const source = {name:'Test publisher'};
const now = new Date().toUTCString();
const entry = (link='https://example.com/story') => `<item><title>A &amp; B headline</title><link>${link}</link><pubDate>${now}</pubDate><description>Do not reproduce this text</description><media:thumbnail url="https://example.com/photo.jpg"/></item>`;
const rss = (items) => `<rss><channel>${items}</channel></rss>`;
test('inventory has at least 20 named feeds including Drudge, with explicit risk evidence', () => {
 assert.ok(SOURCES.length >= 20); assert.ok(SOURCES.some(s=>s.name==='Drudge Report'));
 assert.equal(new Set(SOURCES.map(s=>s.name)).size,SOURCES.length);
 assert.ok(SOURCES.every(s=>['High','Medium','Low'].includes(s.risk) && s.reason && s.evidence && s.url.startsWith('https:')));
});
test('RSS preserves headlines but never republishes text, images or invented licenses', () => {
 const [item] = parseFeed(rss(entry()),source);
 assert.equal(item.title,'A & B headline'); assert.equal(item.originalTitle,item.title);
 assert.equal(item.source,source.name); assert.equal(item.tldr,''); assert.equal(item.image,''); assert.equal(item.licenseName,'');
});
test('Atom alternate links and RDF dates are supported', () => {
 const atom = `<feed><entry><title>Atom story</title><link rel="self" href="https://example.com/api"/><link rel="alternate" href="https://example.com/article"/><updated>${new Date().toISOString()}</updated></entry></feed>`;
 assert.equal(parseFeed(atom,source)[0].link,'https://example.com/article');
 const rdf = `<rdf:RDF><item><title>RDF story</title><link>https://example.com/rdf</link><dc:date>${new Date().toISOString()}</dc:date></item></rdf:RDF>`;
 assert.equal(parseFeed(rdf,source).length,1);
});
test('HTML errors and unsafe links are rejected', () => {
 assert.throws(()=>parseFeed('<html>Unavailable</html>',source),/RSS/);
 for(const link of ['javascript:alert(1)','https://name:pass@example.com/story','invalid']) assert.equal(parseFeed(rss(entry(link)),source).length,0);
});
test('old, invalid and excessively future dates are excluded', () => {
 const items = [{link:'old',publishedAt:'2020-01-01'}, {link:'bad',publishedAt:'invalid'}, {link:'future',publishedAt:new Date(Date.now()+3*86400000).toISOString()}, {link:'now',publishedAt:new Date().toISOString()}];
 assert.deepEqual(dedupeAndSort(items).map(i=>i.link),['now']);
});
test('fair selection retains smaller publishers and suppresses exact duplicates', () => {
 const big=Array.from({length:400},(_,i)=>({source:'Big',link:`https://example.com/${i}`,publishedAt:new Date(Date.now()-i*1000).toISOString()}));
 const small={source:'Small',link:'https://small.example/story',publishedAt:new Date(Date.now()-3600000).toISOString()};
 const result=dedupeAndSort([...big,big[0],small]);
 assert.equal(result.length,280); assert.ok(result.some(i=>i.source==='Small')); assert.equal(result.filter(i=>i.link===big[0].link).length,1);
});
test('publisher failures leave the remaining feeds usable and are reported separately',async()=>{
 const result=await aggregateNews(async(url)=>{if(url!==SOURCES[0].url)throw new Error('Outage'); return {ok:true,text:async()=>rss(entry())};});
 assert.equal(result.items.length,1); assert.equal(result.errors.length,SOURCES.length-1);
});
