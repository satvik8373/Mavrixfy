'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { CommandPalette } from '@/components/CommandPalette';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { Loader2, Menu, X } from 'lucide-react';

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const { push } = useRouter();
  const { session, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !session) {
      push('/login');
    }
  }, [session, loading, push]);

  useEffect(() => {
    if (!sidebarOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [sidebarOpen]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="size-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar className="fixed left-0 top-0 z-40 hidden h-screen lg:flex" />

      <div className="safe-header-height safe-px safe-top fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-gray-200 bg-white lg:hidden">
        <div className="flex items-center gap-3">
          <Image
            src="/admin-mark.svg"
            alt="Mavrixfy Admin"
            width={36}
            height={36}
            className="size-9 rounded-lg bg-gray-950 object-cover"
            priority
          />
          <div>
            <p className="text-sm font-semibold text-gray-900">Mavrixfy</p>
            <p className="text-xs text-gray-500">Admin Panel</p>
          </div>
        </div>
        <button
          type="button"
          aria-label="Open navigation"
          onClick={() => setSidebarOpen(true)}
          className="inline-flex size-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 shadow-sm"
        >
          <Menu className="size-5" />
        </button>
      </div>

      {sidebarOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation overlay"
            className="absolute inset-0 bg-gray-950/45"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="safe-top safe-bottom absolute inset-y-0 left-0 max-w-[85vw] bg-white shadow-xl">
            <button
              type="button"
              aria-label="Close navigation"
              onClick={() => setSidebarOpen(false)}
              className="absolute right-3 top-[calc(var(--safe-top)+0.75rem)] z-10 inline-flex size-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 shadow-sm"
            >
              <X className="size-5" />
            </button>
            <Sidebar onNavigate={() => setSidebarOpen(false)} />
          </div>
        </div>
      ) : null}

      <main className="safe-main-offset min-w-0 flex-1 lg:ml-64 lg:pt-0">
        <div className="mx-auto w-full max-w-screen-2xl px-4 py-5 sm:px-6 lg:p-8">
          {children}
        </div>
      </main>
      <CommandPalette />
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </AuthProvider>
  );
}
