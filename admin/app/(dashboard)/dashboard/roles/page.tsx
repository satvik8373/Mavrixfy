'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
import { ShieldCheck, Users, Loader2 } from 'lucide-react';

const ROLES = [
  { key: 'super_admin', label: 'Super Admin', description: 'Full access to all features and settings', color: 'bg-blue-600' },
  { key: 'content_editor', label: 'Content Editor', description: 'Manage songs, playlists, and artists', color: 'bg-purple-600' },
  { key: 'moderator', label: 'Moderator', description: 'Content moderation and user management', color: 'bg-green-600' },
  { key: 'analyst', label: 'Analyst', description: 'View analytics and reports (read-only)', color: 'bg-orange-500' },
];

const PERMISSIONS: Record<string, boolean[]> = {
  'Overview Dashboard':  [true,  true,  true,  true],
  'Manage Songs':        [true,  true,  false, false],
  'Manage Playlists':    [true,  true,  false, false],
  'Manage Artists':      [true,  true,  false, false],
  'Content Moderation':  [true,  false, true,  false],
  'User Management':     [true,  false, true,  false],
  'View Analytics':      [true,  true,  true,  true],
  'Feature Flags':       [true,  false, false, false],
  'Promotions':          [true,  true,  false, false],
  'Notifications':       [true,  false, false, false],
  'Admin Roles':         [true,  false, false, false],
};

export default function RolesPage() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchCounts(); }, []);

  async function fetchCounts() {
    try {
      const snap = await getDocs(query(collection(db, 'users'), where('isAdmin', '==', true)));
      const c: Record<string, number> = { super_admin: 0, content_editor: 0, moderator: 0, analyst: 0 };
      snap.docs.forEach(d => {
        const role = d.data().adminRole || 'super_admin';
        if (c[role] !== undefined) c[role]++;
      });
      setCounts(c);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Admin Roles</h1>
        <p className="mt-1 text-sm text-gray-500">Manage admin permissions and access control</p>
      </div>

      {/* Role Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {ROLES.map(role => (
          <div key={role.key} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className={`flex size-10 items-center justify-center rounded-lg ${role.color}`}>
                <ShieldCheck className="size-5 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-900">{role.label}</h3>
                <p className="text-xs text-gray-500">{role.description}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-1.5 text-xs text-gray-500">
              <Users className="size-3.5" />
              {loading ? '—' : `${counts[role.key] ?? 0} ${counts[role.key] === 1 ? 'user' : 'users'}`}
            </div>
          </div>
        ))}
      </div>

      {/* Permission Matrix */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Permission Matrix</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Permission</th>
                {ROLES.map(r => (
                  <th key={r.key} className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">{r.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {Object.entries(PERMISSIONS).map(([perm, access]) => (
                <tr key={perm} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-700">{perm}</td>
                  {access.map((has, i) => (
                    <td key={`${perm}-${ROLES[i].key}`} className="px-4 py-3 text-center">
                      {has ? (
                        <span className="inline-block size-2 rounded-full bg-green-500" />
                      ) : (
                        <span className="inline-block size-2 rounded-full bg-gray-200" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
