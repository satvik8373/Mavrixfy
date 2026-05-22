'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { collection, getDocs, query, limit, deleteDoc, doc, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
import { Mic2, Plus, Search, Edit, Trash2, CheckCircle, Loader2, X, Check } from 'lucide-react';

interface Artist { id: string; name: string; bio?: string; imageUrl?: string; verified?: boolean; }
const EMPTY_FORM = { name: '', bio: '', imageUrl: '', verified: false };

export default function ArtistsPage() {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => { fetchArtists(); }, []);

  async function fetchArtists() {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'artists'), limit(200)));
      setArtists(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Artist[]);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Artist name is required.'); return; }
    setSaving(true); setError('');
    try {
      const data = { name: form.name.trim(), bio: form.bio.trim() || undefined, imageUrl: form.imageUrl.trim() || undefined, verified: form.verified, updatedAt: serverTimestamp() };
      if (editId) {
        await updateDoc(doc(db, 'artists', editId), data);
        setArtists(prev => prev.map(a => a.id === editId ? { ...a, ...data, id: editId } as Artist : a));
      } else {
        const ref = await addDoc(collection(db, 'artists'), { ...data, createdAt: serverTimestamp() });
        setArtists(prev => [{ id: ref.id, ...data } as Artist, ...prev]);
      }
      closeModal();
    } catch (e: any) { setError(e.message || 'Failed to save.'); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this artist?')) return;
    await deleteDoc(doc(db, 'artists', id));
    setArtists(prev => prev.filter(a => a.id !== id));
  }

  function openEdit(a: Artist) {
    setEditId(a.id);
    setForm({ name: a.name || '', bio: a.bio || '', imageUrl: a.imageUrl || '', verified: a.verified ?? false });
    setShowModal(true);
  }

  function closeModal() { setShowModal(false); setForm(EMPTY_FORM); setEditId(null); setError(''); }

  const filtered = artists.filter(a => a.name?.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Artists</h1>
          <p className="mt-1 text-sm text-gray-500">{artists.length} artists total</p>
        </div>
        <button type="button" onClick={() => { setEditId(null); setForm(EMPTY_FORM); setShowModal(true); }}
          className="btn-primary flex w-full items-center justify-center gap-2 sm:w-auto">
          <Plus className="size-4" /> Add Artist
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
        <input type="text" placeholder="Search artists..." value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)} className="input-field pl-10" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="size-6 animate-spin text-blue-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white py-16 text-center shadow-sm">
          <Mic2 className="mx-auto size-10 text-gray-300" />
          <p className="mt-3 text-sm font-medium text-gray-900">{searchQuery ? 'No artists found' : 'No artists yet'}</p>
          <p className="mt-1 text-xs text-gray-500">Add your first artist to get started</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {filtered.map(artist => (
            <div key={artist.id} className="rounded-lg border border-gray-200 bg-white p-5 text-center shadow-sm hover:shadow-md transition-shadow">
              {artist.imageUrl ? (
                <Image src={artist.imageUrl} alt={artist.name} width={80} height={80} className="mx-auto size-20 rounded-full object-cover" unoptimized />
              ) : (
                <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-gray-100">
                  <Mic2 className="size-8 text-gray-400" />
                </div>
              )}
              <div className="mt-3">
                <div className="flex items-center justify-center gap-1">
                  <h3 className="font-semibold text-gray-900">{artist.name}</h3>
                  {artist.verified && <CheckCircle className="size-4 text-blue-500" />}
                </div>
                {artist.bio && <p className="mt-1 line-clamp-2 text-xs text-gray-500">{artist.bio}</p>}
              </div>
              <div className="mt-4 flex items-center justify-center gap-2">
                <button type="button" onClick={() => openEdit(artist)} className="rounded-md border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50">
                  <Edit className="size-4" />
                </button>
                <button type="button" onClick={() => handleDelete(artist.id)} className="rounded-md border border-gray-200 p-1.5 text-red-500 hover:bg-red-50 hover:text-red-700">
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-[max(1rem,var(--safe-top))] pb-[max(1rem,var(--safe-bottom))]">
          <button type="button" aria-label="Close modal" className="fixed inset-0 bg-black/40" onClick={closeModal} />
          <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-base font-semibold text-gray-900">{editId ? 'Edit Artist' : 'Add Artist'}</h2>
              <button type="button" onClick={closeModal} className="rounded-md p-1 text-gray-400 hover:bg-gray-100"><X className="size-5" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {error && <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
              <div>
                <label htmlFor="artists-name-1" className="block text-xs font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
                <input id="artists-name-1" className="input-field" placeholder="Artist name" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label htmlFor="artists-bio-2" className="block text-xs font-medium text-gray-700 mb-1">Bio</label>
                <textarea id="artists-bio-2" className="input-field resize-none" rows={3} placeholder="Short bio..." value={form.bio}
                  onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} />
              </div>
              <div>
                <label htmlFor="artists-image-url-3" className="block text-xs font-medium text-gray-700 mb-1">Image URL</label>
                <input id="artists-image-url-3" className="input-field" placeholder="https://..." value={form.imageUrl}
                  onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))} />
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="verified" checked={form.verified}
                  onChange={e => setForm(f => ({ ...f, verified: e.target.checked }))}
                  className="size-4 rounded border-gray-300 text-blue-600" />
                <label htmlFor="verified" className="text-sm text-gray-700">Verified artist</label>
              </div>
            </div>
            <div className="flex flex-col-reverse gap-3 border-t border-gray-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
              <button type="button" onClick={closeModal} className="btn-secondary w-full sm:w-auto">Cancel</button>
              <button type="button" onClick={handleSave} disabled={saving} className="btn-primary flex w-full items-center justify-center gap-2 sm:w-auto">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                {editId ? 'Save Changes' : 'Add Artist'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

