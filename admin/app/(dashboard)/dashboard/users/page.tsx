'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
import { Users, Search, Shield, Ban, Loader2 } from 'lucide-react';

interface User {
  id: string;
  email?: string;
  displayName?: string;
  fullName?: string;
  photoURL?: string;
  createdAt?: any;
  role?: string;
  isAdmin?: boolean;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => { fetchUsers(); }, []);

  async function fetchUsers() {
    try {
      const snap = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(100)));
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })) as User[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const filtered = users.filter(u =>
    u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.fullName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const adminCount = users.filter(u => u.role === 'admin' || u.isAdmin).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Users</h1>
          <p className="mt-1 text-sm text-gray-500">{users.length} registered users</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Users', value: users.length, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Admins', value: adminCount, icon: Shield, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Regular', value: users.length - adminCount, icon: Users, color: 'text-gray-600', bg: 'bg-gray-100' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">{label}</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{loading ? '—' : value}</p>
              </div>
              <div className={`rounded-lg p-2 ${bg}`}>
                <Icon className={`size-5 ${color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search by email or name..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="input-field pl-10"
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-6 animate-spin text-blue-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="size-10 text-gray-300" />
            <p className="mt-3 text-sm font-medium text-gray-900">{searchQuery ? 'No users found' : 'No users yet'}</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">User</th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 md:table-cell">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Role</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(user => {
                const name = user.displayName || user.fullName || 'Unknown';
                const isAdmin = user.role === 'admin' || user.isAdmin;
                return (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {user.photoURL ? (
                          <Image src={user.photoURL} alt={name} width={36} height={36} className="size-9 rounded-full object-cover" unoptimized />
                        ) : (
                          <div className="flex size-9 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
                            {name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="text-sm font-medium text-gray-900">{name}</span>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 text-sm text-gray-500 md:table-cell">{user.email || '—'}</td>
                    <td className="px-4 py-3">
                      {isAdmin ? (
                        <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">Admin</span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">User</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700" title="Manage role">
                          <Shield className="size-4" />
                        </button>
                        <button type="button" className="rounded-md p-1.5 text-red-500 hover:bg-red-50 hover:text-red-700" title="Ban user">
                          <Ban className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
