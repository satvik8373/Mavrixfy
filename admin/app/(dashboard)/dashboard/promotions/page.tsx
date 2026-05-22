'use client';

import { useEffect, useState, useRef } from 'react';
import NextImage from 'next/image';
import { collection, getDocs, deleteDoc, doc, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
import { Megaphone, Plus, Edit, Trash2, ImageIcon, Loader2, X, Check, Film, Music, Globe, Smartphone, Image as GifIcon, Upload, Link2, Search, ExternalLink, LayoutGrid } from 'lucide-react';

type MediaType = 'image' | 'gif' | 'video' | 'audio';
type Platform  = 'web' | 'app';
type StoredPlatform = Platform | Platform[] | 'both';
type BannerLayout = 'hero' | 'card' | 'full-width' | 'sidebar' | 'modal';
type ActionType = 'none' | 'external' | 'song' | 'playlist' | 'artist' | 'album';
type PromotionFrequency = 'once' | 'daily' | 'every_open';
type PromotionVisibility = 'public' | 'dev';

interface AttachedSong {
  id: string;
  title: string;
  artist: string;
  imageUrl: string;
  streamUrl: string;
}

interface ActionTarget {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  actionType: Extract<ActionType, 'song' | 'playlist' | 'artist' | 'album'>;
  actionUrl?: string;
  externalUrl?: string;
  attachedSong?: AttachedSong;
}

interface Promotion {
  id: string;
  title: string;
  description: string;
  mediaUrl?: string;
  mediaType?: MediaType;
  cloudinaryPublicId?: string;
  platforms?: StoredPlatform;
  status: 'active' | 'scheduled' | 'ended';
  startDate?: string;
  endDate?: string;
  layout?: BannerLayout;
  actionType?: ActionType;
  actionUrl?: string;
  attachedSong?: AttachedSong;
  targetTitle?: string;
  targetSubtitle?: string;
  targetImageUrl?: string;
  priority?: number;
  placement?: string;
  ctaText?: string;
  dismissText?: string;
  frequency?: PromotionFrequency;
  visibilityMode?: PromotionVisibility;
}

const EMPTY_FORM = {
  title: '',
  description: '',
  mediaUrl: '',
  cloudinaryPublicId: '',
  platforms: ['app'] as Platform[],
  neverEnds: true,
  status: 'active' as 'active' | 'scheduled' | 'ended',
  startDate: '',
  endDate: '',
  layout: 'hero' as BannerLayout,
  actionType: 'none' as ActionType,
  actionUrl: '',
  attachedSong: null as AttachedSong | null,
  targetTitle: '',
  targetSubtitle: '',
  targetImageUrl: '',
  priority: 0,
  ctaText: 'OPEN NOW',
  dismissText: 'Dismiss',
  frequency: 'once' as PromotionFrequency,
  visibilityMode: 'public' as PromotionVisibility,
};

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  scheduled: 'bg-blue-100 text-blue-800',
  ended: 'bg-gray-100 text-gray-600',
};

const PLATFORM_OPTIONS: { value: Platform; label: string; icon: React.ReactNode }[] = [
  { value: 'web', label: 'Web', icon: <Globe className="size-4" /> },
  { value: 'app', label: 'App', icon: <Smartphone className="size-4" /> },
];

const ACTION_OPTIONS: { value: ActionType; label: string }[] = [
  { value: 'none', label: 'No Action' },
  { value: 'external', label: 'External Link' },
  { value: 'song', label: 'Play Song' },
  { value: 'playlist', label: 'Open Playlist' },
  { value: 'artist', label: 'View Artist' },
  { value: 'album', label: 'View Album' },
];

const CONTENT_ACTION_TYPES: ActionType[] = ['song', 'playlist', 'artist', 'album'];

const DISPLAY_OPTIONS: { value: BannerLayout; label: string; description: string }[] = [
  { value: 'hero', label: 'Home Banner', description: 'Inline campaign card on Home' },
  { value: 'modal', label: 'Popup Modal', description: 'Centered app popup with dismiss and CTA' },
];

const DEFAULT_TARGET_QUERIES: Partial<Record<ActionType, string>> = {
  song: 'hindi trending',
  playlist: 'hindi bollywood top playlists',
  artist: 'arijit singh',
  album: 'latest hindi albums',
};

