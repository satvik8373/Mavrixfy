import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assembleDistinctSections,
  dedupeCandidates,
  filterDiverseCandidates,
  normalizeRecommendationItem,
  recommendationTestInternals,
  scoreCandidate,
} from '../src/services/recommendation.service.js';

const buildSong = (id, overrides = {}) => ({
  _id: id,
  title: `Song ${id}`,
  artist: `Artist ${id}`,
  album: `Album ${id}`,
  audioUrl: `https://example.com/${id}.mp3`,
  duration: 180,
  createdAt: '2026-05-01T00:00:00.000Z',
  ...overrides,
});

const buildPlaylist = (id, overrides = {}) => normalizeRecommendationItem({
  id,
  name: `Playlist ${id}`,
  image: [{ url: `https://example.com/${id}.jpg` }],
  ...overrides,
}, 'jiosaavn', 'playlist');

test('normalizes source-aware song and playlist identities', () => {
  const song = normalizeRecommendationItem(buildSong('track-1'), 'catalog', 'song');
  const playlist = normalizeRecommendationItem({ id: 'pl-1', name: 'Mix', image: [{ url: 'cover.jpg' }] }, 'jiosaavn', 'playlist');

  assert.equal(song.id, 'catalog:track-1');
  assert.equal(song.song._id, 'track-1');
  assert.equal(playlist.id, 'jiosaavn:pl-1');
  assert.equal(playlist.routePath, '/jiosaavn/playlist/pl-1');
});

test('dedupes equivalent candidates across repeated pools', () => {
  const item = normalizeRecommendationItem(buildSong('same'), 'fresh', 'song');
  const duplicate = { ...item, score: 0.9 };
  const lowerScore = { ...item, score: 0.2 };

  assert.deepEqual(dedupeCandidates([lowerScore, duplicate]), [duplicate]);
});

test('dedupes matching visible songs across provider ids', () => {
  const lowerScore = {
    ...normalizeRecommendationItem(buildSong('catalog-copy', {
      title: 'Trending Nakhra',
      artist: 'Amrit Maan',
      album: 'Single',
    }), 'catalog', 'song'),
    score: 0.2,
  };
  const preferred = {
    ...normalizeRecommendationItem(buildSong('jio-copy', {
      title: 'Trending Nakhra',
      artist: 'Amrit Maan',
      album: 'Single',
    }), 'trending', 'song'),
    score: 0.9,
  };

  assert.deepEqual(dedupeCandidates([lowerScore, preferred]), [preferred]);
});

test('does not repeat playlists across homepage sections', () => {
  const repeated = { ...buildPlaylist('repeat', { name: 'Hot Hits Hindi' }), score: 1 };
  const fresh = { ...buildPlaylist('fresh', { name: 'New Hindi Mix' }), score: 0.9 };
  const regional = { ...buildPlaylist('regional', { name: 'Punjabi Party' }), score: 0.8 };

  const sections = assembleDistinctSections([
    { id: 'recommendedForYou', items: [repeated] },
    { id: 'freshDiscoveries', items: [repeated, fresh] },
    { id: 'popularNearYou', items: [repeated, regional] },
  ]);
  const shownIds = sections.flatMap((section) => section.items.map((item) => item.contentId));

  assert.deepEqual(shownIds, ['repeat', 'fresh', 'regional']);
});

test('scores preferred familiar candidates above unmatched discovery candidates', () => {
  const familiar = normalizeRecommendationItem(buildSong('liked', { title: 'Focus Pulse' }), 'liked', 'song');
  const discovery = normalizeRecommendationItem(buildSong('new', { title: 'Drift Away' }), 'fresh', 'song');
  const profile = { preferenceTerms: { focus: 4, pulse: 3 } };

  assert.ok(scoreCandidate(familiar, profile) > scoreCandidate(discovery, profile));
});

test('filters cooled down songs and protects artist diversity', () => {
  const now = Date.now();
  const items = [
    normalizeRecommendationItem(buildSong('blocked', { artist: 'Repeat' }), 'catalog', 'song'),
    normalizeRecommendationItem(buildSong('one', { artist: 'Repeat' }), 'catalog', 'song'),
    normalizeRecommendationItem(buildSong('two', { artist: 'Repeat' }), 'catalog', 'song'),
    normalizeRecommendationItem(buildSong('three', { artist: 'Repeat' }), 'catalog', 'song'),
    normalizeRecommendationItem(buildSong('other', { artist: 'Other' }), 'catalog', 'song'),
  ].map((item, index) => ({ ...item, score: 1 - index * 0.1 }));

  const selected = filterDiverseCandidates(items, {
    songs: { blocked: now },
    artists: {},
    albums: {},
  }, 3, now);

  assert.equal(selected.some((item) => item.contentId === 'blocked'), false);
  assert.equal(selected.filter((item) => item.artist === 'Repeat').length <= 2, true);
});

test('regenerates expired, new-session, and skip-burst cached feeds', () => {
  const { shouldRegenerateFeed } = recommendationTestInternals;
  const liveCache = {
    feed: { sections: [] },
    version: 4,
    sessionId: 'a',
    generatedAt: new Date().toISOString(),
    expiresAt: Date.now() + 60_000,
  };

  assert.equal(shouldRegenerateFeed(liveCache, {}, 'a'), false);
  assert.equal(shouldRegenerateFeed({ ...liveCache, expiresAt: Date.now() - 1 }, {}, 'a'), true);
  assert.equal(shouldRegenerateFeed(liveCache, {}, 'b'), true);
  assert.equal(shouldRegenerateFeed(liveCache, { skipBurstUntil: Date.now() + 5_000 }, 'a'), true);
});
