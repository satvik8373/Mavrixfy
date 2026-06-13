'use client';

import { useCallback, useEffect, useMemo, useReducer } from 'react';
import Image from 'next/image';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
import {
  AlertTriangle,
  Loader2,
  RefreshCcw,
  Search,
} from 'lucide-react';

interface User {
  id: string;
  uid: string;
  email: string;
  emailLower: string;
  displayName: string;
  fullName: string;
  name: string;
  photoURL: string;
  imageUrl: string;
  provider: string;
  role: string;
  adminRole: string;
  plan: string;
  isAdmin: boolean;
  admin?: boolean;
  onboardingCompleted: boolean;
  emailVerified: boolean | null;
  disabled: boolean;
  banned: boolean;
  schemaVersion: number | null;
  createdAtMillis: number;
  updatedAtMillis: number;
  lastLoginAtMillis: number;
}

const RECENT_LIMIT = 8;
const RECENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const STATUS_BADGE_TONES = {
  gray: 'bg-gray-100 text-gray-700',
  green: 'bg-green-100 text-green-800',
  blue: 'bg-blue-100 text-blue-800',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-800',
};

type BadgeTone = keyof typeof STATUS_BADGE_TONES;

interface UsersState {
  users: User[];
  loading: boolean;
  refreshing: boolean;
  searchQuery: string;
  error: string;
}

type UsersAction =
  | { type: 'load:start'; refresh: boolean }
  | { type: 'load:success'; users: User[] }
  | { type: 'load:error'; error: string }
  | { type: 'search:set'; value: string };

const INITIAL_USERS_STATE: UsersState = {
  users: [],
  loading: true,
  refreshing: false,
  searchQuery: '',
  error: '',
};

function usersReducer(state: UsersState, action: UsersAction): UsersState {
  switch (action.type) {
    case 'load:start':
      return {
        ...state,
        loading: !action.refresh,
        refreshing: action.refresh,
      };
    case 'load:success':
      return {
        ...state,
        users: action.users,
        loading: false,
        refreshing: false,
        error: '',
      };
    case 'load:error':
      return {
        ...state,
        loading: false,
        refreshing: false,
        error: action.error,
      };
    case 'search:set':
      return {
        ...state,
        searchQuery: action.value,
      };
    default:
      return state;
  }
}

function pickString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function pickBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function pickNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function getTimestampMillis(value: unknown): number {
  if (!value) return 0;

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (typeof value === 'object') {
    const maybeTimestamp = value as {
      toMillis?: () => number;
      toDate?: () => Date;
      seconds?: number;
      _seconds?: number;
    };

    if (typeof maybeTimestamp.toMillis === 'function') {
      const millis = maybeTimestamp.toMillis();
      return Number.isFinite(millis) ? millis : 0;
    }

    if (typeof maybeTimestamp.toDate === 'function') {
      const date = maybeTimestamp.toDate();
      return date instanceof Date ? date.getTime() : 0;
    }

    const seconds =
      typeof maybeTimestamp.seconds === 'number'
        ? maybeTimestamp.seconds
        : maybeTimestamp._seconds;
    return typeof seconds === 'number' ? seconds * 1000 : 0;
  }

  return 0;
}

function normalizeProvider(provider: string): string {
  if (!provider) return 'Unknown';
  if (provider === 'password') return 'Email';
  if (provider === 'google.com') return 'Google';
  return provider;
}

function normalizeRole(value: string, isAdmin: boolean): string {
  if (value) return value.replace(/_/g, ' ');
  return isAdmin ? 'admin' : 'user';
}

function normalizeUser(id: string, data: Record<string, unknown>): User {
  const uid = pickString(data.uid, id);
  const email = pickString(data.email, data.emailLower);
  const displayName = pickString(data.displayName, data.name);
  const fullName = pickString(data.fullName, displayName);
  const fallbackName = email ? email.split('@')[0] : uid.slice(0, 10);
  const role = pickString(data.role).toLowerCase();
  const isAdmin = data.isAdmin === true || data.admin === true || role === 'admin';

  return {
    id,
    uid,
    email,
    emailLower: pickString(data.emailLower, email.toLowerCase()),
    displayName,
    fullName,
    name: pickString(fullName, displayName, fallbackName),
    photoURL: pickString(data.photoURL),
    imageUrl: pickString(data.imageUrl, data.picture),
    provider: normalizeProvider(pickString(data.provider, data.signInProvider)),
    role: normalizeRole(role, isAdmin),
    adminRole: normalizeRole(pickString(data.adminRole), isAdmin),
    plan: pickString(data.plan, data.tier, data.subscriptionTier, 'Free'),
    isAdmin,
    admin: data.admin === true,
    onboardingCompleted: data.onboardingCompleted === true,
    emailVerified: pickBoolean(data.emailVerified),
    disabled: data.disabled === true || data.accountDisabled === true,
    banned: data.banned === true,
    schemaVersion: pickNumber(data.schemaVersion),
    createdAtMillis: getTimestampMillis(data.createdAt),
    updatedAtMillis: getTimestampMillis(data.updatedAt),
    lastLoginAtMillis: getTimestampMillis(data.lastLoginAt),
  };
}

