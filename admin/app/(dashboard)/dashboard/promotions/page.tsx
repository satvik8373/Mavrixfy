'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, deleteDoc, doc, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
import { Megaphone, Plus, Edit, Trash2, ImageIcon, Loader2, X, Check, Film, Music, Globe, Smartphone, Image, Upload, Link2, Search, ExternalLink, LayoutGrid, LayoutList, Maximize2 } from 'lucide-react';

type MediaType = 'image' | 'gif' | 'video' | 'audio';
type Platform  = 'web' | 'app';
type BannerLayout = 'hero' | 'card' | 'full-width' | 'sidebar';
type ActionType = 'none' | 'external' | 'song' | 'playlist' | 'artist' | 'album';

interface AttachedSong {
  id: string;
  title: string;
  artist: string;
  imageUrl: string;
  streamUrl: string;
}

interface Promotion {
  id: string;
  title: string;
  description: string;
  mediaUrl?: string;
  mediaType?: MediaType;
  cloudinaryPublicId?: string;
  platforms?: Platform;
  status: 'active' | 'scheduled' | 'ended';
  startDate?: string;
  endDate?: string;
  layout?: BannerLayout;
  actionType?: ActionType;
  actionUrl?: string;
  attachedSong?: AttachedSong;
  priority?: number;
}

const EMPTY_FORM = {
  title: '',
  description: '',
  mediaUrl: '',
  cloudinaryPublicId: '',
  platforms: 'web' as Platform,
  status: 'active' as 'active' | 'scheduled' | 'ended',
  startDate: '',
  endDate: '',
  layout: 'hero' as BannerLayout,
  actionType: 'none' as ActionType,
  actionUrl: '',
  attachedSong: null as AttachedSong | null,
  priority: 0,
};

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  scheduled: 'bg-blue-100 text-blue-800',
  ended: 'bg-gray-100 text-gray-600',
};

const PLATFORM_OPTIONS: { value: Platform; label: string; icon: React.ReactNode }[] = [
  { value: 'web', label: 'Web', icon: <Globe className="h-4 w-4" /> },
  { value: 'app', label: 'App', icon: <Smartphone className="h-4 w-4" /> },
];

const LAYOUT_OPTIONS: { value: BannerLayout; label: string; icon: React.ReactNode; description: string }[] = [
  { value: 'hero', label: 'Hero Banner', icon: <Maximize2 className="h-4 w-4" />, description: 'Large featured banner' },
  { value: 'card', label: 'Card', icon: <LayoutGrid className="h-4 w-4" />, description: 'Medium card layout' },
  { value: 'full-width', label: 'Full Width', icon: <LayoutList className="h-4 w-4" />, description: 'Spans entire width' },
  { value: 'sidebar', label: 'Sidebar', icon: <LayoutList className="h-4 w-4" />, description: 'Compact sidebar' },
];

const ACTION_OPTIONS: { value: ActionType; label: string }[] = [
  { value: 'none', label: 'No Action' },
  { value: 'external', label: 'External Link' },
  { value: 'song', label: 'Play Song' },
  { value: 'playlist', label: 'Open Playlist' },
  { value: 'artist', label: 'View Artist' },
  { value: 'album', label: 'View Album' },
];

/** Detect media type purely from URL */
function detectMediaType(url: string): MediaType {
  const clean = url.split('?')[0].toLowerCase();
  if (/\.(mp4|webm|mov|avi|mkv)$/.test(clean)) return 'video';
  if (/\.(mp3|ogg|wav|aac|flac|m4a)$/.test(clean)) return 'audio';
  if (/\.gif$/.test(clean)) return 'gif';
  return 'image';
}

function MediaTypeIcon({ type }: { type: MediaType }) {
  if (type === 'video') return <Film className="h-4 w-4 text-blue-500" />;
  if (type === 'audio') return <Music className="h-4 w-4 text-purple-500" />;
  if (type === 'gif')   return <Image className="h-4 w-4 text-pink-500" />;
  return <ImageIcon className="h-4 w-4 text-gray-400" />;
}

