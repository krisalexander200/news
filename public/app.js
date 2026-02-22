const newsListEl = document.getElementById('newsList');
const statusLineEl = document.getElementById('statusLine');
const errorBoxEl = document.getElementById('errorBox');
const refreshBtnEl = document.getElementById('refreshBtn');
const storyTemplate = document.getElementById('storyTemplate');

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

function renderStories(items) {
  newsListEl.innerHTML = '';

  if (!items.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'No stories available right now.';
    newsListEl.appendChild(empty);
    return;
  }

  for (const item of items) {
    const node = storyTemplate.content.cloneNode(true);
    const meta = node.querySelector('.meta');
    const titleLink = node.querySelector('h2 a');
    const tldr = node.querySelector('.tldr');

    meta.textContent = `${item.source} | ${formatTime(item.publishedAt)}`;
    titleLink.href = item.link;
    titleLink.textContent = item.title;
    tldr.textContent = item.tldr;

    newsListEl.appendChild(node);
  }
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

loadNews();
