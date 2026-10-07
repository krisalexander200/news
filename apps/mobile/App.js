import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Linking,
  Modal,
  ScrollView,
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
import legalContent from './legal-content.json';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView, initialWindowMetrics } from 'react-native-safe-area-context';

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
  return items.length ? pickTopByUrgency(items) : null;
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


function LoadingDrip() {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: 850,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true
        }),
        Animated.delay(220),
        Animated.timing(progress, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true
        })
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [progress]);

  return (
    <View style={styles.loadingDripWrap} accessibilityLabel="Loading news">
      <Animated.View
        style={[
          styles.loadingDrip,
          {
            opacity: progress.interpolate({
              inputRange: [0, 0.7, 1],
              outputRange: [1, 1, 0]
            }),
            transform: [
              {
                translateY: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 28]
                })
              },
              { rotate: '225deg' },
              {
                scale: progress.interpolate({
                  inputRange: [0, 0.75, 1],
                  outputRange: [0.7, 1, 0.8]
                })
              }
            ]
          }
        ]}
      />
    </View>
  );
}

function FeedImage({ uri }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  if (!uri || failed) return null;
  return <Image source={{ uri }} style={{ width: '100%', height: 180, marginBottom: 10 }} resizeMode="cover" accessible={false} onError={() => setFailed(true)} />;
}

export default function App() {
  const [legalPage, setLegalPage] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
      setLoadError('The link could not open. Please try again.');
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
        if (data.stale) setLoadError('Showing previously loaded headlines. Pull down to try updating again.');
      } catch (error) {
        setLoadError('News could not load. Check your connection and pull down to try again.');
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

    </View>
  );

  const renderStory = ({ item }) => (
    <View style={styles.story}>
      <Pressable accessibilityRole="link" onPress={() => openLink(item.link)}>
        <FeedImage uri={item.image} />
        <Text style={[styles.storyTitle, styles.storyTitleCompact]}>{item.title}<Text style={styles.inlineSource}> · {item.source}</Text></Text>
      </Pressable>
    </View>
  );

  const renderListHeader = () => (
    <View>
      {featuredStory ? (
        <View style={styles.featured}>
          <Pressable accessibilityRole="link" onPress={() => openLink(featuredStory.link)}>
            <FeedImage uri={featuredStory.image} />
            <Text style={[styles.featuredTitle, styles.featuredTitleCompact]}>
              {featuredStory.title}<Text style={styles.inlineSource}> · {featuredStory.source}</Text>
            </Text>
          </Pressable>
          {relatedStories.length ? (
            <View style={styles.relatedList}>
              {relatedStories.map((item) => (
                <View key={item.id} style={styles.relatedItem}>
                  <FeedImage uri={item.image} />
                  <Text accessibilityRole="link" onPress={() => openLink(item.link)}>{item.title}<Text style={styles.inlineSource}> · {item.source}</Text></Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {renderTopBar(true)}

      {loadError ? <Text style={styles.error}>{loadError}</Text> : null}
      {loading ? <LoadingDrip /> : null}
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
          ListFooterComponent={
            <View style={styles.footer}>
              <Text style={styles.sourceCredit}>News from independently published sources.</Text>
              <Text style={styles.licenseLink} accessibilityRole="link" onPress={() => setLegalPage('sources')}>Sources</Text>
              <Text style={styles.licenseLink} accessibilityRole="link" onPress={() => setLegalPage('privacy')}>Privacy policy</Text>
            </View>
          }
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
      <Modal visible={legalPage !== null} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setLegalPage(null)}>
        <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
          <View style={styles.legalHeader}>
            <Text style={styles.legalHeaderTitle}>{legalPage === 'sources' ? 'Sources & licenses' : 'Privacy policy'}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close information" hitSlop={8} onPress={() => setLegalPage(null)} style={styles.legalClose}>
              <Text style={styles.legalCloseText}>Done</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.legalContent}>
            {(legalContent[legalPage] || []).map((block, index) => (
              <Text key={index} style={block.type === 'h1' || block.type === 'h2' ? styles.legalHeading : styles.legalBody}>
                {block.type === 'li' ? '• ' : ''}
                {block.runs.map((run, runIndex) => (
                  <Text key={runIndex} style={run.href ? styles.legalLink : undefined} accessibilityRole={run.href ? 'link' : undefined}
                    onPress={run.href ? () => run.href === '/' ? setLegalPage(null) : run.href === '/privacy-policy' ? setLegalPage('privacy') : openLink(run.href) : undefined}>
                    {run.text}{runIndex < block.runs.length - 1 ? ' ' : ''}
                  </Text>
                ))}
              </Text>
            ))}
          </ScrollView>
        </SafeAreaView>
        </SafeAreaProvider>
      </Modal>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  legalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderColor: '#ccc' },
  legalHeaderTitle: { fontSize: 20, lineHeight: 28, fontWeight: '700', color: '#181818', flexShrink: 1, marginRight: 12 },
  legalContent: { padding: 20, paddingBottom: 40 },
  legalHeading: { fontSize: 20, lineHeight: 28, fontWeight: '700', color: '#181818', marginBottom: 12, flexShrink: 1 },
  legalBody: { fontSize: 16, lineHeight: 24, color: '#333', marginBottom: 16 },
  legalLink: { color: '#8f1717', textDecorationLine: 'underline' },
  legalClose: { minHeight: 44, minWidth: 60, justifyContent: 'center', alignItems: 'center' },
  legalCloseText: { color: '#8f1717', fontSize: 17, fontWeight: '600' },
  attribution: { marginTop: 8, marginBottom: 4 },
  inlineSource: { fontSize: 12, fontWeight: '400', color: '#666' },
  sourceCredit: { fontSize: 12, lineHeight: 17, color: '#555' },
  licenseLink: { fontSize: 12, lineHeight: 18, color: '#8f1717', textDecorationLine: 'underline', paddingVertical: 5 },
  footer: { paddingVertical: 24, gap: 4 },
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
    paddingVertical: 8,
    paddingHorizontal: 6,
    marginBottom: 2
  },
  featuredImage: {
    width: '100%',
    height: 210,
    marginBottom: 12,
    backgroundColor: '#e5dfd3'
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
    marginTop: 10,
    gap: 8,
    alignItems: 'center'
  },
  relatedItem: {
    color: '#555',
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center'
  },
  status: {
    marginTop: 4,
    marginBottom: 10,
    color: '#555',
    fontSize: 14
  },
  loadingDripWrap: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 4
  },
  loadingDrip: {
    width: 18,
    height: 18,
    backgroundColor: '#b21f18',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 3
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
  storyImage: {
    width: '100%',
    height: 170,
    marginBottom: 9,
    backgroundColor: '#e5dfd3'
  },
  storyTitle: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '500',
    color: '#181818'
  },
  storyTitleCompact: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '600',
    color: '#000'
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
