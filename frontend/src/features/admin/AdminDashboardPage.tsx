import { useEffect, useMemo, useState, useRef, useReducer } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,

  Bell,
  Bot,
  ChevronRight,
  Command,
  Database,
  Disc3,
  Flag,
  Globe,
  GripVertical,
  ListMusic,
  LockKeyhole,
  Megaphone,
  Mic2,
  MonitorPlay,
  MoonStar,
  Music2,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UploadCloud,
  Users,

  Workflow,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

import './admin.css';

import { AdminCommandPalette, type CommandAction } from './components/AdminCommandPalette';
import { DualMetricChart, RankedBars } from './components/AdminCharts';
import { useAdminAccess } from './hooks/useAdminAccess';
import { useAdminMetrics } from './hooks/useAdminMetrics';
import { ADMIN_SECTIONS, createAdminSeed } from './mock-data';
import type {
  AdminPermission,
  AdminRole,
  AdminSectionConfig,
  AdminSectionKey,
  BannerRecord,
  ContentState,
  FeatureFlagRecord,
  ModerationCase,
  NotificationCampaign,
  PlaylistRecord,
  SongRecord,
  UserRecord,
} from './types';

const sectionConfigMap = new Map<AdminSectionKey, AdminSectionConfig>(
  ADMIN_SECTIONS.map((section) => [section.key, section])
);

const sectionIcons: Record<AdminSectionKey, React.ComponentType<{ className?: string }>> = {
  overview: Activity,
  songs: Music2,
  playlists: ListMusic,
  artists: Mic2,
  discovery: Search,
  moderation: ShieldAlert,
  users: Users,
  analytics: Activity,
  flags: Flag,
  promotions: Megaphone,
  notifications: Bell,
  roles: ShieldCheck,
};

const groupOrder = ['Monitor', 'Catalog', 'Growth', 'Trust', 'Release', 'Security'];

const compactNumber = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const longDateTime = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const longDate = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

function ClientDateText({
  value,
  formatter,
  className,
  prefix = '',
  suffix = '',
  as: Component = 'span',
}: {
  value: string;
  formatter: Intl.DateTimeFormat;
  className?: string;
  prefix?: string;
  suffix?: string;
  as?: 'p' | 'span';
}) {
  const [text, setText] = useState('');

  useEffect(() => {
    setText(`${prefix}${formatter.format(new Date(value))}${suffix}`);
  }, [formatter, prefix, suffix, value]);

  return <Component suppressHydrationWarning className={className}>{text}</Component>;
}

const formatRelativeTime = (value: string) => {
  const diff = new Date(value).getTime() - Date.now();
  const minutes = Math.round(diff / (60 * 1000));

  if (Math.abs(minutes) < 60) {
    if (minutes >= 0) return `in ${minutes}m`;
    return `${Math.abs(minutes)}m ago`;
  }

  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) {
    if (hours >= 0) return `in ${hours}h`;
    return `${Math.abs(hours)}h ago`;
  }

  const days = Math.round(hours / 24);
  if (days >= 0) return `in ${days}d`;
  return `${Math.abs(days)}d ago`;
};

const formatMetricValue = (key: string, value: number) => {
  if (key === 'active_users') return compactNumber.format(value);
  if (key === 'catalog_songs') return compactNumber.format(value);
  if (key === 'editorial_playlists') return compactNumber.format(value);
  return value.toString();
};

const statePillClass = (state: ContentState) => {
  if (state === 'published') return 'admin-chip admin-pill-success';
  if (state === 'scheduled') return 'admin-chip border-cyan-400/20 bg-cyan-400/10 text-cyan-200';
  if (state === 'review') return 'admin-chip admin-pill-warning';
  return 'admin-chip border-white/10 text-slate-300';
};

const moderationPillClass = (state: ModerationCase['status']) => {
  if (state === 'resolved') return 'admin-chip admin-pill-success';
  if (state === 'escalated') return 'admin-chip admin-pill-danger';
  if (state === 'investigating') return 'admin-chip admin-pill-warning';
  return 'admin-chip border-white/10 text-slate-300';
};

const userStatusClass = (status: UserRecord['status']) => {
  if (status === 'healthy') return 'admin-chip admin-pill-success';
  if (status === 'restricted') return 'admin-chip admin-pill-danger';
  return 'admin-chip admin-pill-warning';
};

const sectionCardClass = 'admin-panel rounded-[28px] p-5 md:p-6';
const quietButtonClass = 'rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-200 hover:border-cyan-300/30 hover:bg-cyan-400/5';
const primaryButtonClass = 'rounded-2xl border border-cyan-300/30 bg-cyan-400/12 px-3 py-2 text-sm font-medium text-cyan-100 hover:border-cyan-300/50 hover:bg-cyan-400/18';

interface SongEditorState {
  title: string;
  artist: string;
  album: string;
  genre: string;
  language: string;
  artwork: string;
  duration: string;
  popularityScore: number;
  releaseDate: string;
  explicit: boolean;
  approvalState: ContentState;
  regions: string;
}

const getPermissionLabel = (permission: AdminPermission) => {
  const match = ADMIN_SECTIONS.find((section) => section.permission === permission);
  return match?.label ?? permission;
};

const SectionBadge = ({ label, className }: { label: string; className?: string }) => (
  <span className={cn('inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium', className)}>
    {label}
  </span>
);

const StatusPill = ({ label, className }: { label: string; className: string }) => (
  <SectionBadge label={label} className={className} />
);

const MetricTile = ({
  label,
  value,
  detail,
  delta,
}: {
  label: string;
  value: string;
  detail: string;
  delta: string;
}) => (
  <div className="admin-kpi-card relative overflow-hidden rounded-[26px] p-5">
    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{label}</p>
    <p className="mt-4 text-3xl font-semibold text-white">{value}</p>
    <p className="mt-3 text-sm text-cyan-200">{delta}</p>
    <p className="mt-2 text-sm text-slate-400">{detail}</p>
  </div>
);

