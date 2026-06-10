'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Activity,
  Music2,
  ListMusic,
  Mic2,
  Search,
  ShieldAlert,
  Users,
  BarChart3,
  Flag,
  Megaphone,
  Bell,
  ShieldCheck,
  LogOut,
  LayoutDashboard,
  MonitorPlay,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { hasPermission } from '@/lib/permissions';
import { AdminPermission } from '@/types';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission: AdminPermission;
  group: string;
}

const navItems: NavItem[] = [
  { label: 'Overview', href: '/dashboard', icon: LayoutDashboard, permission: 'overview.view', group: 'Monitor' },
  { label: 'Songs', href: '/dashboard/songs', icon: Music2, permission: 'catalog.manage', group: 'Catalog' },
  { label: 'Playlists', href: '/dashboard/playlists', icon: ListMusic, permission: 'playlists.manage', group: 'Catalog' },
  { label: 'Artists', href: '/dashboard/artists', icon: Mic2, permission: 'artists.manage', group: 'Catalog' },
  { label: 'Discovery', href: '/dashboard/discovery', icon: Search, permission: 'discovery.manage', group: 'Growth' },
  { label: 'Home Video', href: '/dashboard/home-video', icon: MonitorPlay, permission: 'home_video.manage', group: 'Growth' },
  { label: 'Moderation', href: '/dashboard/moderation', icon: ShieldAlert, permission: 'moderation.manage', group: 'Trust' },
  { label: 'Users', href: '/dashboard/users', icon: Users, permission: 'users.manage', group: 'Trust' },
  { label: 'Analytics', href: '/dashboard/analytics', icon: BarChart3, permission: 'analytics.view', group: 'Monitor' },
  { label: 'Feature Flags', href: '/dashboard/flags', icon: Flag, permission: 'flags.manage', group: 'Release' },
  { label: 'Promotions', href: '/dashboard/promotions', icon: Megaphone, permission: 'promotions.manage', group: 'Growth' },
  { label: 'Notifications', href: '/dashboard/notifications', icon: Bell, permission: 'notifications.manage', group: 'Growth' },
  { label: 'Admin Roles', href: '/dashboard/roles', icon: ShieldCheck, permission: 'roles.manage', group: 'Security' },
];

const groupOrder = ['Monitor', 'Catalog', 'Growth', 'Trust', 'Release', 'Security'];

interface SidebarProps {
  className?: string;
  onNavigate?: () => void;
}

export function Sidebar({ className, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const { session, signOut } = useAuth();

  if (!session) return null;

  const groupedItems = groupOrder.flatMap((group) => {
    const items = navItems.filter(
      (item) =>
        item.group === group &&
        hasPermission(session.role, session.permissions, item.permission)
    );
    return items.length > 0 ? [{ group, items }] : [];
  });

  return (
    <aside className={cn('h-full w-64 border-r border-gray-200 bg-white', className)}>
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex items-center gap-3 border-b border-gray-200 px-6 py-4">
          <div className="flex size-10 items-center justify-center overflow-hidden rounded-lg bg-gray-950">
            <Image
              src="/admin-mark.svg"
              alt="Mavrixfy Admin"
              width={40}
              height={40}
              className="size-10 object-cover"
              priority
            />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Mavrixfy</h1>
            <p className="text-xs text-gray-500">Admin Panel</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4">
          <div className="space-y-6">
            {groupedItems.map(({ group, items }) => (
              <div key={group}>
                <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  {group}
                </p>
                <div className="space-y-1">
                  {items.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onNavigate}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                        )}
                      >
                        <Icon className="size-5" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </nav>

        {/* User Profile */}
        <div className="border-t border-gray-200 p-4">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-950">
                <Image
                  src="/admin-mark.svg"
                  alt=""
                  width={40}
                  height={40}
                  className="size-10 object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">{session.name}</p>
                <p className="truncate text-xs text-gray-500">{session.email}</p>
                <p className="truncate text-xs text-gray-500 capitalize">{session.role.replace('_', ' ')}</p>
              </div>
            </div>
            <button type="button"
              onClick={() => signOut()}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              <LogOut className="size-4" />
              Sign out
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
