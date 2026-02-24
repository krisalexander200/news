import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Linking,
  NativeModules,
  Platform,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View
} from 'react-native';
import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

function isPlaceholderApiBaseUrl(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return (
    normalized.includes('your-render-service.onrender.com') ||
    normalized.includes('your-api') ||
    normalized.includes('example.com')
  );
}

function extractHost(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }

  const withScheme = raw.includes('://') ? raw : `http://${raw}`;
  const match = withScheme.match(/^[a-zA-Z]+:\/\/([^/:]+)/);
  if (!match) {
    return '';
  }

  const host = match[1].toLowerCase();
  if (!host || host === 'localhost' || host === '127.0.0.1' || host === '::1') {
    return '';
  }

  return host;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function buildApiBaseCandidates(configuredBaseUrl) {
  const cleanedConfigured = String(configuredBaseUrl || '').trim();
  if (cleanedConfigured) {
    return [cleanedConfigured.replace(/\/$/, '')];
  }

  // Store/TestFlight builds must use a real deployed API URL.
  // Localhost fallbacks are only valid in local development.
  if (!__DEV__) {
    return [];
  }

  const hostCandidates = unique([
    extractHost(NativeModules?.SourceCode?.scriptURL),
    extractHost(Constants.linkingUri),
    extractHost(Constants.experienceUrl),
    extractHost(Constants.expoConfig?.hostUri),
    extractHost(Constants.expoGoConfig?.debuggerHost),
    extractHost(Constants.manifest?.debuggerHost),
    extractHost(Constants.manifest2?.extra?.expoClient?.hostUri)
  ]);

  const bases = hostCandidates.map((host) => `http://${host}:3000`);
  if (Platform.OS === 'android') {
    bases.push('http://10.0.2.2:3000');
  } else if (Platform.OS === 'ios') {
    bases.push('http://localhost:3000');
  } else {
    bases.push('http://localhost:3000');
    bases.push('http://10.0.2.2:3000');
  }

  return unique(bases.map((entry) => entry.replace(/\/$/, '')));
}