function MediaPreview({ url, type }: { url: string; type: MediaType }) {
  if (!url) return null;
  if (type === 'image' || type === 'gif')
    return <img src={url} alt="preview" className="h-16 w-24 rounded-lg object-cover flex-shrink-0" />;
  if (type === 'video')
    return <video src={url} className="h-16 w-24 rounded-lg object-cover flex-shrink-0" muted playsInline />;
  return (
    <div className="flex h-16 w-24 flex-shrink-0 items-center justify-center rounded-lg bg-purple-100">
      <Music className="h-6 w-6 text-purple-500" />
    </div>
  );
}

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');
  const [editId, setEditId]         = useState<string | null>(null);
  const [uploading, setUploading]   = useState(false);
  const [showSongSearch, setShowSongSearch] = useState(false);
  const [songQuery, setSongQuery]   = useState('');
  const [songResults, setSongResults] = useState<any[]>([]);
  const [searchingSongs, setSearchingSongs] = useState(false);

  useEffect(() => { fetchPromotions(); }, []);

  async function fetchPromotions() {
    try {
      const snap = await getDocs(collection(db, 'promotions'));
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Promotion[];
      // Sort by priority (higher first) then by creation date
      data.sort((a, b) => (b.priority || 0) - (a.priority || 0));
      setPromotions(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'audio/mpeg', 'audio/wav'];
    if (!validTypes.includes(file.type)) {
      setError('Invalid file type. Use images, videos, or audio files.');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File too large. Maximum size is 10MB.');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'mavrixfy/promotions');
      
      let type = 'image';
      if (file.type.startsWith('video/')) type = 'video';
      else if (file.type.startsWith('audio/')) type = 'audio';
      formData.append('type', type);

      const response = await fetch('/api/promotions/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        setForm(f => ({
          ...f,
          mediaUrl: result.data.url,
          cloudinaryPublicId: result.data.publicId,
        }));
      } else {
        setError(result.message || 'Upload failed');
      }
    } catch (e: any) {
      setError(e.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function searchSongs() {
    if (!songQuery.trim()) return;
    setSearchingSongs(true);
    try {
      const response = await fetch(`/api/music/search?query=${encodeURIComponent(songQuery)}&limit=50`);
      const data = await response.json();
      if (data.success) {
        setSongResults(data.data.results || []);
        if (data.data.results.length === 0) {
          console.log('[Promotions] No songs found for query:', songQuery);
        } else {
          console.log('[Promotions] Found songs:', data.data.results.length);
        }
      } else {
        console.error('[Promotions] Search failed:', data.message);
        setError(data.message || 'Search failed');
      }
    } catch (e) {
      console.error('Song search failed:', e);
      setError('Failed to search songs. Please try again.');
    } finally {
      setSearchingSongs(false);
    }
  }

  function attachSong(song: any) {
    setForm(f => ({
      ...f,
      attachedSong: {
        id: song.id,
        title: song.title,
        artist: song.artist,
        imageUrl: song.imageUrl,
        streamUrl: song.streamUrl,
      },
      actionType: 'song',
    }));
    setShowSongSearch(false);
    setSongQuery('');
    setSongResults([]);
  }

  async function handleSave() {
    if (!form.title.trim()) { setError('Title is required.'); return; }
    if (form.actionType === 'external' && !form.actionUrl.trim()) {
      setError('External link URL is required.');
      return;
    }
    setSaving(true); setError('');
    try {
      const url = form.mediaUrl.trim();
      const data: any = {
        title:       form.title.trim(),
        description: form.description.trim(),
        platforms:   form.platforms,
        status:      form.status,
        layout:      form.layout,
        actionType:  form.actionType,
        priority:    form.priority || 0,
        updatedAt:   serverTimestamp(),
      };

      // Only add fields if they have values (Firestore doesn't accept undefined)
      if (url) {
        data.mediaUrl = url;
        data.mediaType = detectMediaType(url);
      }
      if (form.cloudinaryPublicId) data.cloudinaryPublicId = form.cloudinaryPublicId;
      if (form.startDate) data.startDate = form.startDate;
      if (form.endDate) data.endDate = form.endDate;
      if (form.actionUrl.trim()) data.actionUrl = form.actionUrl.trim();
      if (form.attachedSong) data.attachedSong = form.attachedSong;

      if (editId) {
        await updateDoc(doc(db, 'promotions', editId), data);
        setPromotions(prev => prev.map(p => p.id === editId ? { ...p, ...data, id: editId } : p));
      } else {
        const ref = await addDoc(collection(db, 'promotions'), { ...data, createdAt: serverTimestamp() });
        setPromotions(prev => [{ id: ref.id, ...data } as Promotion, ...prev]);
      }
      closeModal();
      await fetchPromotions(); // Re-fetch to apply sorting
    } catch (e: any) { setError(e.message || 'Failed to save.'); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this promotion?')) return;
    await deleteDoc(doc(db, 'promotions', id));
    setPromotions(prev => prev.filter(p => p.id !== id));
  }

  function openEdit(p: Promotion) {
    setEditId(p.id);
    setForm({
      title:       p.title,
      description: p.description || '',
      mediaUrl:    p.mediaUrl    || '',
      cloudinaryPublicId: p.cloudinaryPublicId || '',
      platforms:   p.platforms   || 'web',
      status:      p.status,
      startDate:   p.startDate   || '',
      endDate:     p.endDate     || '',
      layout:      p.layout      || 'hero',
      actionType:  p.actionType  || 'none',
      actionUrl:   p.actionUrl   || '',
      attachedSong: p.attachedSong || null,
      priority:    p.priority    || 0,
    });
    setShowModal(true);
  }

  function closeModal() { 
    setShowModal(false); 
    setForm(EMPTY_FORM); 
    setEditId(null); 
    setError(''); 
    setShowSongSearch(false);
    setSongQuery('');
    setSongResults([]);
  }

  // Live-detect type as user types URL
  const detectedType = form.mediaUrl ? detectMediaType(form.mediaUrl) : null;

  const platformBadge = (p?: Platform) => p === 'app'
    ? <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700"><Smartphone className="h-3 w-3" />App</span>
    : <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700"><Globe className="h-3 w-3" />Web</span>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Promotions</h1>
          <p className="mt-1 text-sm text-gray-500">Manage banners and promotional campaigns</p>
        </div>
        <button onClick={() => { setEditId(null); setForm(EMPTY_FORM); setShowModal(true); }} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" /> Create Promotion
        </button>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-sm font-semibold text-gray-900">All Promotions ({promotions.length})</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>
        ) : promotions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Megaphone className="h-10 w-10 text-gray-300" />
            <p className="mt-3 text-sm font-medium text-gray-900">No promotions yet</p>
            <p className="mt-1 text-xs text-gray-500">Create your first promotional banner</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {promotions.map(promo => (
              <div key={promo.id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50">
                {promo.mediaUrl
                  ? <MediaPreview url={promo.mediaUrl} type={promo.mediaType || 'image'} />
                  : <div className="flex h-16 w-24 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100"><ImageIcon className="h-6 w-6 text-gray-400" /></div>
                }
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-medium text-gray-900 truncate">{promo.title}</h3>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[promo.status] || STATUS_STYLES.ended}`}>{promo.status}</span>
                    {promo.mediaType && (
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 capitalize">
                        <MediaTypeIcon type={promo.mediaType} />{promo.mediaType}
                      </span>
                    )}
                    {promo.layout && (
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 capitalize">
                        {promo.layout.replace('-', ' ')}
                      </span>
                    )}
                    {promo.actionType && promo.actionType !== 'none' && (
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 capitalize">
                        <Link2 className="h-3 w-3" />{promo.actionType}
                      </span>
                    )}
                    {platformBadge(promo.platforms)}
                    {(promo.priority || 0) > 0 && (
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700">
                        Priority: {promo.priority}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500 truncate">{promo.description}</p>
                  {promo.attachedSong && (
                    <p className="mt-0.5 text-xs text-blue-600 flex items-center gap-1">
                      <Music className="h-3 w-3" />
                      {promo.attachedSong.title} - {promo.attachedSong.artist}
                    </p>
                  )}
                  {(promo.startDate || promo.endDate) && (
                    <p className="mt-0.5 text-xs text-gray-400">{promo.startDate}{promo.endDate ? ` → ${promo.endDate}` : ''}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => openEdit(promo)} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><Edit className="h-4 w-4" /></button>
                  <button onClick={() => handleDelete(promo.id)} className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40" onClick={closeModal} />
          <div className="relative w-full max-w-md rounded-lg border border-gray-200 bg-white shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-base font-semibold text-gray-900">{editId ? 'Edit Promotion' : 'Create Promotion'}</h2>
              <button onClick={closeModal} className="rounded-md p-1 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {error && <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Title <span className="text-red-500">*</span></label>
                <input className="input-field" placeholder="Promotion title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                <textarea className="input-field resize-none" rows={2} placeholder="Short description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>

              {/* Banner Layout */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Banner Layout</label>
                <div className="grid grid-cols-2 gap-2">
                  {LAYOUT_OPTIONS.map(opt => (
                    <button key={opt.value} type="button" onClick={() => setForm(f => ({ ...f, layout: opt.value }))}
                      className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${form.layout === opt.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        {opt.icon}
                        <span className="text-sm font-medium text-gray-900">{opt.label}</span>
                      </div>
                      <p className="text-xs text-gray-500">{opt.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Media Upload */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Banner Media</label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="flex-1 cursor-pointer">
                      <div className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-600 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                        {uploading ? (
                          <><Loader2 className="h-4 w-4 animate-spin" />Uploading...</>
                        ) : (
                          <><Upload className="h-4 w-4" />Upload to Cloudinary</>
                        )}
                      </div>
                      <input type="file" className="hidden" accept="image/*,video/*,audio/*" onChange={handleFileUpload} disabled={uploading} />
                    </label>
                  </div>
                  
                  {form.mediaUrl && (
                    <div className="relative rounded-lg border border-gray-200 p-2">
                      <MediaPreview url={form.mediaUrl} type={detectMediaType(form.mediaUrl)} />
                      <button type="button" onClick={() => setForm(f => ({ ...f, mediaUrl: '', cloudinaryPublicId: '' }))}
                        className="absolute top-1 right-1 rounded-md bg-red-500 p-1 text-white hover:bg-red-600">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}

                  <div className="text-xs text-gray-500">Or paste URL:</div>
                  <input className="input-field text-sm" placeholder="https://... (image, gif, video, audio)" value={form.mediaUrl} onChange={e => setForm(f => ({ ...f, mediaUrl: e.target.value }))} />
                  {detectedType && (
                    <p className="flex items-center gap-1.5 text-xs text-gray-500">
                      <MediaTypeIcon type={detectedType} />
                      Detected: <span className="font-medium capitalize">{detectedType}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Action Type */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Click Action</label>
                <select className="input-field" value={form.actionType} onChange={e => setForm(f => ({ ...f, actionType: e.target.value as ActionType }))}>
                  {ACTION_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* External Link */}
              {form.actionType === 'external' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">External URL <span className="text-red-500">*</span></label>
                  <input className="input-field" placeholder="https://..." value={form.actionUrl} onChange={e => setForm(f => ({ ...f, actionUrl: e.target.value }))} />
                </div>
              )}

              {/* Attach Song */}
              {form.actionType === 'song' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">Attached Song</label>
                  {form.attachedSong ? (
                    <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <img src={form.attachedSong.imageUrl} alt="" className="h-12 w-12 rounded object-cover" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{form.attachedSong.title}</p>
                        <p className="text-xs text-gray-500 truncate">{form.attachedSong.artist}</p>
                      </div>
                      <button type="button" onClick={() => setForm(f => ({ ...f, attachedSong: null }))}
                        className="rounded-md p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setShowSongSearch(true)}
                      className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-600 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                      <Search className="h-4 w-4" />Search & Attach Song
                    </button>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Show On</label>
                <div className="grid grid-cols-2 gap-2">
                  {PLATFORM_OPTIONS.map(opt => (
                    <button key={opt.value} type="button" onClick={() => setForm(f => ({ ...f, platforms: opt.value }))}
                      className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${form.platforms === opt.value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}>
                      {opt.icon}{opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                <select className="input-field" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))}>
                  <option value="active">Active</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="ended">Ended</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
                  <input type="date" className="input-field" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
                  <input type="date" className="input-field" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Priority (0-100)</label>
                <input type="number" min="0" max="100" className="input-field" placeholder="0" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: parseInt(e.target.value) || 0 }))} />
                <p className="mt-1 text-xs text-gray-500">Higher priority promotions appear first</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button onClick={closeModal} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {editId ? 'Save Changes' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Song Search Modal */}
      {showSongSearch && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40" onClick={() => setShowSongSearch(false)} />
          <div className="relative w-full max-w-lg rounded-lg border border-gray-200 bg-white shadow-xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-base font-semibold text-gray-900">Search Songs</h2>
              <button onClick={() => setShowSongSearch(false)} className="rounded-md p-1 text-gray-400 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex gap-2">
                <input
                  className="input-field flex-1"
                  placeholder="Search for songs..."
                  value={songQuery}
                  onChange={e => setSongQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && searchSongs()}
                  autoFocus
                />
                <button onClick={searchSongs} disabled={searchingSongs || !songQuery.trim()}
                  className="btn-primary flex items-center gap-2 px-4">
                  {searchingSongs ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </button>
              </div>
              {songResults.length > 0 && (
                <p className="mt-2 text-xs text-gray-500">
                  Found {songResults.length} song{songResults.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {searchingSongs ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                </div>
              ) : songResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Music className="h-10 w-10 text-gray-300" />
                  <p className="mt-3 text-sm font-medium text-gray-900">
                    {songQuery ? 'No songs found' : 'Search for a song'}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {songQuery ? 'Try a different search term' : 'Enter a song name or artist'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {songResults.map(song => (
                    <button key={song.id} type="button" onClick={() => attachSong(song)}
                      className="w-full flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 text-left hover:border-blue-400 hover:bg-blue-50 transition-colors">
                      <img src={song.imageUrl} alt="" className="h-12 w-12 rounded object-cover flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{song.title}</p>
                        <p className="text-xs text-gray-500 truncate">{song.artist}</p>
                        {song.album?.name && (
                          <p className="text-xs text-gray-400 truncate">{song.album.name}</p>
                        )}
                      </div>
                      <ExternalLink className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
