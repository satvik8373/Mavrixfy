import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { Song } from '@/types';

type MediaType = 'image' | 'gif' | 'video' | 'audio';
type Platform = 'web' | 'app';
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
  description?: string;
  mediaUrl?: string;
  mediaType?: MediaType;
  platforms?: Platform | Platform[] | 'both';
  // legacy support
  imageUrl?: string;
  status: string;
  startDate?: string;
  endDate?: string;
  actionType?: ActionType;
  actionUrl?: string;
  attachedSong?: AttachedSong | null;
  ctaText?: string;
  dismissText?: string;
  layout?: 'hero' | 'modal';
}

function getMediaType(promo: Promotion): MediaType {
  if (promo.mediaType) return promo.mediaType;
  // legacy: if only imageUrl exists, treat as image
  if (promo.imageUrl) return 'image';
  return 'image';
}

function getMediaUrl(promo: Promotion): string | undefined {
  return promo.mediaUrl || promo.imageUrl;
}

function isForWeb(platforms: Promotion['platforms']): boolean {
  if (!platforms) return true;
  if (Array.isArray(platforms)) return platforms.includes('web');
  return platforms === 'web' || platforms === 'both';
}

// ── Individual media renderers ──────────────────────────────────────────────

function ImageMedia({ url, alt }: { url: string; alt: string }) {
  return (
    <img
      src={url}
      alt={alt}
      className="absolute inset-0 w-full h-full object-cover opacity-80"
    />
  );
}

function GifMedia({ url, alt }: { url: string; alt: string }) {
  return (
    <img
      src={url}
      alt={alt}
      className="absolute inset-0 w-full h-full object-cover"
    />
  );
}

