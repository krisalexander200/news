const newsListEl = document.getElementById('newsList');
const statusLineEl = document.getElementById('statusLine');
const errorBoxEl = document.getElementById('errorBox');
const refreshBtnEl = document.getElementById('refreshBtn');
const tldrBtnEl = document.getElementById('tldrBtn');
const groupBtnEl = document.getElementById('groupBtn');
const storyTemplate = document.getElementById('storyTemplate');
const urgentLeadEl = document.getElementById('urgentLead');
const urgentTitleLinkEl = document.getElementById('urgentTitleLink');
const urgentDetailEl = document.getElementById('urgentDetail');

let latestItems = [];
let tldrMode = true;
let groupedView = true;
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

function setStatus(text) {
  statusLineEl.textContent = text;
}

function showErrors(errors) {
  if (!errors || !errors.length) {
    errorBoxEl.hidden = true;
    errorBoxEl.textContent = '';
    return;
  }

  const message = errors
    .map((entry) => `${entry.source}: ${entry.error}`)
    .join(' | ');

  errorBoxEl.hidden = false;
  errorBoxEl.textContent = `Some sources failed: ${message}`;
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

function pickUrgentStory(items) {
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

function renderUrgentStory(item) {
  if (!item) {
    urgentLeadEl.hidden = true;
    urgentStoryId = null;
    return;
  }

  urgentStoryId = item.id;
  urgentLeadEl.hidden = false;

  urgentTitleLinkEl.href = item.link;
  urgentTitleLinkEl.textContent = item.title;
  urgentDetailEl.hidden = tldrMode;
  if (!tldrMode) {
    urgentDetailEl.textContent = `${item.source} ${formatTime(item.publishedAt)} - ${item.tldr}`;
  }
}

function appendStory(container, item) {
  const node = storyTemplate.content.cloneNode(true);
  const titleLink = node.querySelector('h2 a');
  const detail = node.querySelector('.detail');

  titleLink.href = item.link;
  titleLink.textContent = item.title;
  detail.hidden = tldrMode;
  if (!tldrMode) {
    detail.textContent = `${item.source} ${formatTime(item.publishedAt)} - ${item.tldr}`;
  }

  container.appendChild(node);
}

function classifyTopic(item) {
  const text = `${item.title || ''} ${item.tldr || ''}`.toLowerCase();
  let winner = 'General';
  let winnerScore = 0;

  for (const rule of TOPIC_RULES) {
    let score = 0;
    for (const keyword of rule.keywords) {
      if (text.includes(keyword)) {
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

function renderUngrouped(items) {
  for (const item of items) {
    appendStory(newsListEl, item);
  }
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
    for (const item of group.items) {
      appendStory(list, item);
    }

    section.appendChild(list);
    newsListEl.appendChild(section);
  }
}

function renderStories(items) {
  newsListEl.innerHTML = '';
  newsListEl.classList.toggle('grouped', groupedView);
  newsListEl.classList.toggle('ungrouped', !groupedView);
  const urgentStory = pickUrgentStory(items);
  renderUrgentStory(urgentStory);

  const displayItems = urgentStoryId ? items.filter((item) => item.id !== urgentStoryId) : items;

  if (!displayItems.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'No additional stories available right now.';
    newsListEl.appendChild(empty);
    return;
  }

  if (groupedView) {
    renderGrouped(displayItems);
    return;
  }

  renderUngrouped(displayItems);
}

function syncGroupButton() {
  groupBtnEl.setAttribute('aria-pressed', String(groupedView));
  groupBtnEl.textContent = groupedView ? 'Show Mixed Feed' : 'Group by Topic';
}

function syncTldrButton() {
  tldrBtnEl.setAttribute('aria-pressed', String(tldrMode));
  document.body.classList.toggle('tldr-only', tldrMode);
}

async function loadNews(forceRefresh = false) {
  refreshBtnEl.disabled = true;
  if (forceRefresh) {
    setStatus('Refreshing stories...');
  }

  try {
    const endpoint = forceRefresh ? '/api/news?refresh=1' : '/api/news';
    const response = await fetch(endpoint);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const items = Array.isArray(data.items) ? data.items : [];
    latestItems = items;
    renderStories(items);
    showErrors(data.errors || []);
    setStatus(`Updated ${formatTime(data.generatedAt)} • ${items.length} stories`);
  } catch (error) {
    setStatus('Failed to load stories.');
    showErrors([{ source: 'Aggregator', error: error.message || 'Unknown error' }]);
  } finally {
    refreshBtnEl.disabled = false;
  }
}

refreshBtnEl.addEventListener('click', () => {
  loadNews(true);
});

groupBtnEl.addEventListener('click', () => {
  groupedView = !groupedView;
  syncGroupButton();
  renderStories(latestItems);
});

tldrBtnEl.addEventListener('click', () => {
  tldrMode = !tldrMode;
  syncTldrButton();
  renderStories(latestItems);
});

syncGroupButton();
syncTldrButton();
loadNews();
