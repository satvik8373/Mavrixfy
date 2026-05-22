'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, limit, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
import { Bell, Plus, Send, Users, Target, Loader2, X, Globe, Smartphone, Monitor } from 'lucide-react';

type Platform = 'all' | 'web' | 'android' | 'ios';

interface Notification { id: string; title: string; message: string; sentAt: any; delivered: number; opened: number; platform?: Platform; }

const EMPTY_FORM = { title: '', message: '', platform: 'all' as Platform };

const PLATFORM_OPTIONS: { value: Platform; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: 'all',     label: 'All',     icon: <Bell className="size-4" />,       desc: 'Web + Android + iOS' },
  { value: 'web',     label: 'Web',     icon: <Globe className="size-4" />,      desc: 'Browser only' },
  { value: 'android', label: 'Android', icon: <Smartphone className="size-4" />, desc: 'Android app' },
  { value: 'ios',     label: 'iOS',     icon: <Monitor className="size-4" />,    desc: 'iPhone / iPad' },
];

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading]   = useState(true);
  const [stats, setStats]       = useState({ sentToday: 0, totalDelivered: 0, openRate: 0 });
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [sendResult, setSendResult] = useState<any>(null);

  useEffect(() => { fetchNotifications(); }, []);

  async function fetchNotifications() {
    try {
      const snap = await getDocs(query(collection(db, 'notifications'), orderBy('sentAt', 'desc'), limit(50)));
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Notification[];
      setNotifications(data);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const sentToday = data.filter(n => n.sentAt?.toDate?.() >= today).length;
      const totalDelivered = data.reduce((s, n) => s + (n.delivered || 0), 0);
      const totalOpened = data.reduce((s, n) => s + (n.opened || 0), 0);
      setStats({ sentToday, totalDelivered, openRate: totalDelivered > 0 ? Math.round((totalOpened / totalDelivered) * 100) : 0 });
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function handleSend() {
    if (!form.title.trim() || !form.message.trim()) { setError('Title and message are required.'); return; }
    setSaving(true); setError(''); setSendResult(null);
    try {
      const data = {
        title: form.title.trim(),
        message: form.message.trim(),
        platform: form.platform,
        sentAt: serverTimestamp(),
        delivered: 0, opened: 0, status: 'sending',
      };
      const ref = await addDoc(collection(db, 'notifications'), data);

      const res = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          message: form.message.trim(),
          platform: form.platform,
          notificationId: ref.id,
        }),
      });
      const result = await res.json();
      setSendResult(result);

      setNotifications(prev => [{ id: ref.id, ...data, delivered: result.delivered || 0 } as any, ...prev]);
      setStats(s => ({ ...s, sentToday: s.sentToday + 1, totalDelivered: s.totalDelivered + (result.delivered || 0) }));
      setForm(EMPTY_FORM);
    } catch (e: any) { setError(e.message || 'Failed to send.'); }
    finally { setSaving(false); }
  }

  const platformBadge = (p?: Platform) => {
    const map: Record<string, string> = {
      web: 'bg-blue-100 text-blue-700',
      android: 'bg-green-100 text-green-700',
      ios: 'bg-gray-100 text-gray-700',
      all: 'bg-purple-100 text-purple-700',
    };
    return (
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${map[p || 'all'] || map.all}`}>
        {p || 'all'}
      </span>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Notifications</h1>
          <p className="mt-1 text-sm text-gray-500">Send push notifications to users</p>
        </div>
        <button onClick={() => { setShowModal(true); setSendResult(null); }} className="btn-primary flex items-center gap-2">
          <Plus className="size-4" /> New Notification
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Sent Today',      value: stats.sentToday,      icon: Send,   color: 'text-blue-600',   bg: 'bg-blue-50' },
          { label: 'Total Delivered', value: stats.totalDelivered, icon: Users,  color: 'text-green-600',  bg: 'bg-green-50' },
          { label: 'Open Rate',       value: `${stats.openRate}%`, icon: Target, color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">{label}</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{loading ? '—' : value}</p>
              </div>
              <div className={`rounded-lg p-2 ${bg}`}><Icon className={`size-5 ${color}`} /></div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Recent Notifications</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="size-6 animate-spin text-blue-600" /></div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Bell className="size-10 text-gray-300" />
            <p className="mt-3 text-sm font-medium text-gray-900">No notifications sent yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {notifications.map(n => (
              <div key={n.id} className="flex items-start justify-between px-6 py-4 hover:bg-gray-50">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900 truncate">{n.title}</p>
                    {platformBadge(n.platform)}
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500 truncate">{n.message}</p>
                </div>
                <div className="ml-4 text-right flex-shrink-0">
                  <p className="text-xs text-gray-500">{n.sentAt?.toDate?.().toLocaleDateString()}</p>
                  <p className="mt-0.5 text-xs text-gray-400">{n.delivered || 0} delivered</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" aria-label="Close modal" className="fixed inset-0 bg-black/40" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-md rounded-lg border border-gray-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-base font-semibold text-gray-900">Send Notification</h2>
              <button onClick={() => setShowModal(false)} className="rounded-md p-1 text-gray-400 hover:bg-gray-100"><X className="size-5" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {error && <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

              {/* Send result */}
              {sendResult && (
                <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
                  ✓ Delivered to {sendResult.delivered} / {sendResult.total} devices
                  {sendResult.breakdown && (
                    <div className="mt-1 text-xs text-green-600 flex gap-3">
                      <span>Web: {sendResult.breakdown.web?.delivered ?? 0}</span>
                      <span>Android: {sendResult.breakdown.expo?.delivered ?? 0}</span>
                      <span>iOS: {sendResult.breakdown.expo?.delivered ?? 0}</span>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label htmlFor="notifications-title-1" className="block text-xs font-medium text-gray-700 mb-1">Title <span className="text-red-500">*</span></label>
                <input id="notifications-title-1" className="input-field" placeholder="Notification title" value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>

              <div>
                <label htmlFor="notifications-message-2" className="block text-xs font-medium text-gray-700 mb-1">Message <span className="text-red-500">*</span></label>
                <textarea id="notifications-message-2" className="input-field resize-none" rows={3} placeholder="Notification message..."
                  value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} />
              </div>

              {/* Platform selector */}
              <div>
                <p className="block text-xs font-medium text-gray-700 mb-2">Send To</p>
                <div className="grid grid-cols-4 gap-2">
                  {PLATFORM_OPTIONS.map(opt => (
                    <button key={opt.value} type="button"
                      onClick={() => setForm(f => ({ ...f, platform: opt.value }))}
                      className={`rounded-lg border p-2.5 text-xs font-medium transition-colors flex flex-col items-center gap-1 ${
                        form.platform === opt.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {opt.icon}
                      <span>{opt.label}</span>
                      <span className="text-[10px] opacity-60 font-normal">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSend} disabled={saving} className="btn-primary flex items-center gap-2">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                {saving ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