async function fetchFromCandidates(baseCandidates, forceRefresh) {
  const endpointPath = `/api/news${forceRefresh ? '?refresh=1' : ''}`;
  if (!baseCandidates.length) {
    throw new Error(
      'No API base URL configured for this build. Set EXPO_PUBLIC_API_BASE_URL to your deployed API and rebuild.'
    );
  }

  let lastError = new Error('Unable to reach API');

  for (const baseUrl of baseCandidates) {
    try {
      const response = await fetch(`${baseUrl}${endpointPath}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return { data, baseUrl };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

const RAW_CONFIGURED_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  Constants.expoConfig?.extra?.apiBaseUrl ||
  '';
const CONFIGURED_BASE_URL = isPlaceholderApiBaseUrl(RAW_CONFIGURED_BASE_URL)
  ? ''
  : String(RAW_CONFIGURED_BASE_URL).trim();
const API_BASE_CANDIDATES = buildApiBaseCandidates(CONFIGURED_BASE_URL);

const TOPIC_RULES = [
  { name: 'Politics', keywords: ['election', 'senate', 'congress', 'parliament', 'president', 'government', 'policy'] },
  { name: 'Conflict', keywords: ['war', 'military', 'missile', 'attack', 'ceasefire', 'troops', 'hostage'] },
  { name: 'Business', keywords: ['market', 'stocks', 'economy', 'inflation', 'earnings', 'trade', 'tariff'] },
  { name: 'Technology', keywords: ['artificial intelligence', 'ai', 'software', 'cyber', 'chip', 'startup'] },
  { name: 'Health', keywords: ['health', 'hospital', 'disease', 'virus', 'vaccine', 'medical'] },
  { name: 'Climate', keywords: ['climate', 'storm', 'hurricane', 'flood', 'wildfire', 'earthquake'] },
  { name: 'Science', keywords: ['space', 'nasa', 'research', 'study', 'scientist'] },
  { name: 'Sports', keywords: ['nba', 'nfl', 'mlb', 'nhl', 'soccer', 'football', 'olympic'] },
  { name: 'Culture', keywords: ['movie', 'music', 'tv', 'celebrity', 'book', 'festival'] },
  { name: 'Crime', keywords: ['police', 'shooting', 'killed', 'arrest', 'charged', 'trial'] }
];

const URGENCY_RULES = [
  { term: 'breaking', weight: 6 },
  { term: 'urgent', weight: 5 },
  { term: 'live', weight: 4 },
  { term: 'alert', weight: 4 },
  { term: 'attack', weight: 4 },
  { term: 'killed', weight: 4 },
  { term: 'war', weight: 3 },
  { term: 'earthquake', weight: 4 },
  { term: 'wildfire', weight: 3 },
  { term: 'hurricane', weight: 3 }
];

const STOP_WORDS = new Set([
  'about', 'after', 'again', 'against', 'among', 'around', 'because', 'being', 'before', 'between', 'could', 'during', 'first',
  'from', 'have', 'into', 'just', 'more', 'most', 'over', 'said', 'than', 'that', 'their', 'there', 'these', 'they', 'this',
  'those', 'through', 'under', 'very', 'were', 'what', 'when', 'where', 'which', 'while', 'will', 'with', 'would'
]);
const FEATURED_SOURCE_PRIORITY = new Set(['CNN', 'DRUDGE REPORT', 'NEW YORK POST']);

const NON_LATIN_SCRIPT_PATTERN = /[\u0400-\u04FF\u0590-\u05FF\u0600-\u06FF\u0900-\u097F\u0E00-\u0E7F\u1100-\u11FF\u3040-\u30FF\u3400-\u9FFF]/;

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

  return ranked[0]?.item || items[0];
}

function pickFeaturedStory(items) {
  if (!items.length) {
    return null;
  }

  const drudgeLead = items.find(
    (item) => String(item.source || '').trim().toUpperCase() === 'DRUDGE REPORT'
  );
  if (drudgeLead) {
    return drudgeLead;
  }

  const prioritized = items.filter((item) =>
    FEATURED_SOURCE_PRIORITY.has(String(item.source || '').trim().toUpperCase())
  );
  if (prioritized.length) {
    return pickTopByUrgency(prioritized);
  }

  return pickTopByUrgency(items);
}

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

  const anchorTopic = classifyTopic(anchorStory);
  const anchorTokens = tokenize(`${anchorStory.title} ${anchorStory.tldr}`);

  return pool
    .filter((item) => item.id !== anchorStory.id)
    .map((item) => {
      const itemTopic = classifyTopic(item);
      const shared = overlapCount(anchorTokens, tokenize(`${item.title} ${item.tldr}`));
      let score = 0;
      if (itemTopic === anchorTopic) {
        score += 2;
      }
      score += Math.min(shared, 4);
      if (item.source === anchorStory.source) {
        score += 1;
      }

      return {
        item,
        score,
        timestamp: item.publishedAt ? Date.parse(item.publishedAt) : 0
      };
    })
    .filter((entry) => entry.score >= 2)
    .sort((a, b) => b.score - a.score || b.timestamp - a.timestamp)
    .slice(0, 4)
    .map((entry) => entry.item);
}

export default function App() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tldrMode, setTldrMode] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isHeaderPinned, setIsHeaderPinned] = useState(false);
  const [inlineHeaderY, setInlineHeaderY] = useState(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const isHeaderPinnedRef = useRef(false);

  const featuredStory = useMemo(() => pickFeaturedStory(items), [items]);

  const listItems = useMemo(() => {
    if (!featuredStory) {
      return items;
    }

    return items.filter((item) => item.id !== featuredStory.id);
  }, [items, featuredStory]);

  const relatedStories = useMemo(() => pickRelatedStories(featuredStory, listItems), [featuredStory, listItems]);
  const groupedStories = useMemo(() => groupStories(listItems), [listItems]);
  const sections = useMemo(
    () =>
      groupedStories.map((group) => ({
        key: group.topic,
        title: `${group.topic} (${group.items.length})`,
        data: group.items
      })),
    [groupedStories]
  );

  const openLink = useCallback(async (url) => {
    try {
      await Linking.openURL(url);
    } catch {
      // Ignore link failures and keep UI responsive.
    }
  }, []);

  const loadNews = useCallback(
    async (forceRefresh = false) => {
      if (forceRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setLoadError('');

      try {
        const { data } = await fetchFromCandidates(API_BASE_CANDIDATES, forceRefresh);
        const filteredItems = (Array.isArray(data.items) ? data.items : []).filter((item) => isLikelyEnglishTitle(item.title));

        // Source-level failures are expected occasionally; keep them out of the UI.
        if (Array.isArray(data.errors) && data.errors.length) {
          // eslint-disable-next-line no-console
          console.debug('Suppressed feed source errors:', data.errors);
        }

        setItems(filteredItems);
      } catch (error) {
        const attempted = API_BASE_CANDIDATES.join(', ');
        setLoadError(`Could not load feed. Tried: ${attempted}. ${error.message || 'Unknown error'}`);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    loadNews(false);
  }, [loadNews]);

  const onListScroll = useCallback((event) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const shouldPin = typeof inlineHeaderY === 'number' && inlineHeaderY > 0 && offsetY >= inlineHeaderY;
    if (shouldPin !== isHeaderPinnedRef.current) {
      isHeaderPinnedRef.current = shouldPin;
      setIsHeaderPinned(shouldPin);
    }
  }, [inlineHeaderY]);

  const renderTopBar = (inline = false) => (
    <View
      style={[
        styles.header,
        inline ? styles.headerInline : styles.headerPinned,
        inline && isHeaderPinned ? styles.headerGhost : null
      ]}
      onLayout={
        inline
          ? (event) => {
              const { y, height } = event.nativeEvent.layout;
              if (typeof inlineHeaderY !== 'number' || Math.abs(inlineHeaderY - y) > 0.5) {
                setInlineHeaderY(y);
              }
              if (height !== headerHeight) {
                setHeaderHeight(height);
              }
            }
          : undefined
      }
    >
      <View style={styles.brandWrap}>
        <Text style={styles.brand}>NewsDrip</Text>
        <Text style={styles.brandDot}>.</Text>
      </View>
      <View style={styles.actions}>
        <Pressable
          style={[styles.button, tldrMode ? styles.buttonActiveRed : null]}
          onPress={() => setTldrMode((value) => !value)}
        >
          <Text style={[styles.buttonText, tldrMode ? styles.buttonTextActive : null]}>TLDR</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderStory = ({ item }) => (
    <Pressable style={styles.story} onPress={() => openLink(item.link)}>
      <Text style={[styles.storyTitle, tldrMode ? styles.storyTitleCompact : null]}>{item.title}</Text>
      {!tldrMode ? (
        <Text style={styles.storyDetail}>
          {item.source} {formatTime(item.publishedAt)} - {item.tldr}
        </Text>
      ) : null}
    </Pressable>
  );

  const renderListHeader = () => (
    <View>
      {featuredStory ? (
        <Pressable style={styles.featured} onPress={() => openLink(featuredStory.link)}>
          <Text style={[styles.featuredTitle, tldrMode ? styles.featuredTitleCompact : null]}>
            {featuredStory.title}
          </Text>

          {relatedStories.length ? (
            <View style={styles.relatedList}>
              {relatedStories.map((item) => (
                <Text
                  key={item.id}
                  style={styles.relatedItem}
                  onPress={() => openLink(item.link)}
                >
                  {item.title}
                </Text>
              ))}
            </View>
          ) : null}
        </Pressable>
      ) : null}

      {renderTopBar(true)}

      {loadError ? <Text style={styles.error}>{loadError}</Text> : null}
      {loading ? <Text style={styles.status}>Loading...</Text> : null}
    </View>
  );

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <StatusBar style="dark" />
        <View style={[styles.pinnedHeaderSlot, isHeaderPinned && headerHeight ? { height: headerHeight } : null]}>
          {isHeaderPinned ? renderTopBar(false) : null}
        </View>
        <SectionList
          style={styles.container}
          contentContainerStyle={styles.content}
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderStory}
          renderSectionHeader={({ section }) => (
            <Text style={styles.groupTitle}>{section.title}</Text>
          )}
          stickySectionHeadersEnabled
          ListHeaderComponent={renderListHeader}
          onScroll={onListScroll}
          scrollEventThrottle={16}
          ListEmptyComponent={
            !loading && !loadError ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.status}>No stories available.</Text>
              </View>
            ) : null
          }
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadNews(true)} />}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f4f1ea'
  },
  pinnedHeaderSlot: {
    height: 0,
    backgroundColor: '#f4f1ea',
    paddingHorizontal: 14
  },
  container: {
    flex: 1
  },
  content: {
    paddingHorizontal: 14,
    paddingVertical: 16,
    paddingBottom: 32
  },
  header: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#181818',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    gap: 10
  },
  headerInline: {
    marginTop: 8,
    marginBottom: 12
  },
  headerPinned: {
    marginTop: 0,
    marginBottom: 0
  },
  headerGhost: {
    opacity: 0
  },
  brandWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    flexShrink: 1
  },
  brand: {
    fontSize: 38,
    fontWeight: '700',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: undefined }),
    color: '#111',
    flexShrink: 1
  },
  brandDot: {
    fontSize: 38,
    lineHeight: 40,
    color: '#c90a00',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: undefined })
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 8,
    alignItems: 'center'
  },
  button: {
    borderWidth: 1,
    borderColor: '#181818',
    backgroundColor: '#fffdf8',
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  buttonActiveRed: {
    backgroundColor: '#9a1c16',
    borderColor: '#9a1c16'
  },
  buttonText: {
    fontSize: 16,
    color: '#181818'
  },
  buttonTextActive: {
    color: '#fffdf8'
  },
  featured: {
    paddingVertical: 4,
    paddingHorizontal: 6,
    marginBottom: 2
  },
  featuredTitle: {
    textAlign: 'center',
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 32,
    color: '#9a1c16'
  },
  featuredTitleCompact: {
    fontSize: 24,
    lineHeight: 27
  },
  relatedList: {
    marginTop: 6,
    gap: 2,
    alignItems: 'center'
  },
  relatedItem: {
    color: '#555',
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 18,
    textAlign: 'center'
  },
  status: {
    marginTop: 4,
    marginBottom: 10,
    color: '#555',
    fontSize: 14
  },
  error: {
    marginBottom: 10,
    color: '#7a1f13',
    fontSize: 14
  },
  groupTitle: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#555',
    backgroundColor: '#f3ecdd',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: '#d6d0c3'
  },
  story: {
    borderWidth: 1,
    borderColor: '#d6d0c3',
    borderTopWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor: '#fffdf8',
    marginBottom: 0
  },
  storyTitle: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '500',
    color: '#181818'
  },
  storyTitleCompact: {
    fontSize: 14,
    lineHeight: 17,
    fontWeight: '400'
  },
  storyDetail: {
    marginTop: 4,
    color: '#555',
    fontSize: 14,
    lineHeight: 19
  },
  emptyWrap: {
    paddingVertical: 8
  }
});
