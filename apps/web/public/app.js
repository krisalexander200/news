const newsListEl = document.getElementById('newsList');
const errorBoxEl = document.getElementById('errorBox');
const topbarEl = document.querySelector('.topbar');
const storyTemplate = document.getElementById('storyTemplate');
const urgentLeadEl = document.getElementById('urgentLead');
const urgentTitleLinkEl = document.getElementById('urgentTitleLink');
const relatedLinksEl = document.getElementById('relatedLinks');
const urgentDetailEl = document.getElementById('urgentDetail');

let latestItems = [];
let urgentStoryId = null;

const TOPIC_RULES = [
  { name: 'Politics', keywords: ['election', 'senate', 'congress', 'parliament', 'president', 'prime minister', 'government', 'policy', 'campaign', 'vote'] },
  { name: 'Conflict', keywords: ['war', 'military', 'missile', 'attack', 'ceasefire', 'troops', 'airstrike', 'hostage', 'defense', 'conflict'] },
  { name: 'Business', keywords: ['market', 'stocks', 'economy', 'inflation', 'interest rate', 'fed', 'earnings', 'trade', 'tariff', 'company'] },
  { name: 'Technology', keywords: ['artificial intelligence', 'ai', 'software', 'cyber', 'chip', 'startup', 'data breach', 'app', 'tech'] },
  { name: 'Health', keywords: ['health', 'hospital', 'disease', 'virus', 'vaccine', 'medical', 'outbreak'] },
  { name: 'Climate', keywords: ['climate', 'storm', 'hurricane', 'flood', 'wildfire', 'earthquake', 'heatwave', 'emissions'] },
  { name: 'Science', keywords: ['space', 'nasa', 'research', 'study', 'scientist', 'astronomy'] },
  { name: 'Sports', keywords: ['nba', 'nfl', 'mlb', 'nhl', 'soccer', 'football', 'tennis', 'olympic', 'tournament', 'match'] },
  { name: 'Culture', keywords: ['movie', 'music', 'tv', 'celebrity', 'festival', 'book', 'award', 'art'] },
  { name: 'Crime', keywords: ['police', 'shooting', 'killed', 'arrest', 'charged', 'trial', 'investigation', 'crime'] }
];

const URGENCY_RULES = [
  { term: 'breaking', weight: 6 },
  { term: 'urgent', weight: 5 },
  { term: 'live', weight: 4 },
  { term: 'alert', weight: 4 },
  { term: 'emergency', weight: 4 },
  { term: 'attack', weight: 4 },
  { term: 'killed', weight: 4 },
  { term: 'war', weight: 3 },
  { term: 'earthquake', weight: 4 },
  { term: 'wildfire', weight: 3 },
  { term: 'hurricane', weight: 3 },
  { term: 'evacuat', weight: 3 },
  { term: 'outbreak', weight: 3 },
  { term: 'explosion', weight: 3 },
  { term: 'hostage', weight: 3 },
  { term: 'ceasefire', weight: 2 }
];

const NON_LATIN_SCRIPT_PATTERN = /[\u0400-\u04FF\u0590-\u05FF\u0600-\u06FF\u0900-\u097F\u0E00-\u0E7F\u1100-\u11FF\u3040-\u30FF\u3400-\u9FFF]/;

const STOP_WORDS = new Set([
  'about', 'after', 'again', 'against', 'among', 'around', 'because', 'being', 'before', 'between', 'could', 'during', 'first',
  'from', 'have', 'into', 'just', 'more', 'most', 'over', 'said', 'than', 'that', 'their', 'there', 'these', 'they', 'this',
  'those', 'through', 'under', 'very', 'were', 'what', 'when', 'where', 'which', 'while', 'will', 'with', 'would'
]);

function isLikelyEnglishTitle(text) {
  const value = String(text || '').trim();
  if (!value) {
    return false;
  }

  if (NON_LATIN_SCRIPT_PATTERN.test(value)) {
    return false;
  }

  const letters = value.match(/[A-Za-z\u00C0-\u024F]/g) || [];
  const asciiLetters = value.match(/[A-Za-z]/g) || [];
  if (!letters.length || !asciiLetters.length) {
    return false;
  }

  return asciiLetters.length / letters.length >= 0.7;
}

