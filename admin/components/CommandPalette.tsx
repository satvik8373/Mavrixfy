'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import { Search, Music2, ListMusic, Mic2, Users, Flag, Bell, Megaphone } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CommandAction {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
}

export function CommandPalette() {
  const { push } = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const actions: CommandAction[] = [
    {
      id: 'songs',
      label: 'Go to Songs',
      description: 'Manage music catalog',
      icon: Music2,
      action: () => push('/dashboard/songs'),
    },
    {
      id: 'playlists',
      label: 'Go to Playlists',
      description: 'Manage editorial playlists',
      icon: ListMusic,
      action: () => push('/dashboard/playlists'),
    },
    {
      id: 'artists',
      label: 'Go to Artists',
      description: 'Manage artist profiles',
      icon: Mic2,
      action: () => push('/dashboard/artists'),
    },
    {
      id: 'users',
      label: 'Go to Users',
      description: 'Manage user accounts',
      icon: Users,
      action: () => push('/dashboard/users'),
    },
    {
      id: 'flags',
      label: 'Go to Feature Flags',
      description: 'Toggle platform features',
      icon: Flag,
      action: () => push('/dashboard/flags'),
    },
    {
      id: 'promotions',
      label: 'Go to Promotions',
      description: 'Manage banners and campaigns',
      icon: Megaphone,
      action: () => push('/dashboard/promotions'),
    },
    {
      id: 'notifications',
      label: 'Go to Notifications',
      description: 'Send push notifications',
      icon: Bell,
      action: () => push('/dashboard/notifications'),
    },
  ];

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] px-4">
      <button
        type="button"
        aria-label="Close command palette"
        className="fixed inset-0 bg-black/40"
        onClick={() => setOpen(false)}
      />

      <Command className="relative w-full max-w-xl overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl">
        <div className="flex items-center border-b border-gray-200 px-4">
          <Search className="size-4 text-gray-400" />
          <Command.Input
            placeholder="Search commands..."
            className="w-full bg-transparent p-3.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
          />
        </div>

        <Command.List className="max-h-80 overflow-y-auto p-2">
          <Command.Empty className="py-8 text-center text-sm text-gray-500">
            No results found.
          </Command.Empty>

          <Command.Group heading="Quick Actions">
            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <Command.Item
                  key={action.id}
                  onSelect={() => { action.action(); setOpen(false); }}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm data-[selected=true]:bg-blue-50"
                >
                  <div className="flex size-8 items-center justify-center rounded-md bg-gray-100">
                    <Icon className="size-4 text-gray-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{action.label}</p>
                    <p className="text-xs text-gray-500">{action.description}</p>
                  </div>
                </Command.Item>
              );
            })}
          </Command.Group>
        </Command.List>

        <div className="border-t border-gray-200 px-4 py-2.5">
          <p className="text-xs text-gray-400">
            Press <kbd className="rounded border border-gray-200 bg-gray-100 px-1.5 py-0.5 text-xs font-medium">⌘K</kbd> to toggle
          </p>
        </div>
      </Command>
    </div>
  );
}