function getActivityMillis(user: User): number {
  return user.lastLoginAtMillis || user.updatedAtMillis || user.createdAtMillis;
}

function sortUsers(users: User[]): User[] {
  return users.toSorted((a, b) => {
    const aTime = a.createdAtMillis || getActivityMillis(a);
    const bTime = b.createdAtMillis || getActivityMillis(b);
    return bTime - aTime;
  });
}

function formatDate(millis: number): string {
  if (!millis) return 'Not recorded';
  return new Date(millis).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatRelativeTime(millis: number): string {
  if (!millis) return 'No activity';

  const diff = Date.now() - millis;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return formatDate(millis);
}

function formatCount(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(value);
}

function getInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function getAvatarUrl(user: User): string {
  return user.imageUrl || user.photoURL;
}

function StatusBadge({
  children,
  tone = 'gray',
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
}) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE_TONES[tone]}`}>
      {children}
    </span>
  );
}

function MetricTile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-gray-950">{value}</p>
      {hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
    </div>
  );
}

function UserAvatar({ user, size = 'size-10' }: { user: User; size?: string }) {
  const avatarUrl = getAvatarUrl(user);

  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt={user.name}
        width={44}
        height={44}
        className={`${size} rounded-full object-cover ring-1 ring-gray-200`}
        unoptimized
      />
    );
  }

  return (
    <div className={`flex ${size} items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white`}>
      {getInitials(user.name)}
    </div>
  );
}

function RecentUserCard({ user }: { user: User }) {
  const activityMillis = getActivityMillis(user);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
      <div className="flex min-w-0 items-center gap-3">
        <UserAvatar user={user} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-gray-950">{user.name}</p>
          <p className="truncate text-xs text-gray-500">{user.email || user.uid}</p>
        </div>
        <StatusBadge tone={user.isAdmin ? 'green' : 'gray'}>{user.isAdmin ? 'Admin' : 'User'}</StatusBadge>
      </div>
      <p className="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-500">{formatRelativeTime(activityMillis)}</p>
    </div>
  );
}

function MobileUserCard({ user }: { user: User }) {
  const activityMillis = getActivityMillis(user);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <UserAvatar user={user} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-950">{user.name}</p>
          <p className="mt-1 truncate text-xs text-gray-500">{user.email || 'No email saved'}</p>
          <p className="mt-1 truncate font-mono text-[11px] text-gray-400">{user.uid}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        <StatusBadge tone={user.isAdmin ? 'green' : 'gray'}>{user.isAdmin ? 'Admin' : 'User'}</StatusBadge>
        <StatusBadge tone={user.onboardingCompleted ? 'blue' : 'amber'}>
          {user.onboardingCompleted ? 'Onboarded' : 'Needs setup'}
        </StatusBadge>
        {user.disabled || user.banned ? <StatusBadge tone="red">Blocked</StatusBadge> : null}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-gray-100 pt-4 text-xs">
        <div>
          <dt className="text-gray-500">Provider</dt>
          <dd className="mt-1 font-medium text-gray-900">{user.provider}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Plan</dt>
          <dd className="mt-1 font-medium text-gray-900">{user.plan}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Joined</dt>
          <dd className="mt-1 font-medium text-gray-900">{formatDate(user.createdAtMillis)}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Last active</dt>
          <dd className="mt-1 font-medium text-gray-900">{formatRelativeTime(activityMillis)}</dd>
        </div>
      </dl>
    </div>
  );
}

export default function UsersPage() {
  const [state, dispatch] = useReducer(usersReducer, INITIAL_USERS_STATE);
  const { users, loading, refreshing, searchQuery, error } = state;

  const fetchUsers = useCallback(async (refresh = false) => {
    dispatch({ type: 'load:start', refresh });

    try {
      const snap = await getDocs(collection(db, 'users'));
      const nextUsers = sortUsers(
        snap.docs.map((docSnap) =>
          normalizeUser(docSnap.id, docSnap.data() as Record<string, unknown>)
        )
      );
      dispatch({ type: 'load:success', users: nextUsers });
    } catch (nextError) {
      console.error(nextError);
      dispatch({
        type: 'load:error',
        error: nextError instanceof Error ? nextError.message : 'Unable to load users.',
      });
    }
  }, []);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const filtered = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    if (!needle) return users;

    return users.filter((user) =>
      [
        user.name,
        user.email,
        user.emailLower,
        user.uid,
        user.provider,
        user.role,
        user.adminRole,
        user.plan,
      ]
        .join(' ')
        .toLowerCase()
        .includes(needle)
    );
  }, [searchQuery, users]);

  const stats = useMemo(() => {
    const now = Date.now();
    const adminCount = users.filter((user) => user.isAdmin).length;
    const onboardedCount = users.filter((user) => user.onboardingCompleted).length;
    const recentCount = users.filter((user) => user.createdAtMillis >= now - RECENT_WINDOW_MS).length;
    const disabledCount = users.filter((user) => user.disabled || user.banned).length;

    return {
      adminCount,
      disabledCount,
      onboardedCount,
      recentCount,
      regularCount: users.length - adminCount,
    };
  }, [users]);

  const recentUsers = useMemo(
    () =>
      sortUsers(users)
        .filter((user) => user.createdAtMillis || getActivityMillis(user))
        .slice(0, RECENT_LIMIT),
    [users]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-gray-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-950">Users</h1>
          <p className="mt-1 text-sm text-gray-500">
            {loading ? 'Loading registered users' : `${users.length} registered users`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void fetchUsers(true)}
          disabled={loading || refreshing}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {refreshing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}
          Refresh
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Total" value={loading ? '—' : formatCount(users.length)} hint="All user documents" />
        <MetricTile label="Recent" value={loading ? '—' : formatCount(stats.recentCount)} hint="Created in 7 days" />
        <MetricTile label="Admins" value={loading ? '—' : formatCount(stats.adminCount)} hint={`${formatCount(stats.regularCount)} standard`} />
        <MetricTile label="Blocked" value={loading ? '—' : formatCount(stats.disabledCount)} hint={`${formatCount(stats.onboardedCount)} onboarded`} />
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>{error}</p>
        </div>
      ) : null}

      {recentUsers.length > 0 ? (
        <section className="rounded-lg border border-gray-200 bg-gray-50/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-950">Recent users</h2>
              <p className="mt-1 text-xs text-gray-500">Newest accounts and latest activity.</p>
            </div>
            <span className="text-xs font-medium text-gray-500">{recentUsers.length} latest</span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {recentUsers.map((user) => (
              <RecentUserCard key={user.id} user={user} />
            ))}
          </div>
        </section>
      ) : null}

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-gray-200 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-950">All users</h2>
            <p className="text-xs text-gray-500">
              {loading ? 'Preparing user records' : `${filtered.length} of ${users.length} shown`}
            </p>
          </div>
          <div className="relative w-full lg:max-w-md">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              aria-label="Search users"
              placeholder="Search users"
              value={searchQuery}
              onChange={(event) => dispatch({ type: 'search:set', value: event.target.value })}
              className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-10 pr-3 text-sm text-gray-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-6 animate-spin text-blue-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="mt-3 text-sm font-medium text-gray-900">{searchQuery ? 'No users found' : 'No users yet'}</p>
            <p className="mt-1 text-xs text-gray-500">
              {searchQuery ? 'Try a different name, email, UID, provider, role, or plan.' : 'User records will appear here after signup.'}
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-3 p-3 md:hidden">
              {filtered.map((user) => (
                <MobileUserCard key={user.id} user={user} />
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[880px]">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">User</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Provider</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Joined</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Last active</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Record</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((user) => {
                    const activityMillis = getActivityMillis(user);

                    return (
                      <tr key={user.id} className="align-top hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <UserAvatar user={user} />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-gray-900">{user.name}</p>
                              <p className="mt-1 truncate text-xs text-gray-500">{user.email || 'No email saved'}</p>
                              <p className="mt-1 max-w-[260px] truncate font-mono text-[11px] text-gray-400">
                                {user.uid}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex max-w-[190px] flex-wrap gap-1.5">
                            <StatusBadge tone={user.isAdmin ? 'green' : 'gray'}>{user.isAdmin ? 'Admin' : 'User'}</StatusBadge>
                            <StatusBadge tone={user.onboardingCompleted ? 'blue' : 'amber'}>
                              {user.onboardingCompleted ? 'Onboarded' : 'Needs setup'}
                            </StatusBadge>
                            {user.emailVerified === true ? <StatusBadge tone="green">Verified</StatusBadge> : null}
                            {user.emailVerified === false ? <StatusBadge tone="amber">Email unverified</StatusBadge> : null}
                            {user.disabled || user.banned ? <StatusBadge tone="red">Blocked</StatusBadge> : null}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-700">
                          <p className="font-medium text-gray-900">{user.provider}</p>
                          <p className="mt-1 text-xs text-gray-500">{user.plan}</p>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-700">{formatDate(user.createdAtMillis)}</td>
                        <td className="px-4 py-4 text-sm text-gray-700">
                          <p>{formatRelativeTime(activityMillis)}</p>
                          <p className="mt-1 text-xs text-gray-400">Updated {formatDate(user.updatedAtMillis)}</p>
                        </td>
                        <td className="px-4 py-4">
                          <div className="min-w-[160px]">
                            <p className="truncate font-mono text-xs text-gray-600">{user.id}</p>
                            <p className="mt-1 text-xs text-gray-400">
                              {user.schemaVersion ? `Schema v${user.schemaVersion}` : 'Schema not recorded'}
                            </p>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