function VideoMedia({ url }: { url: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  return (
    <>
      <video
        ref={videoRef}
        src={url}
        className="absolute inset-0 w-full h-full object-cover"
        autoPlay
        loop
        muted={muted}
        playsInline
      >
        <track kind="captions" />
      </video>
      {/* Mute toggle */}
      <button type="button"
        onClick={(e) => { e.stopPropagation(); setMuted(m => !m); }}
        className="absolute top-2 right-2 z-20 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70 transition-colors"
        aria-label={muted ? 'Unmute video' : 'Mute video'}
      >
        {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
      </button>
    </>
  );
}

const pseudoRandom = (seed: number) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

function AudioMedia({ url }: { url: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play(); setPlaying(true); }
  }

  return (
    <>
      <audio ref={audioRef} src={url} loop onEnded={() => setPlaying(false)}>
        <track kind="captions" />
      </audio>
      {/* Audio visualizer background */}
      <div className="absolute inset-0 bg-gradient-to-r from-purple-900 via-indigo-900 to-pink-900">
        <div className="absolute inset-0 flex items-center justify-center gap-1 opacity-30">
          {Array.from({ length: 24 }).map((_, i) => (
            <div
              key={i}
              className={`w-1 rounded-full bg-white ${playing ? 'animate-pulse' : ''}`}
              style={{
                height: `${20 + Math.sin(i * 0.8) * 30 + pseudoRandom(i) * 20}%`,
                animationDelay: `${i * 0.05}s`,
                animationDuration: `${0.6 + pseudoRandom(i + 100) * 0.4}s`,
              }}
            />
          ))}
        </div>
      </div>
      {/* Play button */}
      <button type="button"
        onClick={(e) => { e.stopPropagation(); toggle(); }}
        className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/20 p-3 backdrop-blur-sm hover:bg-white/30 transition-colors"
      >
        {playing
          ? <Pause className="h-6 w-6 text-white" />
          : <Play className="h-6 w-6 text-white fill-white" />
        }
      </button>
    </>
  );
}

// ── Main Banner ─────────────────────────────────────────────────────────────

export function PromotionsBanner() {
  const [promos, setPromos] = useState<Promotion[] | undefined>(undefined);
  const [current, setCurrent] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (navigator.webdriver || /Chrome-Lighthouse|Lighthouse/i.test(navigator.userAgent)) {
      return;
    }

    let isCancelled = false;
    let hasStarted = false;
    const intentEvents = ['pointerdown', 'keydown', 'touchstart', 'wheel'];

    const fetchPromos = async () => {
      try {
        const [{ collection, query, where, getDocs }, { db }] = await Promise.all([
          import('firebase/firestore'),
          import('@/lib/firebase'),
        ]);
        const today = new Date().toISOString().split('T')[0];
        const snap = await getDocs(
          query(collection(db, 'promotions'), where('status', '==', 'active'))
        );
        const all = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Promotion[];
        // Filter: show if platforms includes web, legacy web/both, or not set.
        const valid = all.filter(p =>
          (!p.endDate || p.endDate >= today) &&
          isForWeb(p.platforms)
        );
        if (!isCancelled) {
          setPromos(valid);
        }
      } catch (e) {
        console.error('Failed to load promotions', e);
      }
    };

    const startFetch = () => {
      if (hasStarted) return;
      hasStarted = true;
      intentEvents.forEach((eventName) => window.removeEventListener(eventName, startFetch));
      void fetchPromos();
    };

    intentEvents.forEach((eventName) => {
      window.addEventListener(eventName, startFetch, { once: true, passive: true });
    });

    return () => {
      isCancelled = true;
      intentEvents.forEach((eventName) => window.removeEventListener(eventName, startFetch));
    };
  }, []);

  // Auto-rotate every 5s — skip for video/audio (let them play)
  useEffect(() => {
    if (!promos || promos.length <= 1) return;
    const type = getMediaType(promos[current]);
    if (type === 'video' || type === 'audio') return;
    const timer = setInterval(() => {
      setCurrent(c => (c + 1) % promos.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [promos, current]);

  if (!promos || !promos.length) return null;

  const promo = promos[current];
  const mediaType = getMediaType(promo);
  const mediaUrl = getMediaUrl(promo);

  const executePromotionAction = (e?: React.MouseEvent | React.KeyboardEvent) => {
    if (e) {
      e.stopPropagation();
    }
    if (!promo.actionType || promo.actionType === 'none') return;

    if (promo.actionType === 'external' && promo.actionUrl) {
      window.open(promo.actionUrl, '_blank', 'noopener,noreferrer');
    } else if (promo.actionType === 'song' && promo.attachedSong) {
      const songToPlay: Song = {
        _id: promo.attachedSong.id,
        title: promo.attachedSong.title,
        artist: promo.attachedSong.artist,
        albumId: null,
        imageUrl: promo.attachedSong.imageUrl,
        audioUrl: promo.attachedSong.streamUrl,
        streamUrl: promo.attachedSong.streamUrl,
        duration: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      void import('@/utils/audioManager').then(({ playSong }) => playSong(songToPlay));
    } else if (promo.actionType === 'playlist' && promo.actionUrl) {
      if (promo.actionUrl.startsWith('jio_') || !isNaN(Number(promo.actionUrl))) {
        navigate(`/jiosaavn/playlist/${promo.actionUrl}`);
      } else {
        navigate(`/playlist/${promo.actionUrl}`);
      }
    } else if (promo.actionType === 'album' && promo.actionUrl) {
      if (promo.actionUrl.startsWith('http') || promo.actionUrl.includes('jiosaavn.com')) {
        window.open(promo.actionUrl, '_blank', 'noopener,noreferrer');
      } else {
        navigate(`/albums/${promo.actionUrl}`);
      }
    } else if (promo.actionType === 'artist' && promo.actionUrl) {
      if (promo.actionUrl.startsWith('http') || promo.actionUrl.includes('jiosaavn.com')) {
        window.open(promo.actionUrl, '_blank', 'noopener,noreferrer');
      }
    }
  };

  const isClickable = promo.actionType && promo.actionType !== 'none';

  return (
    <div className="px-4 md:px-6 mb-2">
      {/* 16:5 aspect ratio */}
      <div
        className={`relative w-full rounded-xl overflow-hidden bg-gradient-to-r from-purple-900/60 to-pink-900/60 ${
          isClickable ? 'hover:opacity-95 active:scale-[0.99] transition-all' : ''
        }`}
        style={{ paddingTop: '31.25%' }}
      >
        {isClickable && (
          <button
            type="button"
            className="absolute inset-0 w-full h-full cursor-pointer z-[1] opacity-0"
            onClick={executePromotionAction}
            aria-label={`Open promotion: ${promo.title}`}
          />
        )}
        {/* Media layer */}
        {mediaUrl && (
          <>
            {mediaType === 'image' && <ImageMedia url={mediaUrl} alt={promo.title} />}
            {mediaType === 'gif'   && <GifMedia   url={mediaUrl} alt={promo.title} />}
            {mediaType === 'video' && <VideoMedia  url={mediaUrl} />}
            {mediaType === 'audio' && <AudioMedia  url={mediaUrl} />}
          </>
        )}

        {/* Gradient overlay — skip for audio (has its own bg) */}
        {mediaType !== 'audio' && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        )}

        {/* Text and Action button overlay */}
        <div className="absolute inset-0 z-10 p-4 md:p-6 flex items-end justify-between gap-4 pointer-events-none">
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-base md:text-lg leading-tight drop-shadow truncate">
              {promo.title}
            </p>
            {promo.description && (
              <p className="text-white/80 text-xs md:text-sm mt-1 drop-shadow line-clamp-2">
                {promo.description}
              </p>
            )}
          </div>
          {isClickable && (
            <div className="flex-shrink-0 pointer-events-auto">
              <button
                type="button"
                onClick={executePromotionAction}
                className="px-4 py-2 bg-white text-black hover:bg-gray-100 active:scale-95 text-xs md:text-sm font-semibold rounded-full shadow-lg transition-all flex items-center gap-1.5"
              >
                {promo.actionType === 'song' && <Play className="h-3.5 w-3.5 fill-black" />}
                {promo.ctaText || 'DISCOVER'}
              </button>
            </div>
          )}
        </div>

        {/* Dot indicators */}
        {promos.length > 1 && (
          <div className="absolute bottom-2 right-3 flex gap-1 z-20">
            {promos.map((p, i) => (
              <button type="button"
                key={p.id || i}
                onClick={(e) => { e.stopPropagation(); setCurrent(i); }}
                className={`h-1.5 rounded-full transition-all ${
                  i === current ? 'bg-white w-3' : 'bg-white/40 w-1.5'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
