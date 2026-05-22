'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
import { Search, TrendingUp, Loader2 } from 'lucide-react';

interface Song {
  id: string;
  title: string;
  artist: string;
  playCount?: number;
}

export default function DiscoveryPage() {
  const [topSongs, setTopSongs] = useState<Song[]>();
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchTopContent(); }, []);

  async function fetchTopContent() {
    try {
      const snap = await getDocs(query(collection(db, 'songs'), orderBy('playCount', 'desc'), limit(10)));
      setTopSongs(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Song[]);
    } catch {
      // playCount index may not exist, fallback
      try {
        const snap = await getDocs(query(collection(db, 'songs'), limit(10)));
        setTopSongs(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Song[]);
      } catch (e) {
        console.error(e);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Discovery & Search</h1>
        <p className="mt-1 text-sm text-gray-500">Manage search rankings and discovery features</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Top Songs */}
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-gray-200 px-5 py-4">
            <TrendingUp className="size-4 text-blue-600" />
            <h2 className="text-sm font-semibold text-gray-900">Top Songs</h2>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-5 animate-spin text-blue-600" />
            </div>
          ) : !topSongs || topSongs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <TrendingUp className="size-8 text-gray-300" />
              <p className="mt-2 text-sm text-gray-500">No songs data yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {topSongs.map((song, i) => (
                <div key={song.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50">
                  <span className="w-5 text-xs font-medium text-gray-400">{i + 1}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{song.title}</p>
                    <p className="text-xs text-gray-500">{song.artist}</p>
                  </div>
                  {song.playCount !== undefined && (
                    <span className="text-xs text-gray-400">{song.playCount} plays</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Search Config */}
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-gray-200 px-5 py-4">
            <Search className="size-4 text-blue-600" />
            <h2 className="text-sm font-semibold text-gray-900">Search Configuration</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {[
              { label: 'Search by Title', enabled: true },
              { label: 'Search by Artist', enabled: true },
              { label: 'Search by Album', enabled: true },
              { label: 'Fuzzy Matching', enabled: false },
              { label: 'Trending Boost', enabled: false },
            ].map(({ label, enabled }) => (
              <div key={label} className="flex items-center justify-between px-5 py-3">
                <span className="text-sm text-gray-700">{label}</span>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {enabled ? 'Active' : 'Inactive'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
