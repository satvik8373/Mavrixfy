import { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const getNotificationPermission = () => {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
};

export function NotificationPermissionBanner() {
  const { user } = useAuth();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!user?.id) return;

    const perm = getNotificationPermission();

    if (perm === 'granted') {
      // Already granted — silently ensure token is registered, no banner needed
      void import('@/services/webPushService')
        .then(({ registerWebPush }) => registerWebPush(user.id))
        .catch(() => {});
      return;
    }

    if (perm === 'default') {
      // Only show banner if not dismissed before
      if (!localStorage.getItem('notif_banner_dismissed')) {
        setShow(true);
      }
    }
    // 'denied' or 'unsupported' — do nothing, can't ask again
  }, [user?.id]);

  async function handleEnable() {
    if (!user?.id) return;
    setShow(false); // hide immediately to avoid double-click
    const { registerWebPush } = await import('@/services/webPushService');
    const result = await registerWebPush(user.id);
    if (result.status !== 'granted') {
      // Permission denied by user — don't show again
      localStorage.setItem('notif_banner_dismissed', '1');
    }
  }

  function handleDismiss() {
    setShow(false);
    localStorage.setItem('notif_banner_dismissed', '1');
  }

  if (!show) return null;

  return (
    <div className="mx-4 md:mx-6 mb-3 flex items-center gap-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 px-4 py-3">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-green-500/20">
        <Bell className="h-4 w-4 text-green-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">Enable notifications</p>
        <p className="text-xs text-white/60">Get notified about new music and updates</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button type="button"
          onClick={handleEnable}
          className="rounded-full bg-green-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-green-400 transition-colors"
        >
          Enable
        </button>
        <button type="button" onClick={handleDismiss} className="rounded-full p-1 text-white/40 hover:text-white/70 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