function formatTime(isoString) {
  if (!isoString) {
    return 'time unknown';
  }

  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return 'time unknown';
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
}

function showErrors(errors) {
  errorBoxEl.hidden = true;
  errorBoxEl.textContent = '';

  if (errors && errors.length) {
    // Feed-level failures should not interrupt the reading experience.
    // Keep visibility in developer tools only.
    // eslint-disable-next-line no-console
    console.debug('Suppressed feed source errors:', errors);
  }
}

function recencyScore(isoString) {
  if (!isoString) {
    return 0;
  }

  const timestamp = Date.parse(isoString);
  if (!timestamp) {
    return 0;
  }

  const hoursOld = Math.max(0, (Date.now() - timestamp) / (1000 * 60 * 60));
  if (hoursOld <= 1) {
    return 5;
  }
  if (hoursOld <= 3) {
    return 4;
  }
  if (hoursOld <= 8) {
    return 3;
  }
  if (hoursOld <= 18) {
    return 2;
  }
  if (hoursOld <= 36) {
    return 1;
  }
  return 0;
}

function urgencyScore(item) {
  const text = `${item.title || ''} ${item.tldr || ''}`.toLowerCase();
  let score = recencyScore(item.publishedAt);

  for (const rule of URGENCY_RULES) {
    if (text.includes(rule.term)) {
      score += rule.weight;
    }
  }

  return score;
}

function pickTopByUrgency(items) {
  if (!items.length) {
    return null;
  }

  const ranked = items
    .map((item) => ({
      item,
      score: urgencyScore(item),
      timestamp: item.publishedAt ? Date.parse(item.publishedAt) : 0
    }))
    .sort((a, b) => b.score - a.score || b.timestamp - a.timestamp);

  const lead = ranked[0];
  if (lead && lead.score > 0) {
    return lead.item;
  }

  return items[0];
}

function pickUrgentStory(items) {
  return items.length ? pickTopByUrgency(items) : null;
}

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4 && !STOP_WORDS.has(token));
}

function overlapCount(leftTokens, rightTokens) {
  const rightSet = new Set(rightTokens);
  let count = 0;
  for (const token of leftTokens) {
    if (rightSet.has(token)) {
      count += 1;
    }
  }
  return count;
}

function pickRelatedStories(anchorStory, pool) {
  if (!anchorStory || !pool.length) {
    return [];
  }

  // Match source headlines: rewritten titles and summaries can add generic words.
  const anchorTokens = [...new Set(tokenize(anchorStory.originalTitle || anchorStory.title))];

  return pool
    .filter((item) => item.id !== anchorStory.id)
    .map((item) => {
      const itemTokens = [...new Set(tokenize(item.originalTitle || item.title))];
      const shared = overlapCount(anchorTokens, itemTokens);
      const coverage = shared / Math.max(1, Math.min(anchorTokens.length, itemTokens.length));

      return {
        item,
        shared,
        coverage,
        timestamp: item.publishedAt ? Date.parse(item.publishedAt) || 0 : 0
      };
    })
    // Category and publisher alone never establish a connection.
    .filter((entry) => entry.shared >= 3 && entry.coverage >= 0.5)
    .sort((a, b) => b.coverage - a.coverage || b.shared - a.shared || b.timestamp - a.timestamp)
    .slice(0, 3)
    .map((entry) => entry.item);
}

function appendAttribution(container, item) {
  const credit = document.createElement('p');
  credit.className = 'source-credit';
  credit.textContent = item.attribution || item.source;
  const license = document.createElement('a');
  license.className = 'license-link';
  license.href = item.licenseUrl;
  license.target = '_blank';
  license.rel = 'noopener noreferrer';
  license.textContent = item.licenseName || '';
  container.appendChild(credit);
  if (item.licenseName && item.licenseUrl) container.appendChild(license);
}

function renderRelatedLinks(relatedStories) {
  relatedLinksEl.replaceChildren();
  relatedLinksEl.hidden = !relatedStories.length;
  for (const story of relatedStories) {
    const row = document.createElement('div');
    const link = document.createElement('a');
    link.href = story.link;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = story.title;
    row.appendChild(link);
    appendAttribution(row, story);
    relatedLinksEl.appendChild(row);
  }
}

