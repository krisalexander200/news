const crypto = require('node:crypto');
const path = require('node:path');

const express = require('express');
const { XMLParser } = require('fast-xml-parser');
const he = require('he');

const app = express();
const PORT = process.env.PORT || 3000;
const CACHE_TTL_MS = 3 * 60 * 1000;
const FEED_ITEM_LIMIT = 30;
const RESULT_LIMIT = 90;

const SOURCES = [
  { name: 'BBC', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { name: 'NPR', url: 'https://feeds.npr.org/1001/rss.xml' },
  { name: 'NYTimes', url: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml' },
  { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' }
];

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  trimValues: true
});

const cache = {
  data: null,
  expiresAt: 0,
  pending: null
};

function asArray(value) {
  if (value === undefined || value === null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function textValue(value) {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const nested = textValue(entry);
      if (nested) {
        return nested;
      }
    }
    return '';
  }

  if (value && typeof value === 'object') {
    if (typeof value['#text'] === 'string') {
      return value['#text'];
    }
    if (typeof value['@_href'] === 'string') {
      return value['@_href'];
    }
    if (typeof value.href === 'string') {
      return value.href;
    }
    if (typeof value.__cdata === 'string') {
      return value.__cdata;
    }
  }

  return '';
}

function stripHtml(input) {
  return input
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
}

function cleanText(input) {
  if (!input) {
    return '';
  }

  return he
    .decode(stripHtml(String(input)))
    .replace(/\s+/g, ' ')
    .trim();
}

function firstSentence(text) {
  const split = text.split(/(?<=[.!?])\s+/);
  if (!split.length) {
    return text;
  }
  return split.find((piece) => piece.length > 30) || split[0] || text;
}

function limitWords(input, maxWords) {
  const words = input.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) {
    return input;
  }
  return `${words.slice(0, maxWords).join(' ')}...`;
}

function tldrFrom(item) {
  const rawDescription =
    textValue(item.description) ||
    textValue(item.summary) ||
    textValue(item['content:encoded']) ||
    textValue(item.content);

  const cleanedDescription = cleanText(rawDescription);
  if (cleanedDescription) {
    return limitWords(firstSentence(cleanedDescription), 18);
  }

  const fallback = cleanText(textValue(item.title));
  return limitWords(fallback || 'No summary available.', 14);
}

function extractLink(item) {
  if (typeof item.link === 'string') {
    return item.link;
  }

  for (const linkValue of asArray(item.link)) {
    if (typeof linkValue === 'string') {
      return linkValue;
    }

    if (linkValue && typeof linkValue === 'object') {
      if (typeof linkValue['@_href'] === 'string') {
        return linkValue['@_href'];
      }
      if (typeof linkValue.href === 'string') {
        return linkValue.href;
      }
    }
  }

  return '';
}

function extractDate(item) {
  const raw =
    textValue(item.pubDate) ||
    textValue(item.published) ||
    textValue(item.updated) ||
    textValue(item['dc:date']);

  const parsed = raw ? new Date(raw) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
}

function normalizeUrl(urlString) {
  try {
    const parsed = new URL(urlString);

    const keep = [];
    for (const [key, value] of parsed.searchParams.entries()) {
      const lower = key.toLowerCase();
      if (lower.startsWith('utm_') || lower === 'gclid' || lower === 'fbclid') {
        continue;
      }
      keep.push([key, value]);
    }

    parsed.search = '';
    for (const [key, value] of keep) {
      parsed.searchParams.append(key, value);
    }

    return parsed.toString();
  } catch {
    return (urlString || '').trim();
  }
}

function itemId(title, link) {
  return crypto
    .createHash('sha1')
    .update(`${title}::${link}`)
    .digest('hex')
    .slice(0, 16);
}

function getRawItems(xml) {
  const rssItems = asArray(xml?.rss?.channel?.item);
  if (rssItems.length) {
    return rssItems;
  }

  const rdfItems = asArray(xml?.['rdf:RDF']?.item);
  if (rdfItems.length) {
    return rdfItems;
  }

  return asArray(xml?.feed?.entry);
}

async function fetchSource(source) {
  const response = await fetch(source.url, {
    headers: {
      'User-Agent': 'MinimalNewsAggregator/1.0 (+local)'
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const xml = await response.text();
  const parsed = parser.parse(xml);
  const rawItems = getRawItems(parsed).slice(0, FEED_ITEM_LIMIT);

  return rawItems
    .map((item) => {
      const title = cleanText(textValue(item.title));
      const link = normalizeUrl(extractLink(item));
      if (!title || !link) {
        return null;
      }

      return {
        id: itemId(title, link),
        source: source.name,
        title,
        link,
        publishedAt: extractDate(item),
        tldr: tldrFrom(item)
      };
    })
    .filter(Boolean);
}

function dedupeAndSort(items) {
  const map = new Map();

  for (const item of items) {
    const key = item.link || item.title.toLowerCase();
    const existing = map.get(key);
    if (!existing) {
      map.set(key, item);
      continue;
    }

    const existingTs = existing.publishedAt ? Date.parse(existing.publishedAt) : 0;
    const currentTs = item.publishedAt ? Date.parse(item.publishedAt) : 0;
    if (currentTs > existingTs) {
      map.set(key, item);
    }
  }

  return Array.from(map.values())
    .sort((a, b) => {
      const aTs = a.publishedAt ? Date.parse(a.publishedAt) : 0;
      const bTs = b.publishedAt ? Date.parse(b.publishedAt) : 0;
      return bTs - aTs;
    })
    .slice(0, RESULT_LIMIT);
}

async function aggregateNews() {
  const settled = await Promise.allSettled(SOURCES.map((source) => fetchSource(source)));

  const items = [];
  const errors = [];

  for (let i = 0; i < settled.length; i += 1) {
    const result = settled[i];
    const source = SOURCES[i];

    if (result.status === 'fulfilled') {
      items.push(...result.value);
      continue;
    }

    errors.push({
      source: source.name,
      error: result.reason?.message || 'Unknown fetch error'
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    items: dedupeAndSort(items),
    errors
  };
}

async function getNews(forceRefresh = false) {
  const now = Date.now();

  if (!forceRefresh && cache.data && now < cache.expiresAt) {
    return cache.data;
  }

  if (cache.pending) {
    return cache.pending;
  }

  cache.pending = aggregateNews()
    .then((result) => {
      cache.data = result;
      cache.expiresAt = Date.now() + CACHE_TTL_MS;
      return result;
    })
    .finally(() => {
      cache.pending = null;
    });

  return cache.pending;
}

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/news', async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === '1';
    const data = await getNews(forceRefresh);
    res.json(data);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to aggregate news.',
      details: error?.message || 'Unknown error'
    });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`News aggregator running at http://localhost:${PORT}`);
});
