import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

const DEFAULT_BASE_URL = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || DEFAULT_BASE_URL;

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

function pickFeaturedStory(items) {
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

export default function App() {
  const [items, setItems] = useState([]);
  const [generatedAt, setGeneratedAt] = useState('');
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [groupedMode, setGroupedMode] = useState(true);
  const [tldrMode, setTldrMode] = useState(true);
  const [loadError, setLoadError] = useState('');

  const featuredStory = useMemo(() => pickFeaturedStory(items), [items]);

  const listItems = useMemo(() => {
    if (!featuredStory) {
      return items;
    }

    return items.filter((item) => item.id !== featuredStory.id);
  }, [items, featuredStory]);

  const groupedStories = useMemo(() => groupStories(listItems), [listItems]);

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
        const endpoint = `${API_BASE_URL}/api/news${forceRefresh ? '?refresh=1' : ''}`;
        const response = await fetch(endpoint);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        setItems(Array.isArray(data.items) ? data.items : []);
        setGeneratedAt(data.generatedAt || '');
        setErrors(Array.isArray(data.errors) ? data.errors : []);
      } catch (error) {
        setLoadError(`Could not load feed from ${API_BASE_URL}. ${error.message || 'Unknown error'}`);
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

  const renderStory = (item) => (
    <Pressable key={item.id} style={styles.story} onPress={() => openLink(item.link)}>
      <Text style={[styles.storyTitle, tldrMode ? styles.storyTitleCompact : null]}>{item.title}</Text>
      {!tldrMode ? (
        <Text style={styles.storyDetail}>
          {item.source} {formatTime(item.publishedAt)} - {item.tldr}
        </Text>
      ) : null}
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadNews(true)} />}
      >
        <View style={styles.header}>
          <Text style={styles.brand}>DripWire</Text>
          <View style={styles.actions}>
            <Pressable
              style={[styles.button, tldrMode ? styles.buttonActiveRed : null]}
              onPress={() => setTldrMode((value) => !value)}
            >
              <Text style={[styles.buttonText, tldrMode ? styles.buttonTextActive : null]}>TLDR</Text>
            </Pressable>
            <Pressable
              style={[styles.button, groupedMode ? styles.buttonActiveDark : null]}
              onPress={() => setGroupedMode((value) => !value)}
            >
              <Text style={[styles.buttonText, groupedMode ? styles.buttonTextActive : null]}>
                {groupedMode ? 'Show Mixed Feed' : 'Group by Topic'}
              </Text>
            </Pressable>
            <Pressable style={styles.button} onPress={() => loadNews(true)}>
              <Text style={styles.buttonText}>Refresh</Text>
            </Pressable>
          </View>
        </View>

        {featuredStory ? (
          <Pressable style={styles.featured} onPress={() => openLink(featuredStory.link)}>
            <Text style={[styles.featuredTitle, tldrMode ? styles.featuredTitleCompact : null]}>
              {featuredStory.title}
            </Text>
            {!tldrMode ? (
              <Text style={styles.featuredDetail}>
                {featuredStory.source} {formatTime(featuredStory.publishedAt)} - {featuredStory.tldr}
              </Text>
            ) : null}
          </Pressable>
        ) : null}

        <Text style={styles.status}>Updated {formatTime(generatedAt)} - {items.length} stories</Text>

        {errors.length ? (
          <Text style={styles.warning}>Some sources failed: {errors.map((entry) => entry.source).join(', ')}</Text>
        ) : null}

        {loadError ? <Text style={styles.error}>{loadError}</Text> : null}

        {loading ? <Text style={styles.status}>Loading...</Text> : null}

        <View style={styles.feed}>
          {!groupedMode ? (
            listItems.map((item) => renderStory(item))
          ) : (
            groupedStories.map((group) => (
              <View key={group.topic} style={styles.groupBlock}>
                <Text style={styles.groupTitle}>
                  {group.topic} ({group.items.length})
                </Text>
                {group.items.map((item) => renderStory(item))}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f4f1ea'
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
    borderBottomWidth: 2,
    borderColor: '#181818',
    paddingVertical: 12,
    marginBottom: 12,
    gap: 10
  },
  brand: {
    fontSize: 44,
    fontWeight: '700',
    color: '#111'
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
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
  buttonActiveDark: {
    backgroundColor: '#181818',
    borderColor: '#181818'
  },
  buttonText: {
    fontSize: 20,
    color: '#181818'
  },
  buttonTextActive: {
    color: '#fffdf8'
  },
  featured: {
    paddingVertical: 10,
    paddingHorizontal: 6,
    marginBottom: 6
  },
  featuredTitle: {
    textAlign: 'center',
    fontSize: 44,
    fontWeight: '800',
    lineHeight: 46,
    color: '#9a1c16'
  },
  featuredTitleCompact: {
    fontSize: 36,
    lineHeight: 38
  },
  featuredDetail: {
    marginTop: 6,
    textAlign: 'center',
    color: '#555',
    fontSize: 15,
    lineHeight: 20
  },
  status: {
    marginTop: 4,
    marginBottom: 10,
    color: '#555',
    fontSize: 16
  },
  warning: {
    marginBottom: 10,
    color: '#8c5a0a',
    fontSize: 14
  },
  error: {
    marginBottom: 10,
    color: '#7a1f13',
    fontSize: 14
  },
  feed: {
    gap: 10
  },
  groupBlock: {
    borderWidth: 1,
    borderColor: '#d6d0c3',
    backgroundColor: '#fffdf8'
  },
  groupTitle: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#555',
    backgroundColor: '#f3ecdd'
  },
  story: {
    borderTopWidth: 1,
    borderTopColor: '#d6d0c3',
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor: '#fffdf8'
  },
  storyTitle: {
    fontSize: 31,
    lineHeight: 34,
    color: '#181818'
  },
  storyTitleCompact: {
    fontSize: 26,
    lineHeight: 29,
    fontWeight: '400'
  },
  storyDetail: {
    marginTop: 4,
    color: '#555',
    fontSize: 14,
    lineHeight: 19
  }
});