const LockedSection = ({
  permission,
  onNavigate,
}: {
  permission: AdminPermission;
  onNavigate: (section: AdminSectionKey) => void;
}) => {
  const fallbackSections = ADMIN_SECTIONS.filter((section) => section.permission !== permission).slice(0, 3);

  return (
    <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
      <div className={sectionCardClass}>
        <div className="flex items-start gap-4">
          <div className="rounded-2xl border border-rose-400/25 bg-rose-400/10 p-3 text-rose-200">
            <LockKeyhole className="h-5 w-5" />
          </div>
          <div className="space-y-3">
            <h3 className="text-xl font-semibold text-white">This module needs additional permissions</h3>
            <p className="max-w-2xl text-sm text-slate-400">
              The current operator can sign in to the admin shell, but the selected module is gated behind
              <span className="mx-1 font-medium text-slate-200">{getPermissionLabel(permission)}</span>
              controls.
            </p>
            <p className="text-sm text-slate-400">
              Recommended next step: add the permission in `admins/{'{uid}'}.permissions` or assign a role with the
              needed scope through your trusted admin provisioning flow.
            </p>
          </div>
        </div>
      </div>

      <div className={sectionCardClass}>
        <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Available now</p>
        <div className="mt-4 space-y-3">
          {fallbackSections.map((section) => (
            <button
              key={section.key}
              type="button"
              onClick={() => onNavigate(section.key)}
              className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left hover:border-cyan-300/30 hover:bg-cyan-400/5"
            >
              <div>
                <p className="font-medium text-slate-100">{section.label}</p>
                <p className="mt-1 text-xs text-slate-400">{section.description}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-500" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

type SeedType = ReturnType<typeof createAdminSeed>;

type DashboardDataState = {
  songs: SeedType['songs'];
  playlists: SeedType['playlists'];
  artists: SeedType['artists'];
  searchWeights: SeedType['searchWeights'];
  moderationCases: SeedType['moderationCases'];
  users: SeedType['users'];
  featureFlags: SeedType['featureFlags'];
  banners: SeedType['banners'];
  notifications: SeedType['notifications'];
  notes: SeedType['notes'];
};

type DashboardDataAction =
  | { type: 'SET_SONGS'; payload: SeedType['songs'] | ((prev: SeedType['songs']) => SeedType['songs']) }
  | { type: 'SET_PLAYLISTS'; payload: SeedType['playlists'] | ((prev: SeedType['playlists']) => SeedType['playlists']) }
  | { type: 'SET_ARTISTS'; payload: SeedType['artists'] | ((prev: SeedType['artists']) => SeedType['artists']) }
  | { type: 'SET_SEARCH_WEIGHTS'; payload: SeedType['searchWeights'] | ((prev: SeedType['searchWeights']) => SeedType['searchWeights']) }
  | { type: 'SET_MODERATION_CASES'; payload: SeedType['moderationCases'] | ((prev: SeedType['moderationCases']) => SeedType['moderationCases']) }
  | { type: 'SET_USERS'; payload: SeedType['users'] | ((prev: SeedType['users']) => SeedType['users']) }
  | { type: 'SET_FEATURE_FLAGS'; payload: SeedType['featureFlags'] | ((prev: SeedType['featureFlags']) => SeedType['featureFlags']) }
  | { type: 'SET_BANNERS'; payload: SeedType['banners'] | ((prev: SeedType['banners']) => SeedType['banners']) }
  | { type: 'SET_NOTIFICATIONS'; payload: SeedType['notifications'] | ((prev: SeedType['notifications']) => SeedType['notifications']) }
  | { type: 'SET_NOTES'; payload: SeedType['notes'] | ((prev: SeedType['notes']) => SeedType['notes']) };

function dashboardDataReducer(state: DashboardDataState, action: DashboardDataAction): DashboardDataState {
  const resolve = <T,>(prev: T, payload: T | ((p: T) => T)): T => {
    return typeof payload === 'function' ? (payload as (p: T) => T)(prev) : payload;
  };

  switch (action.type) {
    case 'SET_SONGS':
      return { ...state, songs: resolve(state.songs, action.payload) };
    case 'SET_PLAYLISTS':
      return { ...state, playlists: resolve(state.playlists, action.payload) };
    case 'SET_ARTISTS':
      return { ...state, artists: resolve(state.artists, action.payload) };
    case 'SET_SEARCH_WEIGHTS':
      return { ...state, searchWeights: resolve(state.searchWeights, action.payload) };
    case 'SET_MODERATION_CASES':
      return { ...state, moderationCases: resolve(state.moderationCases, action.payload) };
    case 'SET_USERS':
      return { ...state, users: resolve(state.users, action.payload) };
    case 'SET_FEATURE_FLAGS':
      return { ...state, featureFlags: resolve(state.featureFlags, action.payload) };
    case 'SET_BANNERS':
      return { ...state, banners: resolve(state.banners, action.payload) };
    case 'SET_NOTIFICATIONS':
      return { ...state, notifications: resolve(state.notifications, action.payload) };
    case 'SET_NOTES':
      return { ...state, notes: resolve(state.notes, action.payload) };
    default:
      return state;
  }
}

const AdminDashboardPage = () => {
  const navigate = useNavigate();
  const params = useParams<{ section?: string }>();

  const seed = useMemo(() => createAdminSeed(), []);
  const session = useAdminAccess();
  const { metrics, isLive, isRefreshing, lastSyncedAt, refresh } = useAdminMetrics(session);

  const [uiView, setUiView] = useState({
    commandOpen: false,
    songView: 'catalog' as 'catalog' | 'imports' | 'quality',
    rolesView: 'permissions' as 'permissions' | 'architecture',
    previewMode: 'dark' as 'dark' | 'light',
  });
  const { commandOpen, songView, rolesView, previewMode } = uiView;
  const setCommandOpen = (val: boolean) => setUiView(prev => ({ ...prev, commandOpen: val }));
  const setSongView = (val: 'catalog' | 'imports' | 'quality') => setUiView(prev => ({ ...prev, songView: val }));
  const setRolesView = (val: 'permissions' | 'architecture') => setUiView(prev => ({ ...prev, rolesView: val }));
  const setPreviewMode = (val: 'dark' | 'light') => setUiView(prev => ({ ...prev, previewMode: val }));

  const [songSelection, setSongSelection] = useState({
    search: '',
    selectedIds: [] as string[],
    focusedId: seed.songs[0]?.id ?? '',
  });
  const { search: songSearch, selectedIds: selectedSongIds, focusedId: focusedSongId } = songSelection;
  const setSongSearch = (val: string) => setSongSelection(prev => ({ ...prev, search: val }));
  const setSelectedSongIds = (val: string[] | ((prev: string[]) => string[])) => setSongSelection(prev => ({
    ...prev,
    selectedIds: typeof val === 'function' ? val(prev.selectedIds) : val
  }));
  const setFocusedSongId = (val: string) => setSongSelection(prev => ({ ...prev, focusedId: val }));

  const [songEditor, setSongEditor] = useState<SongEditorState>({
    title: '',
    artist: '',
    album: '',
    genre: '',
    language: '',
    artwork: '',
    duration: '',
    popularityScore: 50,
    releaseDate: '',
    explicit: false,
    approvalState: 'draft',
    regions: '',
  });
  const [uploadQueue, setUploadQueue] = useState<string[]>([]);
  const draggedPlaylistIdRef = useRef<string | null>(null);

  const [selectedBannerId, setSelectedBannerId] = useState(seed.banners[0]?.id ?? '');

  const [notificationForm, setNotificationForm] = useState({
    title: '',
    segment: 'Premium listeners',
    channel: 'push' as 'push' | 'in-app',
    schedule: new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16),
  });
  const { title: notificationTitle, segment: notificationSegment, channel: notificationChannel, schedule: notificationSchedule } = notificationForm;
  const setNotificationTitle = (val: string) => setNotificationForm(prev => ({ ...prev, title: val }));
  const setNotificationSegment = (val: string) => setNotificationForm(prev => ({ ...prev, segment: val }));
  const setNotificationChannel = (val: 'push' | 'in-app') => setNotificationForm(prev => ({ ...prev, channel: val }));
  const setNotificationSchedule = (val: string | ((prev: string) => string)) => setNotificationForm(prev => ({
    ...prev,
    schedule: typeof val === 'function' ? val(prev.schedule) : val
  }));

  const [noteDraft, setNoteDraft] = useState('');

  // 10 data collections managed in useReducer
  const [dataState, dispatchData] = useReducer(dashboardDataReducer, null as any, () => ({
    songs: seed.songs,
    playlists: seed.playlists,
    artists: seed.artists,
    searchWeights: seed.searchWeights,
    moderationCases: seed.moderationCases,
    users: seed.users,
    featureFlags: seed.featureFlags,
    banners: seed.banners,
    notifications: seed.notifications,
    notes: seed.notes,
  }));
  
  const {
    songs,
    playlists,
    artists,
    searchWeights,
    moderationCases,
    users,
    featureFlags,
    banners,
    notifications,
    notes,
  } = dataState;

  const setSongs = (val: SeedType['songs'] | ((prev: SeedType['songs']) => SeedType['songs'])) => dispatchData({ type: 'SET_SONGS', payload: val });
  const setPlaylists = (val: SeedType['playlists'] | ((prev: SeedType['playlists']) => SeedType['playlists'])) => dispatchData({ type: 'SET_PLAYLISTS', payload: val });
  const setArtists = (val: SeedType['artists'] | ((prev: SeedType['artists']) => SeedType['artists'])) => dispatchData({ type: 'SET_ARTISTS', payload: val });
  const setSearchWeights = (val: SeedType['searchWeights'] | ((prev: SeedType['searchWeights']) => SeedType['searchWeights'])) => dispatchData({ type: 'SET_SEARCH_WEIGHTS', payload: val });
  const setModerationCases = (val: SeedType['moderationCases'] | ((prev: SeedType['moderationCases']) => SeedType['moderationCases'])) => dispatchData({ type: 'SET_MODERATION_CASES', payload: val });
  const setUsers = (val: SeedType['users'] | ((prev: SeedType['users']) => SeedType['users'])) => dispatchData({ type: 'SET_USERS', payload: val });
  const setFeatureFlags = (val: SeedType['featureFlags'] | ((prev: SeedType['featureFlags']) => SeedType['featureFlags'])) => dispatchData({ type: 'SET_FEATURE_FLAGS', payload: val });
  const setBanners = (val: SeedType['banners'] | ((prev: SeedType['banners']) => SeedType['banners'])) => dispatchData({ type: 'SET_BANNERS', payload: val });
  const setNotifications = (val: SeedType['notifications'] | ((prev: SeedType['notifications']) => SeedType['notifications'])) => dispatchData({ type: 'SET_NOTIFICATIONS', payload: val });
  const setNotes = (val: SeedType['notes'] | ((prev: SeedType['notes']) => SeedType['notes'])) => dispatchData({ type: 'SET_NOTES', payload: val });

  const sectionGroups = useMemo(
    () => groupOrder.flatMap((group) => {
      const sections = ADMIN_SECTIONS.filter((section) => section.group === group);
      return sections.length > 0 ? [{ group, sections }] : [];
    }),
    []
  );

  const hasPermission = (permission: AdminPermission) =>
    session.role === 'super_admin' || session.permissions.includes(permission);

  const currentSection = useMemo<AdminSectionKey>(() => {
    if (params.section && sectionConfigMap.has(params.section as AdminSectionKey)) {
      return params.section as AdminSectionKey;
    }
    return 'overview';
  }, [params.section]);

  const currentSectionConfig = sectionConfigMap.get(currentSection) ?? ADMIN_SECTIONS[0];
  const currentSectionAllowed = hasPermission(currentSectionConfig.permission);
  const focusedSong = songs.find((song) => song.id === focusedSongId) ?? songs[0] ?? null;
  const filteredSongs = useMemo(
    () => songs.filter((song) => (
      `${song.title} ${song.artist} ${song.album} ${song.genre} ${song.language}`
        .toLowerCase()
        .includes(songSearch.trim().toLowerCase())
    )),
    [songSearch, songs]
  );
  const selectedBanner = banners.find((banner) => banner.id === selectedBannerId) ?? banners[0] ?? null;

  const overviewMetrics = useMemo(() => (
    seed.overviewMetrics.map((metric) => {
      if (metric.key === 'catalog_songs' && metrics.songs !== undefined) {
        return { ...metric, value: formatMetricValue(metric.key, metrics.songs), detail: 'Live count from Firestore' };
      }
      if (metric.key === 'editorial_playlists' && metrics.playlists !== undefined) {
        return { ...metric, value: formatMetricValue(metric.key, metrics.playlists), detail: 'Live count from Firestore' };
      }
      if (metric.key === 'active_users' && metrics.users !== undefined) {
        return { ...metric, value: formatMetricValue(metric.key, metrics.users), detail: 'Live count from Firestore' };
      }
      return metric;
    })
  ), [metrics.playlists, metrics.songs, metrics.users, seed.overviewMetrics]);

  const quickActions = useMemo<CommandAction[]>(() => {
    const actions: CommandAction[] = [
      {
        id: 'qa_review_songs',
        label: 'Open pending song approvals',
        description: 'Jump into the song CMS review queue.',
        keywords: ['songs', 'approvals', 'cms'],
        section: 'songs',
        run: () => setSongView('catalog'),
      },
      {
        id: 'qa_import_queue',
        label: 'Inspect import queue',
        description: 'Focus on active catalog ingest jobs and upload batches.',
        keywords: ['import', 'ingest', 'uploads'],
        section: 'songs',
        run: () => setSongView('imports'),
      },
      {
        id: 'qa_playlist_order',
        label: 'Reorder editorial playlists',
        description: 'Open playlist curation and homepage push controls.',
        keywords: ['playlist', 'homepage', 'editorial'],
        section: 'playlists',
      },
      {
        id: 'qa_moderation',
        label: 'Review moderation backlog',
        description: 'Jump to copyright, duplicate, and fraud signals.',
        keywords: ['moderation', 'fraud', 'copyright'],
        section: 'moderation',
      },
      {
        id: 'qa_platform',
        label: 'Open Firestore architecture',
        description: 'Review collections, indexes, rules, and workflow guidance.',
        keywords: ['firestore', 'architecture', 'indexes'],
        section: 'roles',
        run: () => setRolesView('architecture'),
      },
    ];

    return actions.filter((action) => hasPermission(sectionConfigMap.get(action.section)?.permission ?? 'overview.view'));
  }, [session.permissions, session.role]);

  useEffect(() => {
    if (!focusedSong) return;
    setSongEditor({
      title: focusedSong.title,
      artist: focusedSong.artist,
      album: focusedSong.album,
      genre: focusedSong.genre,
      language: focusedSong.language,
      artwork: focusedSong.artwork || '',
      duration: focusedSong.duration,
      popularityScore: focusedSong.popularityScore,
      releaseDate: focusedSong.releaseDate,
      explicit: focusedSong.explicit,
      approvalState: focusedSong.approvalState,
      regions: focusedSong.regions.join(', '),
    });
  }, [focusedSong]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toLowerCase().includes('mac');
      const metaPressed = isMac ? event.metaKey : event.ctrlKey;
      if (metaPressed && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen(true);
      }
      if (event.key === 'Escape') {
        setCommandOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const navigateToSection = (section: AdminSectionKey) => {
    navigate(`/admin/${section}`);
  };

  const toggleSongSelection = (songId: string) => {
    setSelectedSongIds((current) => (
      current.includes(songId)
        ? current.filter((id) => id !== songId)
        : [...current, songId]
    ));
  };

  const toggleAllSongs = () => {
    setSelectedSongIds((current) => (
      current.length === filteredSongs.length ? [] : filteredSongs.map((song) => song.id)
    ));
  };

  const applyBulkSongAction = (action: 'review' | 'publish' | 'unlock' | 'repair') => {
    if (selectedSongIds.length === 0) return;

    setSongs((current) => current.map((song) => {
      if (!selectedSongIds.includes(song.id)) return song;

      if (action === 'review') {
        return { ...song, approvalState: 'review' };
      }

      if (action === 'publish') {
        return { ...song, approvalState: 'published', broken: false };
      }

      if (action === 'unlock') {
        const regions = song.regions.includes('GLOBAL') ? song.regions : [...song.regions, 'GLOBAL'];
        return { ...song, regions };
      }

      return {
        ...song,
        broken: false,
        ingestionNote: 'Repair queued from admin bulk action.',
      };
    }));
  };

  const createSongDraft = () => {
    const nextSong: SongRecord = {
      id: `song_${Date.now()}`,
      title: 'Untitled draft',
      artist: 'New artist',
      album: 'Untitled project',
      genre: 'Pop',
      language: 'English',
      artwork: 'MX',
      duration: '3:00',
      popularityScore: 50,
      releaseDate: new Date().toISOString().slice(0, 10),
      explicit: false,
      approvalState: 'draft',
      regions: ['IN'],
      broken: false,
      ingestionNote: 'Created from admin draft workflow.',
    };

    setSongs((current) => [nextSong, ...current]);
    setFocusedSongId(nextSong.id);
    setSongView('catalog');
  };

  const saveSongEditor = () => {
    if (!focusedSong) return;

    setSongs((current) => current.map((song) => (
      song.id === focusedSong.id
        ? {
            ...song,
            title: songEditor.title,
            artist: songEditor.artist,
            album: songEditor.album,
            genre: songEditor.genre,
            language: songEditor.language,
            artwork: songEditor.artwork || 'MX',
            duration: songEditor.duration,
            popularityScore: Number(songEditor.popularityScore),
            releaseDate: songEditor.releaseDate,
            explicit: songEditor.explicit,
            approvalState: songEditor.approvalState,
            regions: songEditor.regions.split(',').flatMap((item) => {
              const trimmed = item.trim();
              return trimmed ? [trimmed] : [];
            }),
          }
        : song
    )));
  };

  const deleteFocusedSong = () => {
    if (!focusedSong) return;

    const remainingSongs = songs.filter((song) => song.id !== focusedSong.id);
    setSongs(remainingSongs);
    setSelectedSongIds((current) => current.filter((id) => id !== focusedSong.id));
    setFocusedSongId(remainingSongs[0]?.id ?? '');
  };

  const handleFilesAdded = (fileList: FileList | null) => {
    if (!fileList) return;
    const nextFiles = Array.from(fileList).map((file) => file.name);
    setUploadQueue((current) => [...nextFiles, ...current].slice(0, 8));
  };

  const reorderPlaylists = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    setPlaylists((current) => {
      const next = [...current];
      const fromIndex = next.findIndex((playlist) => playlist.id === fromId);
      const toIndex = next.findIndex((playlist) => playlist.id === toId);
      if (fromIndex === -1 || toIndex === -1) return current;
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next.map((playlist, index) => ({
        ...playlist,
        trendingScore: Math.max(60, 96 - index * 6),
      }));
    });
  };

  const toggleArtistVerification = (artistId: string) => {
    setArtists((current) => current.map((artist) => (
      artist.id === artistId ? { ...artist, verified: !artist.verified } : artist
    )));
  };

  const updateModerationStatus = (caseId: string, status: ModerationCase['status']) => {
    setModerationCases((current) => current.map((item) => (
      item.id === caseId ? { ...item, status } : item
    )));
  };

  const updateUserStatus = (userId: string, status: UserRecord['status']) => {
    setUsers((current) => current.map((item) => (
      item.id === userId ? { ...item, status } : item
    )));
  };

  const toggleFeatureFlag = (flagId: string, enabled: boolean) => {
    setFeatureFlags((current) => current.map((flag) => (
      flag.id === flagId ? { ...flag, enabled, rollout: enabled ? Math.max(flag.rollout, 5) : 0 } : flag
    )));
  };

  const updateFeatureRollout = (flagId: string, rollout: number) => {
    setFeatureFlags((current) => current.map((flag) => (
      flag.id === flagId ? { ...flag, rollout, enabled: rollout > 0 } : flag
    )));
  };

  const updateBannerState = (bannerId: string, nextState: ContentState) => {
    setBanners((current) => current.map((banner) => (
      banner.id === bannerId ? { ...banner, status: nextState } : banner
    )));
  };

  const queueNotificationDraft = () => {
    if (!notificationTitle.trim()) return;

    const nextCampaign: NotificationCampaign = {
      id: `campaign_${Date.now()}`,
      title: notificationTitle.trim(),
      segment: notificationSegment,
      channel: notificationChannel,
      status: 'draft',
      scheduledAt: new Date(notificationSchedule).toISOString(),
      uplift: 'Awaiting send',
    };

    setNotifications((current) => [nextCampaign, ...current]);
    setNotificationTitle('');
  };

  const addInternalNote = () => {
    if (!noteDraft.trim()) return;

    const nextNote = {
      id: `note_${Date.now()}`,
      author: session.name || 'Admin operator',
      scope: currentSectionConfig.label,
      body: noteDraft.trim(),
      createdAt: new Date().toISOString(),
    };

    setNotes((current) => [nextNote, ...current]);
    setNoteDraft('');
  };

  if (session.status === 'checking') {
    return (
      <div className="admin-shell flex min-h-screen items-center justify-center px-6">
        <div className="admin-panel w-full max-w-xl rounded-[32px] p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-cyan-300/20 bg-cyan-400/10">
            <RefreshCw className="h-6 w-6 animate-spin text-cyan-300" />
          </div>
          <h1 className="mt-6 text-3xl font-semibold text-white">Loading Mavrixfy Admin</h1>
          <p className="mt-3 text-sm text-slate-400">
            Verifying operator access, resolving permissions, and preparing the control surface.
          </p>
        </div>
      </div>
    );
  }

  if (session.status === 'signed_out') {
    return (
      <div className="admin-shell flex min-h-screen items-center justify-center px-6">
        <div className="admin-panel w-full max-w-2xl rounded-[32px] p-8 md:p-10">
          <div className="flex h-14 w-14 items-center justify-center rounded-3xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-200">
            <Command className="h-5 w-5" />
          </div>
          <h1 className="mt-6 text-3xl font-semibold text-white">Mavrixfy Control Center</h1>
          <p className="mt-3 max-w-xl text-sm text-slate-400">
            Sign in with an admin-enabled account to manage catalog operations, playlists, moderation, analytics,
            remote config, and publishing workflows.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/login" className={primaryButtonClass}>
              Sign in
            </Link>
            {import.meta.env.DEV && (
              <Link to="/admin/overview?admin-preview=1" className={quietButtonClass}>
                Local preview
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (session.status === 'denied') {
    return (
      <div className="admin-shell flex min-h-screen items-center justify-center px-6">
        <div className="admin-panel w-full max-w-3xl rounded-[32px] p-8 md:p-10">
          <div className="flex items-start gap-5">
            <div className="rounded-3xl border border-rose-400/20 bg-rose-400/10 p-4 text-rose-200">
              <LockKeyhole className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold text-white">Access not granted</h1>
              <p className="mt-3 text-sm text-slate-400">
                {session.denialReason ?? 'This account is signed in, but it is not recognized as an admin operator.'}
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <div className="admin-elevated rounded-[28px] p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Recommended Firestore doc</p>
              <pre className="mt-4 overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-xs text-slate-300">
{`admins/${session.uid ?? '<uid>'}
{
  role: "super_admin",
  status: "active",
  permissions: ["overview.view", "catalog.manage"],
  updatedAt: serverTimestamp()
}`}
              </pre>
            </div>
            <div className="admin-elevated rounded-[28px] p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Alternate path</p>
              <ul className="mt-4 space-y-3 text-sm text-slate-300">
                <li>Set a Firebase custom claim like `admin: true` for coarse access.</li>
                <li>Use Firestore `admins/{'{uid}'}` for role and permission detail.</li>
                <li>Keep writes to the admins collection on a trusted backend only.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-3 2xl:grid-cols-6">
        {overviewMetrics.map((metric) => (
          <MetricTile
            key={metric.key}
            label={metric.label}
            value={metric.value}
            delta={metric.delta}
            detail={metric.detail}
          />
        ))}
      </div>

      <div className="grid gap-6 2xl:grid-cols-[1.4fr_0.9fr]">
        <div className={sectionCardClass}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Growth & engagement</p>
              <h3 className="mt-2 text-xl font-semibold text-white">Daily growth and streaming behavior</h3>
            </div>
            <SectionBadge
              label={isLive ? 'Hybrid live' : session.preview ? 'Preview seed' : 'Seeded ops snapshot'}
              className="admin-chip text-slate-200"
            />
          </div>

          <div className="mt-6 grid gap-8 xl:grid-cols-2">
            <DualMetricChart
              data={seed.growthSeries}
              primaryLabel="New streams"
              secondaryLabel="New followers"
            />
            <DualMetricChart
              data={seed.engagementSeries}
              primaryLabel="Real-time activity"
              secondaryLabel="Saves"
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className={sectionCardClass}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Search trends</p>
                <h3 className="mt-2 text-xl font-semibold text-white">Queries accelerating today</h3>
              </div>
              <Sparkles className="h-5 w-5 text-cyan-300" />
            </div>
            <div className="mt-5 space-y-3">
              {seed.searchTrends.map((trend) => (
                <div key={trend.keyword} className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-slate-100">{trend.keyword}</p>
                    <SectionBadge label={trend.lift} className="admin-chip text-emerald-200" />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-400">
                    <span>{trend.searchCount} searches</span>
                    <span>{trend.intent}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={sectionCardClass}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">System health</p>
                <h3 className="mt-2 text-xl font-semibold text-white">Core platform signals</h3>
              </div>
              <Bot className="h-5 w-5 text-emerald-300" />
            </div>
            <div className="mt-5 space-y-3">
              {seed.healthSignals.map((signal) => (
                <div key={signal.label} className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-slate-100">{signal.label}</p>
                    <StatusPill
                      label={signal.value}
                      className={
                        signal.state === 'healthy'
                          ? 'admin-pill-success'
                          : signal.state === 'warning'
                            ? 'admin-pill-warning'
                            : 'admin-pill-danger'
                      }
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-400">{signal.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 2xl:grid-cols-[1fr_1fr_0.95fr]">
        <div className={sectionCardClass}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Recently added</p>
              <h3 className="mt-2 text-xl font-semibold text-white">Content moving through the system</h3>
            </div>
            <Music2 className="h-5 w-5 text-cyan-300" />
          </div>
          <div className="mt-5 space-y-3">
            {seed.recentContent.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-4 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                <div>
                  <p className="font-medium text-slate-100">{item.title}</p>
                  <p className="mt-1 text-xs text-slate-400">{item.owner}</p>
                </div>
                <div className="text-right">
                  <StatusPill label={item.state} className={statePillClass(item.state)} />
                  <p className="mt-2 text-xs text-slate-500">{formatRelativeTime(item.timestamp)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={sectionCardClass}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Activity timeline</p>
              <h3 className="mt-2 text-xl font-semibold text-white">Operator actions and automations</h3>
            </div>
            <Workflow className="h-5 w-5 text-cyan-300" />
          </div>
          <div className="mt-5 space-y-4">
            {seed.realtimeEvents.map((event) => (
              <div key={event.id} className="flex gap-4">
                <div className="mt-1 h-2.5 w-2.5 rounded-full bg-cyan-300" />
                <div>
                  <p className="font-medium text-slate-100">{event.action}</p>
                  <p className="mt-1 text-sm text-slate-400">{event.detail}</p>
                  <p className="mt-2 text-xs text-slate-500">{formatRelativeTime(event.timestamp)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={sectionCardClass}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Internal notes</p>
              <h3 className="mt-2 text-xl font-semibold text-white">Shift context and operator handoff</h3>
            </div>
            <Sparkles className="h-5 w-5 text-emerald-300" />
          </div>
          <div className="mt-5 space-y-3">
            {notes.slice(0, 3).map((note) => (
              <div key={note.id} className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-slate-100">{note.scope}</p>
                  <p className="text-xs text-slate-500">{formatRelativeTime(note.createdAt)}</p>
                </div>
                <p className="mt-2 text-sm text-slate-300">{note.body}</p>
                <p className="mt-3 text-xs text-slate-500">{note.author}</p>
              </div>
            ))}

            <Textarea
              value={noteDraft}
              onChange={(event) => setNoteDraft(event.target.value)}
              className="min-h-[112px] border-white/10 bg-white/[0.04] text-slate-100 placeholder:text-slate-500"
              placeholder="Leave the next shift a note about launch checks, approvals, or anomalies"
            />
            <button type="button" onClick={addInternalNote} className={primaryButtonClass}>
              Save note
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSongs = () => {
    const brokenSongs = songs.filter((song) => song.broken);

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'catalog', label: 'Catalog table' },
            { key: 'imports', label: 'Bulk import' },
            { key: 'quality', label: 'Quality control' },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setSongView(item.key as 'catalog' | 'imports' | 'quality')}
              className={cn(
                'rounded-full border px-4 py-2 text-sm',
                songView === item.key
                  ? 'border-cyan-300/30 bg-cyan-400/12 text-cyan-100'
                  : 'border-white/10 bg-white/[0.03] text-slate-300'
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        {songView === 'catalog' && (
          <div className="grid gap-6 2xl:grid-cols-[1.35fr_0.85fr]">
            <div className={sectionCardClass}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Song management</p>
                  <h3 className="mt-2 text-xl font-semibold text-white">Catalog CMS and approval workflow</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={createSongDraft} className={primaryButtonClass}>
                    New song
                  </button>
                  <button type="button" onClick={() => applyBulkSongAction('review')} className={quietButtonClass}>
                    Move to review
                  </button>
                  <button type="button" onClick={() => applyBulkSongAction('publish')} className={quietButtonClass}>
                    Publish
                  </button>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Input
                  value={songSearch}
                  onChange={(event) => setSongSearch(event.target.value)}
                  placeholder="Search title, artist, album, or genre"
                  className="max-w-sm border-white/10 bg-white/[0.04] text-slate-100"
                />
                <SectionBadge
                  label={`${selectedSongIds.length} selected`}
                  className="admin-chip text-slate-300"
                />
                <button type="button" onClick={() => applyBulkSongAction('unlock')} className={quietButtonClass}>
                  Unlock regions
                </button>
                <button type="button" onClick={() => applyBulkSongAction('repair')} className={quietButtonClass}>
                  Queue repair
                </button>
              </div>

              <div className="mt-5 overflow-hidden rounded-[24px] border border-white/8">
                <div className="grid grid-cols-[44px_1.8fr_1.2fr_0.9fr_0.9fr_0.8fr] gap-4 border-b border-white/8 bg-white/[0.04] px-4 py-3 text-xs uppercase tracking-[0.18em] text-slate-500">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={filteredSongs.length > 0 && selectedSongIds.length === filteredSongs.length}
                      onChange={toggleAllSongs}
                      aria-label="Select all songs"
                      className="h-4 w-4 rounded border-white/10 bg-transparent"
                    />
                  </div>
                  <span>Track</span>
                  <span>Album</span>
                  <span>State</span>
                  <span>Regions</span>
                  <span>Quality</span>
                </div>

                <div className="admin-scroll max-h-[520px] overflow-y-auto">
                  {filteredSongs.map((song) => (
                    <button
                      key={song.id}
                      type="button"
                      onClick={() => setFocusedSongId(song.id)}
                      className={cn(
                        'grid w-full grid-cols-[44px_1.8fr_1.2fr_0.9fr_0.9fr_0.8fr] gap-4 border-b border-white/8 p-4 text-left hover:bg-white/[0.03]',
                        focusedSongId === song.id && 'bg-cyan-400/[0.07]'
                      )}
                    >
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedSongIds.includes(song.id)}
                          onClick={(event) => event.stopPropagation()}
                          onChange={() => toggleSongSelection(song.id)}
                          aria-label={`Select ${song.title}`}
                          className="h-4 w-4 rounded border-white/10 bg-transparent"
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400/20 to-emerald-300/15 text-xs font-semibold text-cyan-100">
                            {song.artwork}
                          </div>
                          <div>
                            <p className="font-medium text-slate-100">{song.title}</p>
                            <p className="mt-1 text-xs text-slate-400">{song.artist}</p>
                          </div>
                        </div>
                      </div>
                      <div>
                        <p className="font-medium text-slate-200">{song.album}</p>
                        <p className="mt-1 text-xs text-slate-500">{song.genre} • {song.language}</p>
                      </div>
                      <div>
                        <StatusPill label={song.approvalState} className={statePillClass(song.approvalState)} />
                        <ClientDateText as="p" value={song.releaseDate} formatter={longDate} className="mt-2 text-xs text-slate-500" />
                      </div>
                      <div className="text-xs text-slate-300">
                        {song.regions.slice(0, 3).join(', ')}
                        {song.regions.length > 3 ? ` +${song.regions.length - 3}` : ''}
                      </div>
                      <div className="text-xs">
                        <p className={song.broken ? 'text-amber-300' : 'text-emerald-300'}>
                          {song.broken ? 'Needs repair' : 'Healthy'}
                        </p>
                        <p className="mt-1 text-slate-500">{song.duration}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className={sectionCardClass}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Metadata editor</p>
                    <h3 className="mt-2 text-xl font-semibold text-white">Edit selected track</h3>
                  </div>
                  {focusedSong && (
                    <StatusPill
                      label={focusedSong.approvalState}
                      className={statePillClass(focusedSong.approvalState)}
                    />
                  )}
                </div>

                {focusedSong ? (
                  <div className="mt-5 space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <Input value={songEditor.title} onChange={(event) => setSongEditor((current) => ({ ...current, title: event.target.value }))} className="border-white/10 bg-white/[0.04] text-slate-100" placeholder="Title" />
                      <Input value={songEditor.artist} onChange={(event) => setSongEditor((current) => ({ ...current, artist: event.target.value }))} className="border-white/10 bg-white/[0.04] text-slate-100" placeholder="Artist" />
                      <Input value={songEditor.album} onChange={(event) => setSongEditor((current) => ({ ...current, album: event.target.value }))} className="border-white/10 bg-white/[0.04] text-slate-100" placeholder="Album" />
                      <Input value={songEditor.genre} onChange={(event) => setSongEditor((current) => ({ ...current, genre: event.target.value }))} className="border-white/10 bg-white/[0.04] text-slate-100" placeholder="Genre" />
                      <Input value={songEditor.language} onChange={(event) => setSongEditor((current) => ({ ...current, language: event.target.value }))} className="border-white/10 bg-white/[0.04] text-slate-100" placeholder="Language" />
                      <Input value={songEditor.artwork} onChange={(event) => setSongEditor((current) => ({ ...current, artwork: event.target.value.slice(0, 3).toUpperCase() }))} className="border-white/10 bg-white/[0.04] text-slate-100" placeholder="Artwork badge" />
                      <Input value={songEditor.duration} onChange={(event) => setSongEditor((current) => ({ ...current, duration: event.target.value }))} className="border-white/10 bg-white/[0.04] text-slate-100" placeholder="Duration" />
                      <Input type="date" value={songEditor.releaseDate} onChange={(event) => setSongEditor((current) => ({ ...current, releaseDate: event.target.value }))} className="border-white/10 bg-white/[0.04] text-slate-100" />
                    </div>

                    <div className="space-y-3">
                      <label className="text-sm text-slate-300">Popularity score: {songEditor.popularityScore}</label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={songEditor.popularityScore}
                        onChange={(event) => setSongEditor((current) => ({ ...current, popularityScore: Number(event.target.value) }))}
                        className="admin-range w-full"
                      />
                    </div>

                    <Input
                      value={songEditor.regions}
                      onChange={(event) => setSongEditor((current) => ({ ...current, regions: event.target.value }))}
                      className="border-white/10 bg-white/[0.04] text-slate-100"
                      placeholder="Comma separated regions"
                    />

                    <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                      <div>
                        <p className="font-medium text-slate-100">Explicit content</p>
                        <p className="text-xs text-slate-500">Controls safe-mode surfaces and editorial review.</p>
                      </div>
                      <Switch checked={songEditor.explicit} onCheckedChange={(checked) => setSongEditor((current) => ({ ...current, explicit: checked }))} />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {(['draft', 'review', 'scheduled', 'published'] as ContentState[]).map((state) => (
                        <button
                          key={state}
                          type="button"
                          onClick={() => setSongEditor((current) => ({ ...current, approvalState: state }))}
                          className={cn(
                            'rounded-full border px-3 py-1.5 text-sm',
                            songEditor.approvalState === state
                              ? statePillClass(state)
                              : 'border-white/10 bg-white/[0.03] text-slate-300'
                          )}
                        >
                          {state}
                        </button>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={saveSongEditor} className={primaryButtonClass}>
                        Save changes
                      </button>
                      <button type="button" onClick={deleteFocusedSong} className="rounded-2xl border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100 hover:border-rose-300/35">
                        Delete song
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-5 text-sm text-slate-400">Select a track to start editing metadata.</p>
                )}
              </div>

              <div className={sectionCardClass}>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Approval notes</p>
                <div className="mt-4 space-y-3">
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                    <p className="font-medium text-slate-100">Approval workflow</p>
                    <p className="mt-2 text-sm text-slate-400">
                      Draft → Review → Scheduled → Published. Each promotion can also append audit logs and optional legal sign-off.
                    </p>
                  </div>
                  {focusedSong && (
                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                      <p className="font-medium text-slate-100">Latest note</p>
                      <p className="mt-2 text-sm text-slate-400">{focusedSong.ingestionNote}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {songView === 'imports' && (
          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <div className={sectionCardClass}>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Bulk import support</p>
              <h3 className="mt-2 text-xl font-semibold text-white">Upload manager</h3>
              <div className="mt-5 rounded-[28px] border border-dashed border-cyan-300/25 bg-cyan-400/[0.04] p-6 text-center">
                <UploadCloud className="mx-auto h-8 w-8 text-cyan-200" />
                <p className="mt-4 text-sm text-slate-300">
                  Drop audio files, artwork bundles, or metadata CSVs to stage a new ingest batch.
                </p>
                <label className="mt-4 inline-flex cursor-pointer rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-100">
                  Select files
                  <input
                    type="file"
                    multiple
                    onChange={(event) => handleFilesAdded(event.target.files)}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="mt-5 space-y-3">
                {uploadQueue.length === 0 ? (
                  <p className="text-sm text-slate-500">No local files staged yet.</p>
                ) : (
                  uploadQueue.map((file) => (
                    <div key={file} className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
                      {file}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className={sectionCardClass}>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Ingest queue</p>
              <h3 className="mt-2 text-xl font-semibold text-white">Processing jobs</h3>
              <div className="mt-5 space-y-4">
                {seed.importJobs.map((job) => (
                  <div key={job.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium text-slate-100">{job.label}</p>
                        <p className="mt-1 text-xs text-slate-500">{job.source}</p>
                      </div>
                      <StatusPill
                        label={job.status}
                        className={
                          job.status === 'completed'
                            ? 'admin-pill-success'
                            : job.status === 'blocked'
                              ? 'admin-pill-danger'
                              : 'admin-pill-warning'
                        }
                      />
                    </div>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/8">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-300"
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {songView === 'quality' && (
          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <div className={sectionCardClass}>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Broken track detector</p>
              <h3 className="mt-2 text-xl font-semibold text-white">Quality exceptions</h3>
              <div className="mt-5 space-y-3">
                {brokenSongs.map((song) => (
                  <div key={song.id} className="rounded-2xl border border-amber-300/18 bg-amber-300/8 px-4 py-3">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium text-slate-100">{song.title}</p>
                        <p className="mt-1 text-xs text-slate-400">{song.artist} • {song.album}</p>
                      </div>
                      <button type="button" onClick={() => setSongs((current) => current.map((item) => item.id === song.id ? { ...item, broken: false } : item))} className={quietButtonClass}>
                        Mark repaired
                      </button>
                    </div>
                    <p className="mt-3 text-sm text-slate-300">{song.ingestionNote}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className={sectionCardClass}>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Availability control</p>
              <h3 className="mt-2 text-xl font-semibold text-white">Regional coverage</h3>
              <div className="mt-5 space-y-3">
                {songs.map((song) => (
                  <div key={song.id} className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                    <div className="flex items-center justify-between gap-4">
                      <p className="font-medium text-slate-100">{song.title}</p>
                      <span className="text-xs text-slate-500">{song.regions.length} regions</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {song.regions.map((region) => (
                        <SectionBadge key={`${song.id}-${region}`} label={region} className="admin-chip text-slate-300" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderPlaylists = () => (
    <div className="grid gap-6 2xl:grid-cols-[1.1fr_0.9fr]">
      <div className={sectionCardClass}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Playlist management</p>
            <h3 className="mt-2 text-xl font-semibold text-white">Editorial ordering and schedule</h3>
          </div>
          <SectionBadge label="Drag to reorder" className="admin-chip text-slate-300" />
        </div>

        <div className="mt-5 space-y-3">
          {playlists.map((playlist) => (
            <div
              key={playlist.id}
              draggable
              onDragStart={() => { draggedPlaylistIdRef.current = playlist.id; }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (draggedPlaylistIdRef.current) reorderPlaylists(draggedPlaylistIdRef.current, playlist.id);
                draggedPlaylistIdRef.current = null;
              }}
              className="flex items-center gap-4 rounded-[24px] border border-white/8 bg-white/[0.03] p-4"
            >
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-slate-400">
                <GripVertical className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="font-medium text-slate-100">{playlist.name}</p>
                  <StatusPill label={playlist.approvalState} className={statePillClass(playlist.approvalState)} />
                </div>
                <p className="mt-1 text-sm text-slate-400">
                  {playlist.category} • {playlist.songCount} songs • {playlist.curator}
                </p>
                <ClientDateText
                  as="p"
                  value={playlist.publishAt}
                  formatter={longDateTime}
                  prefix="Publish "
                  suffix={` • ${playlist.homepageSlot}`}
                  className="mt-2 text-xs text-slate-500"
                />
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-cyan-200">Trend {playlist.trendingScore}</p>
                <p className="mt-1 text-xs text-slate-500">{playlist.listeners}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        <div className={sectionCardClass}>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Homepage pushes</p>
          <h3 className="mt-2 text-xl font-semibold text-white">Featured shelf controls</h3>
          <div className="mt-5 space-y-3">
            {playlists.slice(0, 3).map((playlist) => (
              <div key={`push-${playlist.id}`} className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-slate-100">{playlist.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{playlist.homepageSlot}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPlaylists((current) => current.map((item) => item.id === playlist.id ? { ...item, approvalState: 'published' } : item))}
                    className={primaryButtonClass}
                  >
                    Push live
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={sectionCardClass}>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Category management</p>
          <h3 className="mt-2 text-xl font-semibold text-white">Shelf mix</h3>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {['Focus', 'Workout', 'Mood', 'Regional'].map((category) => (
              <div key={category} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <p className="font-medium text-slate-100">{category}</p>
                <p className="mt-2 text-sm text-slate-400">
                  {playlists.filter((playlist) => playlist.category === category).length} active playlist surfaces
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderArtists = () => (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <div className={sectionCardClass}>
        <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Artist management</p>
        <h3 className="mt-2 text-xl font-semibold text-white">Profiles and verification</h3>
        <div className="mt-5 space-y-3">
          {artists.map((artist) => (
            <div key={artist.id} className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <p className="font-medium text-slate-100">{artist.name}</p>
                    {artist.verified && <SectionBadge label="Verified" className="admin-pill-success" />}
                  </div>
                  <p className="mt-2 text-sm text-slate-400">
                    {artist.monthlyListeners} monthly listeners • {artist.discographyCount} releases
                  </p>
                </div>
                <Switch checked={artist.verified} onCheckedChange={() => toggleArtistVerification(artist.id)} />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/8 bg-slate-950/40 p-3 text-sm text-slate-300">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Velocity</p>
                  <p className="mt-2">{artist.releaseVelocity}</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-slate-950/40 p-3 text-sm text-slate-300">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Top market</p>
                  <p className="mt-2">{artist.topMarket}</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-slate-950/40 p-3 text-sm text-slate-300">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Discography</p>
                  <p className="mt-2">{artist.discographyCount} items</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={sectionCardClass}>
        <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Artist analytics</p>
        <h3 className="mt-2 text-xl font-semibold text-white">Top operator opportunities</h3>
        <div className="mt-5 space-y-4">
          <RankedBars
            items={artists.map((artist, index) => ({
              id: artist.id,
              label: artist.name,
              value: artist.monthlyListeners,
              percent: 92 - index * 16,
              sublabel: `${artist.topMarket} • ${artist.releaseVelocity}`,
            }))}
          />
        </div>
      </div>
    </div>
  );

  const renderDiscovery = () => (
    <div className="grid gap-6 2xl:grid-cols-[1.05fr_0.95fr]">
      <div className={sectionCardClass}>
        <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Search & discovery control</p>
        <h3 className="mt-2 text-xl font-semibold text-white">Ranking weights and curated boosts</h3>
        <div className="mt-5 space-y-5">
          {searchWeights.map((weight) => (
            <div key={weight.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-slate-100">{weight.label}</p>
                  <p className="mt-1 text-xs text-slate-500">{weight.hint}</p>
                </div>
                <SectionBadge label={`${weight.value}`} className="admin-chip text-cyan-100" />
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={weight.value}
                onChange={(event) => setSearchWeights((current) => current.map((entry) => (
                  entry.id === weight.id ? { ...entry, value: Number(event.target.value) } : entry
                )))}
                className="admin-range mt-4 w-full"
              />
            </div>
          ))}

          <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
            <p className="font-medium text-slate-100">Curated discovery boosts</p>
            <div className="mt-4 space-y-3">
              {seed.curatedBoosts.map((boost) => (
                <div key={boost.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-slate-950/40 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-100">{boost.keyword}</p>
                    <p className="mt-1 text-xs text-slate-500">{boost.placement}</p>
                  </div>
                  <div className="text-right text-sm text-cyan-200">
                    +{boost.boost}
                    <p className="mt-1 text-xs text-slate-500">{formatRelativeTime(boost.expiresAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className={sectionCardClass}>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Misspelling map</p>
          <h3 className="mt-2 text-xl font-semibold text-white">Canonical term routing</h3>
          <div className="mt-5 space-y-3">
            {seed.typoMappings.map((mapping) => (
              <div key={mapping.id} className="flex items-center justify-between gap-4 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                <div>
                  <p className="font-medium text-slate-100">{mapping.typo}</p>
                  <p className="mt-1 text-xs text-slate-500">→ {mapping.canonical}</p>
                </div>
                <SectionBadge label={mapping.language} className="admin-chip text-slate-300" />
              </div>
            ))}
          </div>
        </div>

        <div className={sectionCardClass}>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Search token management</p>
          <h3 className="mt-2 text-xl font-semibold text-white">Active indexed tokens</h3>
          <div className="mt-5 flex flex-wrap gap-2">
            {seed.searchTokens.map((token) => (
              <SectionBadge key={token} label={token} className="admin-chip text-slate-300" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderModeration = () => (
    <div className="grid gap-6 2xl:grid-cols-[1.15fr_0.85fr]">
      <div className={sectionCardClass}>
        <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Content moderation</p>
        <h3 className="mt-2 text-xl font-semibold text-white">Reported content review queue</h3>
        <div className="mt-5 space-y-3">
          {moderationCases.map((item) => (
            <div key={item.id} className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-100">{item.entity}</p>
                  <p className="mt-1 text-sm text-slate-400">{item.reason}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill label={item.severity} className={item.severity === 'high' ? 'admin-pill-danger' : item.severity === 'medium' ? 'admin-pill-warning' : 'admin-pill-success'} />
                  <StatusPill label={item.status} className={moderationPillClass(item.status)} />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => updateModerationStatus(item.id, 'investigating')} className={quietButtonClass}>
                  Investigate
                </button>
                <button type="button" onClick={() => updateModerationStatus(item.id, 'escalated')} className={quietButtonClass}>
                  Escalate
                </button>
                <button type="button" onClick={() => updateModerationStatus(item.id, 'resolved')} className={primaryButtonClass}>
                  Resolve
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        <div className={sectionCardClass}>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Fraud & abuse monitoring</p>
          <h3 className="mt-2 text-xl font-semibold text-white">Active signals</h3>
          <div className="mt-5 space-y-3">
            {seed.fraudSignals.map((signal) => (
              <div key={signal.id} className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-slate-100">{signal.title}</p>
                  <SectionBadge label={signal.score} className="admin-pill-warning" />
                </div>
                <p className="mt-2 text-sm text-slate-400">{signal.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className={sectionCardClass}>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Copyright tools</p>
          <h3 className="mt-2 text-xl font-semibold text-white">Takedown checklist</h3>
          <ul className="mt-5 space-y-3 text-sm text-slate-300">
            <li className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">Verify rights-holder request and affected ISRC / asset ids.</li>
            <li className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">Lock playback in impacted territories before soft delete.</li>
            <li className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">Write a complete audit entry and notify editorial if playlist slots are impacted.</li>
          </ul>
        </div>
      </div>
    </div>
  );

  const renderUsers = () => (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="admin-kpi-card relative rounded-[26px] p-5">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Premium mix</p>
          <p className="mt-4 text-3xl font-semibold text-white">
            {Math.round((users.filter((entry) => entry.plan === 'premium').length / users.length) * 100)}%
          </p>
          <p className="mt-2 text-sm text-slate-400">Across reviewed accounts in this workspace snapshot</p>
        </div>
        <div className="admin-kpi-card relative rounded-[26px] p-5">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Reported users</p>
          <p className="mt-4 text-3xl font-semibold text-white">
            {users.filter((entry) => entry.reports > 0).length}
          </p>
          <p className="mt-2 text-sm text-slate-400">Require watchlist or moderation review</p>
        </div>
        <div className="admin-kpi-card relative rounded-[26px] p-5">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Restricted accounts</p>
          <p className="mt-4 text-3xl font-semibold text-white">
            {users.filter((entry) => entry.status === 'restricted').length}
          </p>
          <p className="mt-2 text-sm text-slate-400">Synced with trust and safety queues</p>
        </div>
      </div>

      <div className={sectionCardClass}>
        <p className="text-xs uppercase tracking-[0.22em] text-slate-500">User management</p>
        <h3 className="mt-2 text-xl font-semibold text-white">Plan mix, reports, and account actions</h3>
        <div className="mt-5 space-y-3">
          {users.map((item) => (
            <div key={item.id} className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <p className="font-medium text-slate-100">{item.name}</p>
                    <StatusPill label={item.plan} className={item.plan === 'premium' ? 'admin-pill-success' : 'admin-chip text-slate-300'} />
                    <StatusPill label={item.status} className={userStatusClass(item.status)} />
                  </div>
                  <p className="mt-2 text-sm text-slate-400">
                    {item.country} • {item.language} • {item.reports} reports
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => updateUserStatus(item.id, 'watch')} className={quietButtonClass}>
                    Watch
                  </button>
                  <button type="button" onClick={() => updateUserStatus(item.id, 'healthy')} className={quietButtonClass}>
                    Restore
                  </button>
                  <button type="button" onClick={() => updateUserStatus(item.id, 'restricted')} className="rounded-2xl border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100 hover:border-rose-300/35">
                    Restrict
                  </button>
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-500">Last active {formatRelativeTime(item.lastActiveAt)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderAnalytics = () => (
    <div className="space-y-6">
      <div className="grid gap-6 2xl:grid-cols-[1.2fr_0.8fr]">
        <div className={sectionCardClass}>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Streaming analytics</p>
          <h3 className="mt-2 text-xl font-semibold text-white">Growth and retention picture</h3>
          <div className="mt-6">
            <DualMetricChart
              data={seed.growthSeries}
              primaryLabel="Streams"
              secondaryLabel="Returning listeners"
            />
          </div>
        </div>

        <div className={sectionCardClass}>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Real-time activity</p>
          <h3 className="mt-2 text-xl font-semibold text-white">Current platform pulse</h3>
          <div className="mt-5 space-y-3">
            {seed.realtimeEvents.map((event) => (
              <div key={`analytics-${event.id}`} className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                <p className="font-medium text-slate-100">{event.action}</p>
                <p className="mt-2 text-sm text-slate-400">{event.detail}</p>
                <p className="mt-2 text-xs text-slate-500">{formatRelativeTime(event.timestamp)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 2xl:grid-cols-3">
        <div className={sectionCardClass}>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Top songs</p>
          <div className="mt-5">
            <RankedBars items={seed.topSongs} />
          </div>
        </div>

        <div className={sectionCardClass}>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Top playlists</p>
          <div className="mt-5">
            <RankedBars items={seed.topPlaylists} />
          </div>
        </div>

        <div className={sectionCardClass}>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Market insights</p>
          <div className="mt-5 space-y-3">
            {seed.geoInsights.map((market) => (
              <div key={market.id} className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-slate-100">{market.market}</p>
                  <SectionBadge label={market.share} className="admin-chip text-cyan-100" />
                </div>
                <div className="mt-2 flex justify-between text-xs text-slate-500">
                  <span>Retention {market.retention}</span>
                  <span>{market.dominantLanguage}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderFlags = () => (
    <div className="grid gap-6 2xl:grid-cols-[1.05fr_0.95fr]">
      <div className={sectionCardClass}>
        <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Feature flags / remote config</p>
        <h3 className="mt-2 text-xl font-semibold text-white">Rollouts across web, Android, and iOS</h3>
        <div className="mt-5 space-y-4">
          {featureFlags.map((flag) => (
            <div key={flag.id} className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-slate-100">{flag.name}</p>
                  <p className="mt-2 text-sm text-slate-400">{flag.description}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {flag.targets.map((target) => (
                      <SectionBadge key={`${flag.id}-${target}`} label={target} className="admin-chip text-slate-300" />
                    ))}
                  </div>
                </div>
                <Switch checked={flag.enabled} onCheckedChange={(checked) => toggleFeatureFlag(flag.id, checked)} />
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm text-slate-300">
                  <span>Rollout</span>
                  <span>{flag.rollout}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={flag.rollout}
                  onChange={(event) => updateFeatureRollout(flag.id, Number(event.target.value))}
                  className="admin-range mt-3 w-full"
                />
              </div>
              <p className="mt-3 text-xs text-slate-500">Owner: {flag.owner}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        <div className={sectionCardClass}>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">OTA controls</p>
          <h3 className="mt-2 text-xl font-semibold text-white">Release channels</h3>
          <div className="mt-5 space-y-3">
            {seed.otaTracks.map((track) => (
              <div key={track.id} className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-100">{track.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{track.build}</p>
                  </div>
                  <StatusPill
                    label={track.status}
                    className={
                      track.status === 'ready'
                        ? 'admin-pill-success'
                        : track.status === 'paused'
                          ? 'admin-pill-danger'
                          : 'admin-pill-warning'
                    }
                  />
                </div>
                <p className="mt-3 text-sm text-slate-300">{track.channel} • rollout {track.rollout}</p>
              </div>
            ))}
          </div>
        </div>

        <div className={sectionCardClass}>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Release checks</p>
          <ul className="mt-5 space-y-3 text-sm text-slate-300">
            <li className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">Gate risky experiments behind audience + platform scopes.</li>
            <li className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">Keep rollback payloads ready for web and mobile hotfix channels.</li>
            <li className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">Record every rollout delta in audit logs with owner and reason.</li>
          </ul>
        </div>
      </div>
    </div>
  );

  const renderPromotions = () => (
    <div className="grid gap-6 2xl:grid-cols-[1.05fr_0.95fr]">
      <div className={sectionCardClass}>
        <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Banner / promotions manager</p>
        <h3 className="mt-2 text-xl font-semibold text-white">Campaign schedule and placements</h3>
        <div className="mt-5 space-y-3">
          {banners.map((banner) => (
            <button
              key={banner.id}
              type="button"
              onClick={() => setSelectedBannerId(banner.id)}
              className={cn(
                'w-full rounded-[24px] border p-4 text-left',
                selectedBannerId === banner.id
                  ? 'border-cyan-300/30 bg-cyan-400/10'
                  : 'border-white/8 bg-white/[0.03]'
              )}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-slate-100">{banner.title}</p>
                  <p className="mt-1 text-sm text-slate-400">{banner.placement} • {banner.audience}</p>
                </div>
                <StatusPill label={banner.status} className={statePillClass(banner.status)} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={(event) => { event.stopPropagation(); updateBannerState(banner.id, 'draft'); }} className={quietButtonClass}>
                  Draft
                </button>
                <button type="button" onClick={(event) => { event.stopPropagation(); updateBannerState(banner.id, 'scheduled'); }} className={quietButtonClass}>
                  Schedule
                </button>
                <button type="button" onClick={(event) => { event.stopPropagation(); updateBannerState(banner.id, 'published'); }} className={primaryButtonClass}>
                  Publish
                </button>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        <div className={sectionCardClass}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Preview simulator</p>
              <h3 className="mt-2 text-xl font-semibold text-white">Dark / light app preview</h3>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPreviewMode('dark')}
                className={cn('rounded-full border px-3 py-1.5 text-sm', previewMode === 'dark' ? 'border-cyan-300/30 bg-cyan-400/10 text-cyan-100' : 'border-white/10 text-slate-300')}
              >
                <MoonStar className="mr-2 inline h-4 w-4" />
                Dark
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode('light')}
                className={cn('rounded-full border px-3 py-1.5 text-sm', previewMode === 'light' ? 'border-cyan-300/30 bg-cyan-400/10 text-cyan-100' : 'border-white/10 text-slate-300')}
              >
                <MonitorPlay className="mr-2 inline h-4 w-4" />
                Light
              </button>
            </div>
          </div>

          {selectedBanner && (
            <div className={cn('admin-preview-card mt-5 rounded-[32px] p-5', previewMode === 'light' && 'light')}>
              <div className="mx-auto max-w-[340px] rounded-[30px] border border-white/10 bg-black/25 p-4 shadow-2xl backdrop-blur-md">
                <div className="flex items-center justify-between text-xs opacity-70">
                  <span>Mavrixfy</span>
                  <span>{previewMode === 'dark' ? 'Dark app' : 'Light app'}</span>
                </div>
                <div className="mt-5 rounded-[28px] p-5" style={{ background: `linear-gradient(135deg, ${selectedBanner.accent}55, transparent)` }}>
                  <p className="text-xs uppercase tracking-[0.22em] opacity-70">{selectedBanner.placement}</p>
                  <h4 className="mt-3 text-2xl font-semibold">{selectedBanner.title}</h4>
                  <p className="mt-3 text-sm opacity-80">{selectedBanner.audience}</p>
                  <div className="mt-6 inline-flex rounded-full border border-white/15 px-3 py-1 text-xs">
                    {selectedBanner.status}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className={sectionCardClass}>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Schedule window</p>
          {selectedBanner && (
            <div className="mt-5 space-y-3">
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                <p className="font-medium text-slate-100">Start</p>
                <ClientDateText as="p" value={selectedBanner.startAt} formatter={longDateTime} className="mt-2 text-sm text-slate-400" />
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                <p className="font-medium text-slate-100">End</p>
                <ClientDateText as="p" value={selectedBanner.endAt} formatter={longDateTime} className="mt-2 text-sm text-slate-400" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderNotifications = () => (
    <div className="grid gap-6 2xl:grid-cols-[0.95fr_1.05fr]">
      <div className={sectionCardClass}>
        <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Notifications manager</p>
        <h3 className="mt-2 text-xl font-semibold text-white">Compose segment-based campaigns</h3>
        <div className="mt-5 space-y-4">
          <Input
            value={notificationTitle}
            onChange={(event) => setNotificationTitle(event.target.value)}
            className="border-white/10 bg-white/[0.04] text-slate-100"
            placeholder="Campaign title"
          />
          <Input
            value={notificationSegment}
            onChange={(event) => setNotificationSegment(event.target.value)}
            className="border-white/10 bg-white/[0.04] text-slate-100"
            placeholder="Audience segment"
          />
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-500">Channel</p>
              <div className="flex gap-2">
                {(['push', 'in-app'] as const).map((channel) => (
                  <button
                    key={channel}
                    type="button"
                    onClick={() => setNotificationChannel(channel)}
                    className={cn(
                      'rounded-full border px-3 py-2 text-sm',
                      notificationChannel === channel
                        ? 'border-cyan-300/30 bg-cyan-400/10 text-cyan-100'
                        : 'border-white/10 text-slate-300'
                    )}
                  >
                    {channel}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-500">Schedule</p>
              <Input
                type="datetime-local"
                value={notificationSchedule}
                onChange={(event) => setNotificationSchedule(event.target.value)}
                className="border-white/10 bg-white/[0.04] text-slate-100"
              />
            </div>
          </div>

          <button type="button" onClick={queueNotificationDraft} className={primaryButtonClass}>
            Save campaign draft
          </button>
        </div>
      </div>

      <div className={sectionCardClass}>
        <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Campaign timeline</p>
        <h3 className="mt-2 text-xl font-semibold text-white">Recent alerts and uplift</h3>
        <div className="mt-5 space-y-3">
          {notifications.map((campaign) => (
            <div key={campaign.id} className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-100">{campaign.title}</p>
                  <p className="mt-2 text-sm text-slate-400">{campaign.segment} • {campaign.channel}</p>
                </div>
                <StatusPill
                  label={campaign.status}
                  className={
                    campaign.status === 'sent'
                      ? 'admin-pill-success'
                      : campaign.status === 'scheduled'
                        ? 'admin-pill-warning'
                        : 'admin-chip text-slate-300'
                  }
                />
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                <ClientDateText value={campaign.scheduledAt} formatter={longDateTime} />
                <span>{campaign.uplift}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderRoles = () => (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'permissions', label: 'Permissions & audit' },
          { key: 'architecture', label: 'Firestore architecture' },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setRolesView(item.key as 'permissions' | 'architecture')}
            className={cn(
              'rounded-full border px-4 py-2 text-sm',
              rolesView === item.key
                ? 'border-cyan-300/30 bg-cyan-400/10 text-cyan-100'
                : 'border-white/10 bg-white/[0.03] text-slate-300'
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {rolesView === 'permissions' && (
        <div className="grid gap-6 2xl:grid-cols-[1fr_1fr]">
          <div className={sectionCardClass}>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Admin roles</p>
            <h3 className="mt-2 text-xl font-semibold text-white">Role matrix</h3>
            <div className="mt-5 space-y-4">
              {seed.roleDefinitions.map((definition) => (
                <div key={definition.role} className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-100">{definition.label}</p>
                      <p className="mt-2 text-sm text-slate-400">{definition.description}</p>
                    </div>
                    {session.role === definition.role && <SectionBadge label="Current" className="admin-pill-success" />}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {definition.permissions.map((permission) => (
                      <SectionBadge key={`${definition.role}-${permission}`} label={getPermissionLabel(permission)} className="admin-chip text-slate-300" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className={sectionCardClass}>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Current operator</p>
              <h3 className="mt-2 text-xl font-semibold text-white">Session summary</h3>
              <div className="mt-5 space-y-3">
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                  <p className="font-medium text-slate-100">{session.name}</p>
                  <p className="mt-1 text-sm text-slate-400">{session.email}</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Role / source</p>
                  <p className="mt-2 text-sm text-slate-200">{session.role ?? 'Unknown'} • {session.source}</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Permissions</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {session.permissions.map((permission) => (
                      <SectionBadge key={permission} label={getPermissionLabel(permission)} className="admin-chip text-slate-300" />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className={sectionCardClass}>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Audit log</p>
              <h3 className="mt-2 text-xl font-semibold text-white">Privileged activity timeline</h3>
              <div className="mt-5 space-y-3">
                {seed.auditEvents.map((event) => (
                  <div key={event.id} className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-slate-100">{event.action}</p>
                      <p className="text-xs text-slate-500">{formatRelativeTime(event.timestamp)}</p>
                    </div>
                    <p className="mt-2 text-sm text-slate-400">{event.entity}</p>
                    <p className="mt-2 text-xs text-slate-500">{event.actor} • {event.role}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {rolesView === 'architecture' && (
        <div className="space-y-6">
          <div className="grid gap-6 2xl:grid-cols-[1.05fr_0.95fr]">
            <div className={sectionCardClass}>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Firestore schema suggestions</p>
              <h3 className="mt-2 text-xl font-semibold text-white">Recommended collections</h3>
              <div className="mt-5 space-y-3">
                {seed.firestoreCollections.map((collectionSpec) => (
                  <div key={collectionSpec.path} className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
                    <p className="font-medium text-slate-100">{collectionSpec.path}</p>
                    <p className="mt-2 text-sm text-slate-400">{collectionSpec.purpose}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {collectionSpec.keyFields.map((field) => (
                        <SectionBadge key={`${collectionSpec.path}-${field}`} label={field} className="admin-chip text-slate-300" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <div className={sectionCardClass}>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Composite indexes</p>
                <div className="mt-5 space-y-3">
                  {seed.indexRecommendations.map((recommendation) => (
                    <div key={`${recommendation.collection}-${recommendation.fields.join('-')}`} className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                      <p className="font-medium text-slate-100">{recommendation.collection}</p>
                      <p className="mt-2 text-sm text-slate-400">{recommendation.fields.join(' • ')}</p>
                      <p className="mt-2 text-xs text-slate-500">{recommendation.purpose}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className={sectionCardClass}>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Workflow logic</p>
                <div className="mt-5 space-y-3">
                  {seed.workflowStages.map((stage) => (
                    <div key={stage.label} className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                      <p className="font-medium text-slate-100">{stage.label}</p>
                      <p className="mt-2 text-sm text-slate-400">{stage.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <div className={sectionCardClass}>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Security rules considerations</p>
              <ul className="mt-5 space-y-3 text-sm text-slate-300">
                {seed.securityConsiderations.map((item) => (
                  <li key={item} className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className={sectionCardClass}>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Scalable folder structure</p>
              <div className="mt-5 overflow-hidden rounded-[24px] border border-white/8 bg-slate-950/60 p-4">
                <pre className="overflow-x-auto text-sm text-slate-300">
                  {seed.folderStructure.join('\n')}
                </pre>
              </div>
              <p className="mt-4 text-sm text-slate-400">
                Keep privileged writes behind backend services, and let the dashboard consume aggregate collections and audited operational records.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const getSectionContent = () => {
    if (!currentSectionAllowed) {
      return <LockedSection permission={currentSectionConfig.permission} onNavigate={navigateToSection} />;
    }

    if (currentSection === 'overview') return renderOverview();
    if (currentSection === 'songs') return renderSongs();
    if (currentSection === 'playlists') return renderPlaylists();
    if (currentSection === 'artists') return renderArtists();
    if (currentSection === 'discovery') return renderDiscovery();
    if (currentSection === 'moderation') return renderModeration();
    if (currentSection === 'users') return renderUsers();
    if (currentSection === 'analytics') return renderAnalytics();
    if (currentSection === 'flags') return renderFlags();
    if (currentSection === 'promotions') return renderPromotions();
    if (currentSection === 'notifications') return renderNotifications();
    return renderRoles();
  };

  return (
    <div className="admin-shell">
      <div className="relative z-10 flex min-h-screen">
        <aside className="admin-panel hidden w-[290px] shrink-0 flex-col border-r border-white/8 lg:flex">
          <div className="border-b border-white/8 p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-gradient-to-br from-cyan-400/20 to-emerald-300/15 text-cyan-100">
                <Disc3 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Mavrixfy</p>
                <h1 className="mt-1 text-xl font-semibold text-white">Admin Control</h1>
              </div>
            </div>
          </div>

          <div className="admin-scroll flex-1 overflow-y-auto px-4 py-5">
            {sectionGroups.map((entry) => (
              <div key={entry.group} className="mb-6">
                <p className="px-3 text-xs uppercase tracking-[0.22em] text-slate-500">{entry.group}</p>
                <div className="mt-3 space-y-2">
                  {entry.sections.map((section) => {
                    const Icon = sectionIcons[section.key];
                    const allowed = hasPermission(section.permission);
                    return (
                      <button
                        key={section.key}
                        type="button"
                        data-active={currentSection === section.key}
                        onClick={() => navigateToSection(section.key)}
                        className={cn(
                          'admin-nav-item flex w-full items-center gap-3 rounded-2xl border border-transparent p-3 text-left',
                          !allowed && 'opacity-55'
                        )}
                      >
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-2 text-slate-300">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-100">{section.label}</p>
                          <p className="truncate text-xs text-slate-500">{section.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="admin-panel sticky top-0 z-20 border-b border-white/8 p-4 md:px-6 xl:px-8">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => setCommandOpen(true)} className={quietButtonClass}>
                  <Command className="mr-2 inline h-4 w-4" />
                  Command palette
                </button>
                <button type="button" onClick={() => void refresh()} className={quietButtonClass}>
                  <RefreshCw className={cn('mr-2 inline h-4 w-4', isRefreshing && 'animate-spin')} />
                  Refresh
                </button>
                <SectionBadge
                  label={session.preview ? 'Preview mode' : isLive ? 'Hybrid live data' : 'Seeded snapshot'}
                  className="admin-chip text-slate-300"
                />
                {lastSyncedAt && (
                  <span className="text-xs text-slate-500">
                    Synced {formatRelativeTime(lastSyncedAt)}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-300">
                  <Globe className="mr-2 inline h-4 w-4 text-cyan-300" />
                  {session.role?.replace('_', ' ') ?? 'admin'}
                </div>
                <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-300">
                  {session.name}
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-slate-500">
                  <span>Mavrixfy internal tools</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                  <span>{currentSectionConfig.group}</span>
                </div>
                <h2 className="mt-2 text-3xl font-semibold text-white">{currentSectionConfig.label}</h2>
                <p className="mt-2 max-w-3xl text-sm text-slate-400">{currentSectionConfig.description}</p>
              </div>
              <div className="max-w-md flex-1 xl:max-w-sm">
                <button
                  type="button"
                  onClick={() => setCommandOpen(true)}
                  className="flex w-full items-center justify-between rounded-[24px] border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-sm text-slate-400 hover:border-cyan-300/25"
                >
                  <span className="inline-flex items-center gap-2">
                    <Search className="h-4 w-4" />
                    Jump to any module, queue, or architecture note
                  </span>
                  <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em]">
                    Ctrl K
                  </span>
                </button>
              </div>
            </div>

            <div className="admin-scroll mt-4 overflow-x-auto lg:hidden">
              <div className="flex gap-2 pb-1">
                {ADMIN_SECTIONS.map((section) => (
                  <button
                    key={`mobile-${section.key}`}
                    type="button"
                    onClick={() => navigateToSection(section.key)}
                    className={cn(
                      'whitespace-nowrap rounded-full border px-4 py-2 text-sm',
                      currentSection === section.key
                        ? 'border-cyan-300/30 bg-cyan-400/10 text-cyan-100'
                        : 'border-white/10 bg-white/[0.03] text-slate-300'
                    )}
                  >
                    {section.shortLabel}
                  </button>
                ))}
              </div>
            </div>
          </header>

          <main className="admin-scroll flex-1 overflow-y-auto px-4 pb-8 pt-6 md:px-6 xl:px-8">
            {getSectionContent()}
          </main>
        </div>
      </div>

      <AdminCommandPalette
        open={commandOpen}
        currentSection={currentSection}
        sections={ADMIN_SECTIONS.filter((section) => hasPermission(section.permission))}
        quickActions={quickActions}
        onClose={() => setCommandOpen(false)}
        onSelectSection={navigateToSection}
      />
    </div>
  );
};

export default AdminDashboardPage;
