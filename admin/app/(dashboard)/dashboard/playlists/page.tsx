'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import {
  collection, getDocs, query, orderBy, limit,
  deleteDoc, doc, addDoc, updateDoc, serverTimestamp, arrayUnion, arrayRemove
} from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
import { useAuth } from '@/hooks/useAuth';
import { ListMusic, Plus, Search, Edit, Trash2, Music2, Loader2, X, Check, PlusCircle, MinusCircle } from 'lucide-react';

interface Song { id: string; title: string; artist: string; imageUrl?: string; }
interface Playlist {
  id: string; name: string; description?: string;
  imageUrl?: string; songs?: string[]; isPublic?: boolean; createdAt?: any;
  createdBy?: { uid?: string; fullName?: string; imageUrl?: string | null };
}

const EMPTY_FORM = { name: '', description: '', imageUrl: '', isPublic: true };

export default function PlaylistsPage() {
  const { session } = useAuth();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [allSongs, setAllSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  // Song management panel
  const [managingId, setManagingId] = useState<string | null>(null);
  const [songSearch, setSongSearch] = useState('');

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const [pSnap, sSnap] = await Promise.all([
        getDocs(query(collection(db, 'playlists'), orderBy('createdAt', 'desc'), limit(200))).catch(() =>
          getDocs(query(collection(db, 'playlists'), limit(200)))
        ),
        getDocs(query(collection(db, 'songs'), limit(500))),
      ]);
      setPlaylists(pSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Playlist[]);
      setAllSongs(sSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Song[]);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Playlist name is required.'); return; }
    setSaving(true); setError('');
    try {
      const data = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        imageUrl: form.imageUrl.trim() || undefined,
        isPublic: form.isPublic,
        updatedAt: serverTimestamp(),
        createdBy: { uid: session?.uid, fullName: session?.name, imageUrl: null },
      };
      if (editId) {
        await updateDoc(doc(db, 'playlists', editId), data);
        setPlaylists(prev => prev.map(p => p.id === editId ? { ...p, ...data, id: editId } as Playlist : p));
      } else {
        const ref = await addDoc(collection(db, 'playlists'), { ...data, songs: [], createdAt: serverTimestamp() });
        setPlaylists(prev => [{ id: ref.id, ...data, songs: [] } as Playlist, ...prev]);
      }
      closeModal();
    } catch (e: any) { setError(e.message || 'Failed to save.'); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this playlist?')) return;
    await deleteDoc(doc(db, 'playlists', id));
    setPlaylists(prev => prev.filter(p => p.id !== id));
  }

  async function toggleSong(playlistId: string, songId: string, inPlaylist: boolean) {
    const ref = doc(db, 'playlists', playlistId);
    if (inPlaylist) {
      await updateDoc(ref, { songs: arrayRemove(songId) });
      setPlaylists(prev => prev.map(p => p.id === playlistId
        ? { ...p, songs: (p.songs || []).filter(s => s !== songId) } : p));
    } else {
      await updateDoc(ref, { songs: arrayUnion(songId) });
      setPlaylists(prev => prev.map(p => p.id === playlistId
        ? { ...p, songs: [...(p.songs || []), songId] } : p));
    }
  }

  function openEdit(p: Playlist) {
    setEditId(p.id);
    setForm({ name: p.name || '', description: p.description || '', imageUrl: p.imageUrl || '', isPublic: p.isPublic ?? true });
    setShowModal(true);
  }

  function closeModal() { setShowModal(false); setForm(EMPTY_FORM); setEditId(null); setError(''); }

  const managingPlaylist = playlists.find(p => p.id === managingId);
  const filteredSongsForManage = allSongs.filter(s =>
    s.title?.toLowerCase().includes(songSearch.toLowerCase()) ||
    s.artist?.toLowerCase().includes(songSearch.toLowerCase())
  );

  const filtered = playlists.filter(p =>
    p.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Playlists</h1>
          <p className="mt-1 text-sm text-gray-500">{playlists.length} playlists total</p>
        </div>
        <button onClick={() => { setEditId(null); setForm(EMPTY_FORM); setShowModal(true); }}
          className="btn-primary flex items-center gap-2">
          <Plus className="size-4" /> Create Playlist
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
        <input type="text" placeholder="Search playlists..." value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)} className="input-field pl-10" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 animate-spin text-blue-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white py-16 text-center shadow-sm">
          <ListMusic className="mx-auto size-10 text-gray-300" />
          <p className="mt-3 text-sm font-medium text-gray-900">{searchQuery ? 'No playlists found' : 'No playlists yet'}</p>
          <p className="mt-1 text-xs text-gray-500">Create your first playlist to get started</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(playlist => (
            <div key={playlist.id} className="rounded-lg border border-gray-200 bg-white shadow-sm">
              {playlist.imageUrl ? (
                <Image src={playlist.imageUrl} alt={playlist.name} width={400} height={160} className="h-40 w-full rounded-t-lg object-cover" unoptimized />
              ) : (
                <div className="flex h-40 w-full items-center justify-center rounded-t-lg bg-gray-100">
                  <ListMusic className="size-10 text-gray-300" />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{playlist.name}</h3>
                    {playlist.description && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-gray-500">{playlist.description}</p>
                    )}
                    {playlist.createdBy?.fullName && (
                      <p className="mt-1 text-xs text-gray-400">
                        Created by: <span className="font-medium text-gray-600">{playlist.createdBy.fullName}</span>
                      </p>
                    )}
                  </div>
                  {playlist.isPublic === false && (
                    <span className="flex-shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">Private</span>
                  )}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Music2 className="size-3.5" />
                    <span>{playlist.songs?.length ?? 0} songs</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setManagingId(playlist.id); setSongSearch(''); }}
                      className="rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50">
                      Manage Songs
                    </button>
                    <button onClick={() => openEdit(playlist)}
                      className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                      <Edit className="size-4" />
                    </button>
                    <button onClick={() => handleDelete(playlist.id)}
                      className="rounded-md p-1.5 text-red-500 hover:bg-red-50 hover:text-red-700">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Playlist Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" aria-label="Close modal" className="fixed inset-0 bg-black/40" onClick={closeModal} />
          <div className="relative w-full max-w-md rounded-lg border border-gray-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-base font-semibold text-gray-900">{editId ? 'Edit Playlist' : 'Create Playlist'}</h2>
              <button onClick={closeModal} className="rounded-md p-1 text-gray-400 hover:bg-gray-100"><X className="size-5" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {error && <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
              <div>
                <label htmlFor="playlists-name-1" className="block text-xs font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
                <input id="playlists-name-1" className="input-field" placeholder="Playlist name" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label htmlFor="playlists-description-2" className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                <textarea id="playlists-description-2" className="input-field resize-none" rows={2} placeholder="Optional description"
                  value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div>
                <label htmlFor="playlists-cover-image-url-3" className="block text-xs font-medium text-gray-700 mb-1">Cover Image URL</label>
                <input id="playlists-cover-image-url-3" className="input-field" placeholder="https://..." value={form.imageUrl}
                  onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))} />
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="isPublic" checked={form.isPublic}
                  onChange={e => setForm(f => ({ ...f, isPublic: e.target.checked }))}
                  className="size-4 rounded border-gray-300 text-blue-600" />
                <label htmlFor="isPublic" className="text-sm text-gray-700">Public playlist</label>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button onClick={closeModal} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                {editId ? 'Save Changes' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Songs Modal */}
      {managingId && managingPlaylist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" aria-label="Close modal" className="fixed inset-0 bg-black/40" onClick={() => setManagingId(null)} />
          <div className="relative flex w-full max-w-lg flex-col rounded-lg border border-gray-200 bg-white shadow-xl" style={{ maxHeight: '80vh' }}>
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Manage Songs</h2>
                <p className="text-xs text-gray-500">{managingPlaylist.name} · {managingPlaylist.songs?.length ?? 0} songs</p>
              </div>
              <button onClick={() => setManagingId(null)} className="rounded-md p-1 text-gray-400 hover:bg-gray-100"><X className="size-5" /></button>
            </div>
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                <input type="text" placeholder="Search songs to add..." value={songSearch}
                  onChange={e => setSongSearch(e.target.value)} className="input-field pl-10 py-2 text-sm" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
              {allSongs.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-500">No songs in catalog yet</div>
              ) : filteredSongsForManage.map(song => {
                const inPlaylist = (managingPlaylist.songs || []).includes(song.id);
                return (
                  <div key={song.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                    {song.imageUrl ? (
                      <Image src={song.imageUrl} alt={song.title} width={36} height={36} className="size-9 rounded-md object-cover flex-shrink-0" unoptimized />
                    ) : (
                      <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-md bg-gray-100">
                        <Music2 className="size-4 text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{song.title}</p>
                      <p className="text-xs text-gray-500 truncate">{song.artist}</p>
                    </div>
                    <button onClick={() => toggleSong(managingId, song.id, inPlaylist)}
                      className={`flex-shrink-0 rounded-md p-1.5 transition-colors ${inPlaylist
                        ? 'text-red-500 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}>
                      {inPlaylist ? <MinusCircle className="size-5" /> : <PlusCircle className="size-5" />}
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-gray-200 px-6 py-3 text-right">
              <button onClick={() => setManagingId(null)} className="btn-primary">Finish editing songs</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
