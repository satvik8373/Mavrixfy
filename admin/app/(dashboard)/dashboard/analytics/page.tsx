'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, query, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
import { BarChart3, TrendingUp, Users, Music2, Play, Loader2 } from 'lucide-react';

export default function AnalyticsPage() {
  const [metrics, setMetrics] = useState({ totalSongs: 0, activeUsers: 0, playlists: 0, engagement: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAnalytics(); }, []);

  async function fetchAnalytics() {
    try {
      const [songsSnap, usersSnap, playlistsSnap] = await Promise.all([
        getDocs(query(collection(db, 'songs'), limit(1000))),
        getDocs(query(collection(db, 'users'), limit(1000))),
        getDocs(query(collection(db, 'playlists'), limit(1000))),
      ]);
      const engagement = usersSnap.size > 0 ? Math.round((playlistsSnap.size / usersSnap.size) * 100) : 0;
      setMetrics({ totalSongs: songsSnap.size, activeUsers: usersSnap.size, playlists: playlistsSnap.size, engagement });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const stats = [
    { label: 'Total Songs', value: metrics.totalSongs, icon: Music2, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Registered Users', value: metrics.activeUsers, icon: Users, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Playlists', value: metrics.playlists, icon: Play, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Engagement', value: `${metrics.engagement}%`, icon: TrendingUp, color: 'text-orange-600', bg: 'bg-orange-50' },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Analytics</h1>
        <p className="mt-1 text-sm text-gray-500">Platform insights and performance metrics</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 animate-spin text-blue-600" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            {stats.map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
                    <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
                  </div>
                  <div className={`rounded-lg p-3 ${bg}`}>
                    <Icon className={`size-6 ${color}`} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-sm font-semibold text-gray-900">Streaming Trends</h2>
              <p className="mt-0.5 text-xs text-gray-500">Connect your analytics service to see streaming data</p>
            </div>
            <div className="flex flex-col items-center justify-center py-16">
              <BarChart3 className="size-10 text-gray-300" />
              <p className="mt-3 text-sm font-medium text-gray-900">No streaming data yet</p>
              <p className="mt-1 text-xs text-gray-500">Streaming analytics will appear here once connected</p>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-sm font-semibold text-gray-900">Platform Summary</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {[
                { label: 'Total Songs in Catalog', value: metrics.totalSongs },
                { label: 'Total Registered Users', value: metrics.activeUsers },
                { label: 'Total Playlists Created', value: metrics.playlists },
                { label: 'Playlist Engagement Rate', value: `${metrics.engagement}%` },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between px-6 py-3">
                  <span className="text-sm text-gray-600">{label}</span>
                  <span className="text-sm font-semibold text-gray-900">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