function normalizePlatforms(value: StoredPlatform | undefined): Platform[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is Platform => item === 'web' || item === 'app');
  }
  if (value === 'both') return ['web', 'app'];
  if (value === 'web' || value === 'app') return [value];
  return ['app'];
}

/** Detect media type purely from URL */
function detectMediaType(url: string): MediaType {
  const clean = url.split('?')[0].toLowerCase();
  if (/\.(mp4|webm|mov|avi|mkv)$/.test(clean)) return 'video';
  if (/\.(mp3|ogg|wav|aac|flac|m4a)$/.test(clean)) return 'audio';
  if (/\.gif$/.test(clean)) return 'gif';
  return 'image';
}

function MediaTypeIcon({ type }: { type: MediaType }) {
  if (type === 'video') return <Film className="size-4 text-blue-500" />;
  if (type === 'audio') return <Music className="size-4 text-purple-500" />;
  if (type === 'gif')   return <GifIcon className="size-4 text-pink-500" />;
  return <ImageIcon className="size-4 text-gray-400" />;
}

function MediaPreview({ url, type }: { url: string; type: MediaType }) {
  if (!url) return null;
  if (type === 'image' || type === 'gif')
    return <NextImage src={url} alt="preview" width={96} height={64} className="h-16 w-24 rounded-lg object-cover flex-shrink-0" unoptimized />;
  if (type === 'video')
    return <video src={url} className="h-16 w-24 rounded-lg object-cover flex-shrink-0" muted playsInline />;
  return (
    <div className="flex h-16 w-24 flex-shrink-0 items-center justify-center rounded-lg bg-purple-100">
      <Music className="size-6 text-purple-500" />
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
  const [showTargetSearch, setShowTargetSearch] = useState(false);
  const [targetQuery, setTargetQuery] = useState('');
  const [targetResults, setTargetResults] = useState<ActionTarget[]>([]);
  const [searchingTargets, setSearchingTargets] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showTargetSearch) {
      const timer = setTimeout(() => searchInputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [showTargetSearch]);

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

  function targetLabel(type = form.actionType) {
    return ACTION_OPTIONS.find(opt => opt.value === type)?.label || 'Choose Content';
  }

  function songToTarget(song: any): ActionTarget {
    return {
      id: song.id,
      title: song.title,
      subtitle: [song.artist, song.album?.name].filter(Boolean).join(' • '),
      imageUrl: song.imageUrl,
      actionType: 'song',
      attachedSong: {
        id: song.id,
        title: song.title,
        artist: song.artist,
        imageUrl: song.imageUrl,
        streamUrl: song.streamUrl,
      },
    };
  }

  async function searchTargets(queryOverride?: string) {
    const query = (queryOverride ?? targetQuery).trim() || DEFAULT_TARGET_QUERIES[form.actionType] || '';
    if (!query || !CONTENT_ACTION_TYPES.includes(form.actionType)) return;
    setSearchingTargets(true);
    try {
      const endpoint = form.actionType === 'song'
        ? `/api/music/search?query=${encodeURIComponent(query)}&limit=50`
        : `/api/promotions/search-targets?type=${form.actionType}&query=${encodeURIComponent(query)}&limit=50`;
      const response = await fetch(endpoint);
      const data = await response.json();
      if (data.success) {
        const results = form.actionType === 'song'
          ? (data.data.results || []).map(songToTarget)
          : (data.data.results || []);
        setTargetResults(results);
      } else {
        setError(data.message || 'Search failed');
      }
    } catch (e) {
      console.error('Promotion target search failed:', e);
      setError('Failed to search content. Please try again.');
    } finally {
      setSearchingTargets(false);
    }
  }

  function openTargetSearch() {
    setShowTargetSearch(true);
    setTargetResults([]);
    const defaultQuery = DEFAULT_TARGET_QUERIES[form.actionType] || '';
    setTargetQuery(defaultQuery);
    if (defaultQuery) {
      void searchTargets(defaultQuery);
    }
  }

  function attachTarget(target: ActionTarget) {
    setForm(f => ({
      ...f,
      actionType: target.actionType,
      actionUrl: target.actionType === 'song' ? '' : ['album', 'artist'].includes(target.actionType) ? target.externalUrl || target.actionUrl || target.id : target.actionUrl || target.id,
      attachedSong: target.actionType === 'song' ? target.attachedSong || null : null,
      targetTitle: target.title,
      targetSubtitle: target.subtitle || '',
      targetImageUrl: target.imageUrl || target.attachedSong?.imageUrl || '',
    }));
    setShowTargetSearch(false);
    setTargetQuery('');
    setTargetResults([]);
  }

  function clearActionTarget() {
    setForm(f => ({ ...f, actionUrl: '', attachedSong: null, targetTitle: '', targetSubtitle: '', targetImageUrl: '' }));
  }

  async function handleSave() {
    if (!form.title.trim()) { setError('Title is required.'); return; }
    if (form.actionType === 'external' && !form.actionUrl.trim()) {
      setError('External link URL is required.');
      return;
    }
    if (form.actionType === 'song' && !form.attachedSong) {
      setError('Choose an existing song for this promotion.');
      return;
    }
    if (['playlist', 'artist', 'album'].includes(form.actionType) && !form.actionUrl.trim()) {
      setError(`Choose an existing ${form.actionType} for this promotion.`);
      return;
    }
    if (form.platforms.length === 0) {
      setError('Select at least one platform.');
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
        placement:   form.layout === 'modal' ? 'home_modal' : 'home_banner',
        actionType:  form.actionType,
        priority:    form.priority || 0,
        ctaText:     form.ctaText.trim() || 'OPEN NOW',
        dismissText: form.dismissText.trim() || 'Dismiss',
        frequency:   form.visibilityMode === 'dev' ? 'every_open' : form.frequency,
        visibilityMode: form.visibilityMode,
        updatedAt:   serverTimestamp(),
      };

      // Only add fields if they have values (Firestore doesn't accept undefined)
      if (url) {
        data.mediaUrl = url;
        data.mediaType = detectMediaType(url);
      }
      if (form.cloudinaryPublicId) data.cloudinaryPublicId = form.cloudinaryPublicId;
      if (form.startDate) data.startDate = form.startDate;
      if (!form.neverEnds && form.endDate) data.endDate = form.endDate;
      if (form.actionUrl.trim()) data.actionUrl = form.actionUrl.trim();
      if (form.attachedSong) data.attachedSong = form.attachedSong;
      if (form.targetTitle.trim()) data.targetTitle = form.targetTitle.trim();
      if (form.targetSubtitle.trim()) data.targetSubtitle = form.targetSubtitle.trim();
      if (form.targetImageUrl.trim()) data.targetImageUrl = form.targetImageUrl.trim();

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
      platforms:   normalizePlatforms(p.platforms),
      status:      p.status,
      startDate:   p.startDate   || '',
      endDate:     p.endDate     || '',
      neverEnds:   !p.endDate,
      layout:      p.layout      || 'hero',
      actionType:  p.actionType  || 'none',
      actionUrl:   p.actionUrl   || '',
      attachedSong: p.attachedSong || null,
      targetTitle: p.targetTitle || p.attachedSong?.title || '',
      targetSubtitle: p.targetSubtitle || p.attachedSong?.artist || '',
      targetImageUrl: p.targetImageUrl || p.attachedSong?.imageUrl || '',
      priority:    p.priority    || 0,
      ctaText:     p.ctaText     || 'OPEN NOW',
      dismissText: p.dismissText || 'Dismiss',
      frequency:   p.frequency   || 'once',
      visibilityMode: p.visibilityMode || 'public',
    });
    setShowModal(true);
  }

  function closeModal() { 
    setShowModal(false); 
    setForm(EMPTY_FORM); 
    setEditId(null); 
    setError(''); 
    setShowTargetSearch(false);
    setTargetQuery('');
    setTargetResults([]);
  }

  // Live-detect type as user types URL
  const detectedType = form.mediaUrl ? detectMediaType(form.mediaUrl) : null;
  const previewImageUrl = form.mediaUrl || form.targetImageUrl || form.attachedSong?.imageUrl || '';

  const platformBadge = (p?: StoredPlatform) => {
    const selected = normalizePlatforms(p);
    if (selected.length === 2) {
      return <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700"><Globe className="size-3" />Web + App</span>;
    }
    return selected[0] === 'app'
      ? <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700"><Smartphone className="size-3" />App</span>
      : <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700"><Globe className="size-3" />Web</span>;
  };

  function togglePlatform(platform: Platform) {
    setForm(f => {
      const current = f.platforms.includes(platform)
        ? f.platforms.filter(item => item !== platform)
        : [...f.platforms, platform];
      return { ...f, platforms: current };
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Promotions</h1>
          <p className="mt-1 text-sm text-gray-500">Manage banners and promotional campaigns</p>
        </div>
        {!showModal && (
        <button type="button" onClick={() => { setEditId(null); setForm(EMPTY_FORM); setShowModal(true); }} className="btn-primary flex w-full items-center justify-center gap-2 sm:w-auto">
          <Plus className="size-4" /> Create Promotion
        </button>
        )}
      </div>

      {!showModal && (
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-sm font-semibold text-gray-900">All Promotions ({promotions.length})</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="size-6 animate-spin text-blue-600" /></div>
        ) : promotions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Megaphone className="size-10 text-gray-300" />
            <p className="mt-3 text-sm font-medium text-gray-900">No promotions yet</p>
            <p className="mt-1 text-xs text-gray-500">Create your first promotional banner</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {promotions.map(promo => (
              <div key={promo.id} className="flex flex-col gap-4 px-6 py-4 hover:bg-gray-50 sm:flex-row sm:items-center">
                {(promo.mediaUrl || promo.targetImageUrl || promo.attachedSong?.imageUrl)
                  ? <MediaPreview url={promo.mediaUrl || promo.targetImageUrl || promo.attachedSong?.imageUrl || ''} type={promo.mediaType || 'image'} />
                  : <div className="flex h-16 w-24 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100"><ImageIcon className="size-6 text-gray-400" /></div>
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
                        <Link2 className="size-3" />{promo.actionType}
                      </span>
                    )}
                    {platformBadge(promo.platforms)}
                    {promo.visibilityMode === 'dev' && (
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-700">
                        Dev test
                      </span>
                    )}
                    {(promo.priority || 0) > 0 && (
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700">
                        Priority: {promo.priority}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500 truncate">{promo.description}</p>
                  {(promo.targetTitle || promo.attachedSong) && (
                    <p className="mt-0.5 text-xs text-blue-600 flex items-center gap-1">
                      <Music className="size-3" />
                      {promo.targetTitle || promo.attachedSong?.title}{promo.targetSubtitle || promo.attachedSong?.artist ? ` - ${promo.targetSubtitle || promo.attachedSong?.artist}` : ''}
                    </p>
                  )}
                  {(promo.startDate || promo.endDate) && (
                    <p className="mt-0.5 text-xs text-gray-400">{promo.startDate}{promo.endDate ? ` → ${promo.endDate}` : ''}</p>
                  )}
                </div>
                <div className="flex flex-shrink-0 items-center gap-1 self-end sm:self-auto">
                  <button type="button" onClick={() => openEdit(promo)} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><Edit className="size-4" /></button>
                  <button type="button" onClick={() => handleDelete(promo.id)} className="rounded-md p-1.5 text-red-500 hover:bg-red-50 hover:text-red-700"><Trash2 className="size-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      {showModal && (
        <div className="bg-white">
          <div className="w-full">
            <div className="flex flex-col gap-3 border-b border-gray-200 px-1 pb-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{editId ? 'Edit Promotion' : 'Create Promotion'}</h2>
                <p className="mt-1 text-sm text-gray-500">Set the campaign, destination, publishing, and preview.</p>
              </div>
              <button type="button" onClick={closeModal} className="btn-secondary w-full sm:w-auto">Back to list</button>
            </div>

            <div className="grid gap-8 py-6 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-7">
              {error && <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

              <section className="space-y-4">
                <div>
                  <div>
                    <p className="text-base font-semibold text-gray-900">Campaign</p>
                    <p className="text-sm text-gray-500">Name, copy, and display type.</p>
                  </div>
                </div>
                <div className="space-y-4">
              <div>
                <label htmlFor="promotions-title-1" className="block text-xs font-medium text-gray-700 mb-1">Title <span className="text-red-500">*</span></label>
                <input id="promotions-title-1" className="input-field" placeholder="Promotion title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>

              <div>
                <label htmlFor="promotions-description-2" className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                <textarea id="promotions-description-2" className="input-field resize-none" rows={2} placeholder="Short description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>

              <div>
                <p className="block text-xs font-medium text-gray-700 mb-2">Display Type</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {DISPLAY_OPTIONS.map(opt => (
                    <button key={opt.value} type="button" onClick={() => setForm(f => ({ ...f, layout: opt.value }))}
                      className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${form.layout === opt.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                      <span className="text-sm font-medium text-gray-900">{opt.label}</span>
                      <p className="text-xs text-gray-500">{opt.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="promotion-cta-text" className="block text-xs font-medium text-gray-700 mb-1">Discover Button Text</label>
                <input id="promotion-cta-text"
                  className="input-field"
                  placeholder="e.g. DISCOVER, PLAY NOW, OPEN NOW"
                  value={form.ctaText}
                  onChange={e => setForm(f => ({ ...f, ctaText: e.target.value }))}
                />
              </div>
                </div>
              <section className="space-y-4 border-t border-gray-200 pt-6">
                <div>
                <p className="text-base font-semibold text-gray-900">Creative</p>
                <p className="mt-1 text-sm text-gray-500">
                  Artwork is picked automatically from the selected song, playlist, artist, or album. Add custom media only when you want to override it.
                </p>
                </div>
                {form.targetImageUrl || form.attachedSong?.imageUrl ? (
                  <div className="mb-3 rounded-lg border border-green-200 bg-green-50 p-3">
                    <p className="text-xs font-medium text-green-800">Using selected content artwork</p>
                    <p className="mt-0.5 truncate text-xs text-green-700">{form.targetTitle || form.attachedSong?.title}</p>
                  </div>
                ) : null}
                <p className="block text-xs font-medium text-gray-700 mb-2">Custom Media Override</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="flex-1 cursor-pointer">
                      <div className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm text-blue-700 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-800 transition-colors">
                        {uploading ? (
                          <><Loader2 className="size-4 animate-spin" />Uploading…</>
                        ) : (
                          <><Upload className="size-4" />Upload custom creative</>
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
                        <X className="size-3" />
                      </button>
                    </div>
                  )}

                  <div className="text-xs text-gray-500">Or paste custom URL:</div>
                  <input className="input-field text-sm" placeholder="https://... (image, gif, video, audio)" value={form.mediaUrl} onChange={e => setForm(f => ({ ...f, mediaUrl: e.target.value }))} />
                  {detectedType && (
                    <p className="flex items-center gap-1.5 text-xs text-gray-500">
                      <MediaTypeIcon type={detectedType} />
                      Detected: <span className="font-medium capitalize">{detectedType}</span>
                    </p>
                  )}
                </div>
              </section>

              </section>

              <section className="space-y-4 border-t border-gray-200 pt-6">
              <div>
              <p className="text-base font-semibold text-gray-900">Destination</p>
              <p className="mt-1 text-sm text-gray-500">Pick what happens when users tap the campaign.</p>
              </div>
              <div>
                <label htmlFor="promotion-action-type" className="block text-xs font-medium text-gray-700 mb-1">Click Action</label>
                <select id="promotion-action-type"
                  className="input-field"
                  value={form.actionType}
                  onChange={e => {
                    const actionType = e.target.value as ActionType;
                    setForm(f => ({
                      ...f,
                      actionType,
                      actionUrl: actionType === f.actionType ? f.actionUrl : '',
                      attachedSong: actionType === f.actionType ? f.attachedSong : null,
                    }));
                    setTargetQuery('');
                    setTargetResults([]);
                  }}
                >
                  {ACTION_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* External Link */}
              {form.actionType === 'external' && (
                <div>
                  <label htmlFor="promotions-external-url-5" className="block text-xs font-medium text-gray-700 mb-1">External URL <span className="text-red-500">*</span></label>
                  <input id="promotions-external-url-5" className="input-field" placeholder="https://..." value={form.actionUrl} onChange={e => setForm(f => ({ ...f, actionUrl: e.target.value }))} />
                </div>
              )}

              {/* Choose Existing Content */}
              {CONTENT_ACTION_TYPES.includes(form.actionType) && (
                <div>
                  <p className="block text-xs font-medium text-gray-700 mb-2">
                    Existing {form.actionType.charAt(0).toUpperCase() + form.actionType.slice(1)}
                  </p>
                  {form.actionType === 'song' && form.attachedSong ? (
                    <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <NextImage src={form.attachedSong.imageUrl} alt="" width={48} height={48} className="size-12 rounded object-cover" unoptimized />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{form.attachedSong.title}</p>
                        <p className="text-xs text-gray-500 truncate">{form.attachedSong.artist}</p>
                      </div>
                      <button type="button" onClick={clearActionTarget}
                        className="rounded-md p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700">
                        <X className="size-4" />
                      </button>
                    </div>
                  ) : form.actionType !== 'song' && form.actionUrl ? (
                    <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                      {form.targetImageUrl ? (
                        <NextImage src={form.targetImageUrl} alt="" width={48} height={48} className="size-12 rounded object-cover" unoptimized />
                      ) : (
                        <div className="flex size-12 flex-shrink-0 items-center justify-center rounded bg-gray-100">
                          {form.actionType === 'playlist' ? <LayoutGrid className="size-5 text-gray-500" /> : <Music className="size-5 text-gray-500" />}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{form.targetTitle || targetLabel(form.actionType)}</p>
                        <p className="text-xs text-gray-500 truncate">{form.targetSubtitle || form.actionUrl}</p>
                      </div>
                      <button type="button" onClick={openTargetSearch}
                        className="rounded-md px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50">
                        Change
                      </button>
                      <button type="button" onClick={clearActionTarget}
                        className="rounded-md p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700">
                        <X className="size-4" />
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={openTargetSearch}
                      className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm text-blue-700 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-800 transition-colors">
                      <Search className="size-4" />Choose Existing {form.actionType.charAt(0).toUpperCase() + form.actionType.slice(1)}
                    </button>
                  )}
                  {form.actionType === 'album' && (
                    <p className="mt-2 text-xs text-amber-600">
                      Album selection is saved for campaigns. Add an app album route before using it as a deep link.
                    </p>
                  )}
                </div>
              )}
              </section>
              </div>

              <div className="space-y-7 lg:border-l lg:border-gray-200 lg:pl-8">
              <section className="space-y-4">
                <div>
                <p className="text-base font-semibold text-gray-900">Publishing</p>
                <p className="mt-1 text-sm text-gray-500">Choose where and when this campaign is visible.</p>
                </div>

                <p className="block text-xs font-medium text-gray-700 mb-2">Campaign Mode</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    { value: 'public', label: 'Public', help: 'Visible to users' },
                    { value: 'dev', label: 'Dev test', help: 'Only local/dev builds' },
                  ].map(opt => (
                    <button key={opt.value} type="button" onClick={() => setForm(f => ({ ...f, visibilityMode: opt.value as PromotionVisibility, frequency: opt.value === 'dev' ? 'every_open' : f.frequency }))}
                      className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${form.visibilityMode === opt.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                      <p className="text-sm font-medium text-gray-900">{opt.label}</p>
                      <p className="text-xs text-gray-500">{opt.help}</p>
                    </button>
                  ))}
                </div>

                <p className="mt-4 block text-xs font-medium text-gray-700 mb-2">Show On</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {PLATFORM_OPTIONS.map(opt => (
                    <button key={opt.value} type="button" onClick={() => togglePlatform(opt.value)}
                      className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${form.platforms.includes(opt.value) ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}>
                      {form.platforms.includes(opt.value) && <Check className="size-4" />}
                      {opt.icon}{opt.label}
                    </button>
                  ))}
                </div>

              <div className="mt-4">
                <label htmlFor="promotion-status" className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                <select id="promotion-status" className="input-field" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))}>
                  <option value="active">Active</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="ended">Ended</option>
                </select>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="promotions-start-date-7" className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
                  <input id="promotions-start-date-7" type="date" className="input-field" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <label htmlFor="promotion-end-date" className="block text-xs font-medium text-gray-700">End Date</label>
                    <label className="flex cursor-pointer items-center gap-1.5 text-xs text-gray-600">
                      <input
                        type="checkbox"
                        checked={form.neverEnds}
                        onChange={e => setForm(f => ({ ...f, neverEnds: e.target.checked, endDate: e.target.checked ? '' : f.endDate }))}
                      />
                      Never
                    </label>
                  </div>
                  <input
                    id="promotion-end-date"
                    type="date"
                    className="input-field"
                    value={form.endDate}
                    onChange={e => setForm(f => ({ ...f, endDate: e.target.value, neverEnds: false }))}
                    disabled={form.neverEnds}
                  />
                </div>
              </div>

              <div className="mt-4">
                <label htmlFor="promotion-priority" className="block text-xs font-medium text-gray-700 mb-1">Priority (0-100)</label>
                <input id="promotion-priority" type="number" min="0" max="100" className="input-field" placeholder="0" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: parseInt(e.target.value) || 0 }))} />
                <p className="mt-1 text-xs text-gray-500">Higher priority promotions appear first</p>
              </div>
              </section>

              <section className="border-t border-gray-200 pt-6">
                <p className="text-base font-semibold text-gray-900">Preview</p>
                <div className="mt-3 overflow-hidden rounded-lg border border-gray-200 bg-gray-950">
                  {previewImageUrl ? (
                    <NextImage src={previewImageUrl} alt="" width={400} height={160} className="h-40 w-full object-contain bg-gray-950" unoptimized />
                  ) : (
                    <div className="flex h-40 w-full items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
                      <ImageIcon className="size-8 text-gray-500" />
                    </div>
                  )}
                  <div className="p-4">
                    <p className="text-base font-semibold text-white">{form.title || 'Campaign title'}</p>
                    <p className="mt-1 text-sm text-gray-300">{form.description || 'Campaign description preview'}</p>
                    {form.actionType !== 'none' && (
                      <div className={`mt-3 inline-flex rounded-full px-4 py-2 text-xs font-bold shadow-sm ${
                        form.layout === 'modal' ? 'bg-pink-300 text-black' : 'bg-blue-600 text-white'
                      }`}>
                        {form.ctaText || 'OPEN NOW'}
                      </div>
                    )}
                  </div>
                </div>
              </section>
              </div>
            </div>

            <div className="sticky bottom-0 flex flex-col-reverse gap-3 border-t border-gray-200 bg-white/95 px-1 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-end">
              <button type="button" onClick={closeModal} className="btn-secondary w-full sm:w-auto">Cancel</button>
              <button type="button" onClick={handleSave} disabled={saving} className="btn-primary flex w-full items-center justify-center gap-2 sm:w-auto">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                {editId ? 'Save Changes' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Existing Content Picker */}
      {showTargetSearch && CONTENT_ACTION_TYPES.includes(form.actionType) && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <button type="button" aria-label="Close modal" className="fixed inset-0 bg-black/40" onClick={() => setShowTargetSearch(false)} />
          <div className="relative w-full max-w-lg rounded-lg border border-gray-200 bg-white shadow-xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-base font-semibold text-gray-900">{targetLabel(form.actionType)}</h2>
              <button type="button" onClick={() => setShowTargetSearch(false)} className="rounded-md p-1 text-gray-400 hover:bg-gray-100">
                <X className="size-5" />
              </button>
            </div>

            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  ref={searchInputRef}
                  className="input-field flex-1"
                  placeholder={`Search ${form.actionType}s…`}
                  value={targetQuery}
                  onChange={e => setTargetQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && searchTargets()}
                />
                <button type="button" onClick={() => searchTargets()} disabled={searchingTargets}
                  className="btn-primary flex items-center justify-center gap-2 px-4">
                  {searchingTargets ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                </button>
              </div>
              {targetResults.length > 0 && (
                <p className="mt-2 text-xs text-gray-500">
                  Found {targetResults.length} {form.actionType}{targetResults.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {searchingTargets ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="size-6 animate-spin text-blue-600" />
                </div>
              ) : targetResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Music className="size-10 text-gray-300" />
                  <p className="mt-3 text-sm font-medium text-gray-900">
                    {targetQuery ? `No ${form.actionType}s found` : `Search for a ${form.actionType}`}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {targetQuery ? 'Try a different search term' : 'Enter a name, artist, or language'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {targetResults.map(target => (
                    <button key={`${target.actionType}-${target.id}`} type="button" onClick={() => attachTarget(target)}
                      className="w-full flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 text-left hover:border-blue-400 hover:bg-blue-50 transition-colors">
                      {target.imageUrl ? (
                        <NextImage src={target.imageUrl} alt="" width={48} height={48} className="size-12 rounded object-cover flex-shrink-0" unoptimized />
                      ) : (
                        <div className="flex size-12 flex-shrink-0 items-center justify-center rounded bg-gray-100">
                          {target.actionType === 'playlist' ? <LayoutGrid className="size-5 text-gray-500" /> : <Music className="size-5 text-gray-500" />}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{target.title}</p>
                        {target.subtitle && <p className="text-xs text-gray-500 truncate">{target.subtitle}</p>}
                        <p className="text-xs text-gray-400 truncate">{target.actionType} ID: {target.actionUrl || target.id}</p>
                      </div>
                      <ExternalLink className="size-4 text-gray-400 flex-shrink-0" />
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