function renderUrgentStory(item, relatedStories) {
  urgentLeadEl.hidden = !item;
  urgentStoryId = item ? item.id : null;
  if (!item) return;
  urgentTitleLinkEl.href = item.link;
  urgentTitleLinkEl.textContent = item.title;
  const attribution = document.getElementById('urgentAttribution');
  attribution.replaceChildren();
  appendAttribution(attribution, item);
  renderRelatedLinks(relatedStories);
  urgentDetailEl.hidden = true;
  urgentDetailEl.textContent = '';
}

function appendStory(container, item) {
  const node = storyTemplate.content.cloneNode(true);
  const titleLink = node.querySelector('h2 a');
  const detail = node.querySelector('.detail');
  appendAttribution(node.querySelector('.attribution'), item);
  titleLink.href = item.link;
  titleLink.textContent = item.title;
  detail.hidden = true;
  detail.textContent = '';
  container.appendChild(node);
}

function classifyTopic(item) {
  const text = `${item.title || ''} ${item.tldr || ''}`.toLowerCase();
  let winner = 'General';
  let winnerScore = 0;

  for (const rule of TOPIC_RULES) {
    let score = 0;
    for (const keyword of rule.keywords) {
      if (new RegExp(`\\b${keyword}\\b`, 'i').test(text)) {
        score += 1;
      }
    }

    if (score > winnerScore) {
      winner = rule.name;
      winnerScore = score;
    }
  }

  return winner;
}

function groupStories(items) {
  const grouped = new Map();
  for (const item of items) {
    const topic = classifyTopic(item);
    if (!grouped.has(topic)) {
      grouped.set(topic, []);
    }
    grouped.get(topic).push(item);
  }

  const topicOrder = TOPIC_RULES.map((rule) => rule.name).concat('General');
  return topicOrder
    .filter((topic) => grouped.has(topic))
    .map((topic) => ({ topic, items: grouped.get(topic) }));
}

function renderGrouped(items) {
  const groups = groupStories(items);
  for (const group of groups) {
    const section = document.createElement('section');
    section.className = 'topic-group';

    const heading = document.createElement('h3');
    heading.className = 'topic-title';
    heading.textContent = `${group.topic} (${group.items.length})`;
    section.appendChild(heading);

    const list = document.createElement('div');
    list.className = 'topic-list';
    for (const item of group.items) appendStory(list, item);

    section.appendChild(list);
    newsListEl.appendChild(section);
  }
}

function renderStories(items) {
  newsListEl.innerHTML = '';
  newsListEl.classList.add('grouped');
  newsListEl.classList.remove('ungrouped');
  const urgentStory = pickUrgentStory(items);
  const featuredId = urgentStory ? urgentStory.id : null;

  const displayItems = featuredId ? items.filter((item) => item.id !== featuredId) : items;
  const relatedStories = pickRelatedStories(urgentStory, displayItems);
  renderUrgentStory(urgentStory, relatedStories);

  if (!displayItems.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'No additional stories available right now.';
    newsListEl.appendChild(empty);
    return;
  }

  renderGrouped(displayItems);
}

function syncStickyOffsets() {
  if (!topbarEl) {
    return;
  }

  const topbarHeight = Math.ceil(topbarEl.getBoundingClientRect().height);
  document.documentElement.style.setProperty('--sticky-topbar-height', `${topbarHeight}px`);
}

async function loadNews(forceRefresh = false) {
  try {
    const response = await fetch(forceRefresh ? '/api/news?refresh=1' : '/api/news');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const items = (Array.isArray(data.items) ? data.items : []).filter((item) => isLikelyEnglishTitle(item.title));
    latestItems = items;
    renderStories(items);
    showErrors(data.errors || []);
    if (data.stale) {
      errorBoxEl.hidden = false;
      errorBoxEl.textContent = 'Showing previously loaded headlines. Tap Refresh to try updating again.';
    }
  } catch (error) {
    errorBoxEl.hidden = false;
    errorBoxEl.textContent = 'News could not load. Check your connection and tap Refresh to try again.';
  }
}

window.addEventListener('resize', syncStickyOffsets);
syncStickyOffsets();
document.body.classList.add('tldr-only');
loadNews();

const refreshBtn = document.getElementById('refreshBtn');
refreshBtn.addEventListener('click', async () => {
  refreshBtn.disabled = true;
  try { await loadNews(true); } finally { refreshBtn.disabled = false; }
});
