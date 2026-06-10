'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, query, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
import { Music2, ListMusic, Users, Activity, ArrowRight, MonitorPlay } from 'lucide-react';
import Link from 'next/link';

const quickLinks = [
  { label: 'Manage Songs', desc: 'Add, edit or remove songs from catalog', href: '/dashboard/songs', icon: Music2 },
  { label: 'Manage Playlists', desc: 'Create and manage editorial playlists', href: '/dashboard/playlists', icon: ListMusic },
  { label: 'Home Video', desc: 'Control the app top video showcase', href: '/dashboard/home-video', icon: MonitorPlay },
  { label: 'Manage Users', desc: 'View and manage user accounts', href: '/dashboard/users', icon: Users },
];

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<{ songs: number; playlists: number; users: number } | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMetrics() {
      try {
        const [songsSnap, playlistsSnap, usersSnap] = await Promise.all([
          getDocs(query(collection(db, 'songs'), limit(1000))),
          getDocs(query(collection(db, 'playlists'), limit(1000))),
          getDocs(query(collection(db, 'users'), limit(1000))),
        ]);
        setMetrics({ songs: songsSnap.size, playlists: playlistsSnap.size, users: usersSnap.size });
      } catch (error) {
        console.error('Error fetching metrics:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchMetrics();
  }, []);

  const stats = [
    { label: 'Total Songs', value: metrics?.songs ?? 0, icon: Music2, color: 'text-blue-600', bg: 'bg-blue-50', href: '/dashboard/songs' },
    { label: 'Playlists', value: metrics?.playlists ?? 0, icon: ListMusic, color: 'text-purple-600', bg: 'bg-purple-50', href: '/dashboard/playlists' },
    { label: 'Users', value: metrics?.users ?? 0, icon: Users, color: 'text-green-600', bg: 'bg-green-50', href: '/dashboard/users' },
    { label: 'Status', value: 'Online', icon: Activity, color: 'text-emerald-600', bg: 'bg-emerald-50', href: '/dashboard/analytics' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Overview</h1>
        <p className="mt-1 text-sm text-gray-500">Platform metrics and quick access</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, color, bg, href }) => (
          <Link key={label} href={href} className="block rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">
                  {loading ? <span className="text-gray-300">Loading</span> : value}
                </p>
              </div>
              <div className={`rounded-lg p-3 ${bg}`}>
                <Icon className={`size-6 ${color}`} />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Links */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Quick Actions</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {quickLinks.map(({ label, desc, href, icon: Icon }) => (
            <Link key={href} href={href} className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-gray-100 p-2">
                  <Icon className="size-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{label}</p>
                  <p className="text-xs text-gray-500">{desc}</p>
                </div>
              </div>
              <ArrowRight className="size-4 text-gray-400" />
            </Link>
          ))}
        </div>
      </div>

      {/* System Status */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-sm font-semibold text-gray-900">System Status</h2>
        </div>
        <div className="grid divide-y divide-gray-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {[
            { label: 'API', status: 'Operational' },
            { label: 'Database', status: 'Connected' },
            { label: 'Storage', status: 'Available' },
          ].map(({ label, status }) => (
            <div key={label} className="px-6 py-4">
              <p className="text-xs text-gray-500">{label}</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="size-2 rounded-full bg-green-500" />
                <p className="text-sm font-medium text-gray-900">{status}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
