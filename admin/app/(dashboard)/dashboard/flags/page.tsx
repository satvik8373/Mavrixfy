'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
import { Flag, Plus, Loader2, X, Check, Trash2 } from 'lucide-react';

interface FeatureFlag { id: string; name: string; description: string; enabled: boolean; platform: string[]; }
const PLATFORMS = ['iOS', 'Android', 'Web'];
const EMPTY_FORM = { name: '', description: '', enabled: false, platform: [] as string[] };

export default function FlagsPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { fetchFlags(); }, []);

  async function fetchFlags() {
    try {
      const snap = await getDocs(collection(db, 'featureFlags'));
      setFlags(snap.docs.map(d => ({ id: d.id, ...d.data() })) as FeatureFlag[]);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function toggleFlag(id: string) {
    const flag = flags.find(f => f.id === id);
    if (!flag) return;
    setToggling(id);
    try {
      const newEnabled = !flag.enabled;
      await updateDoc(doc(db, 'featureFlags', id), { enabled: newEnabled, updatedAt: serverTimestamp() });
      setFlags(prev => prev.map(f => f.id === id ? { ...f, enabled: newEnabled } : f));
    } catch (e) { console.error(e); }
    finally { setToggling(null); }
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Flag name is required.'); return; }
    setSaving(true); setError('');
    try {
      const data = { name: form.name.trim(), description: form.description.trim(), enabled: form.enabled, platform: form.platform, createdAt: serverTimestamp() };
      const ref = await addDoc(collection(db, 'featureFlags'), data);
      setFlags(prev => [...prev, { id: ref.id, ...data }]);
      setShowModal(false); setForm(EMPTY_FORM);
    } catch (e: any) { setError(e.message || 'Failed to save.'); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this feature flag?')) return;
    await deleteDoc(doc(db, 'featureFlags', id));
    setFlags(prev => prev.filter(f => f.id !== id));
  }

  function togglePlatform(p: string) {
    setForm(f => ({ ...f, platform: f.platform.includes(p) ? f.platform.filter(x => x !== p) : [...f.platform, p] }));
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Feature Flags</h1>
          <p className="mt-1 text-sm text-gray-500">Control feature rollouts across platforms</p>
        </div>
        <button type="button" onClick={() => setShowModal(true)} className="btn-primary flex w-full items-center justify-center gap-2 sm:w-auto">
          <Plus className="size-4" /> New Flag
        </button>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="size-6 animate-spin text-blue-600" /></div>
        ) : flags.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Flag className="size-10 text-gray-300" />
            <p className="mt-3 text-sm font-medium text-gray-900">No feature flags</p>
            <p className="mt-1 text-xs text-gray-500">Create your first flag to control app features</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left">
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Flag</th>
                <th className="hidden px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 md:table-cell">Platforms</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {flags.map(flag => (
                <tr key={flag.id} className="hover:bg-gray-50">
                  <td className="p-4">
                    <p className="font-medium text-gray-900">{flag.name}</p>
                    <p className="mt-0.5 text-xs text-gray-500">{flag.description}</p>
                  </td>
                  <td className="hidden p-4 md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {flag.platform?.map(p => (
                        <span key={p} className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{p}</span>
                      ))}
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <button type="button" onClick={() => toggleFlag(flag.id)} disabled={toggling === flag.id}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${flag.enabled ? 'bg-blue-600' : 'bg-gray-200'}`}>
                      {toggling === flag.id
                        ? <Loader2 className="mx-auto size-3 animate-spin text-white" />
                        : <span className={`inline-block size-4 transform rounded-full bg-white shadow transition-transform ${flag.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                      }
                    </button>
                  </td>
                  <td className="p-4 text-right">
                    <button type="button" onClick={() => handleDelete(flag.id)} className="rounded-md p-1.5 text-red-500 hover:bg-red-50 hover:text-red-700">
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" aria-label="Close modal" className="fixed inset-0 bg-black/40" onClick={() => setShowModal(false)} />
          <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-base font-semibold text-gray-900">New Feature Flag</h2>
              <button type="button" onClick={() => setShowModal(false)} className="rounded-md p-1 text-gray-400 hover:bg-gray-100"><X className="size-5" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {error && <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
              <div>
                <label htmlFor="flags-flag-name-1" className="block text-xs font-medium text-gray-700 mb-1">Flag Name <span className="text-red-500">*</span></label>
                <input id="flags-flag-name-1" className="input-field" placeholder="e.g. dark_mode" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label htmlFor="flags-description-2" className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                <input id="flags-description-2" className="input-field" placeholder="What does this flag control?" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div>
                <p className="block text-xs font-medium text-gray-700 mb-2">Platforms</p>
                <div className="flex flex-wrap gap-3">
                  {PLATFORMS.map(p => (
                    <label key={p} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={form.platform.includes(p)} onChange={() => togglePlatform(p)}
                        className="size-4 rounded border-gray-300 text-blue-600" />
                      <span className="text-sm text-gray-700">{p}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="flagEnabled" checked={form.enabled} onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))}
                  className="size-4 rounded border-gray-300 text-blue-600" />
                <label htmlFor="flagEnabled" className="text-sm text-gray-700">Enable immediately</label>
              </div>
            </div>
            <div className="flex flex-col-reverse gap-3 border-t border-gray-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
              <button type="button" onClick={() => setShowModal(false)} className="btn-secondary w-full sm:w-auto">Cancel</button>
              <button type="button" onClick={handleSave} disabled={saving} className="btn-primary flex w-full items-center justify-center gap-2 sm:w-auto">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                Create Flag
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
