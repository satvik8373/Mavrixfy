import { useMemo, useReducer, useRef, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Disc3, FileText, Loader2, Music4, RefreshCcw, Sparkles, Upload } from 'lucide-react';
import toast from 'react-hot-toast';

import axiosInstance from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useLikedSongsStore } from '@/stores/useLikedSongsStore';
import { addMultipleLikedSongs, type BulkLikedSongIssue } from '@/services/likedSongsService';
import type { Song } from '@/types';

type DetectedSong = {
  title: string;
  artist: string;
  album?: string;
  addedAt?: string;
};

type FailedSong = {
  title: string;
  artist: string;
  album?: string;
  addedAt?: string;
  reason?: string;
};

type SkippedSong = BulkLikedSongIssue;

type ImportedSong = {
  title: string;
  artist: string;
  album?: string;
  addedAt?: string;
  likedAt?: string;
  image?: string;
  audioUrl: string;
  duration?: number;
  saavnId?: string;
};

type ImportReport = {
  total: number;
  success: number;
  failed: number;
  partial: boolean;
  importedSongs: ImportedSong[];
  failedSongs: FailedSong[];
  stats?: {
    requested?: number;
    uniqueProcessed?: number;
    matched?: number;
    inputDuplicatesRemoved?: number;
    durationMs?: number;
    cacheHits?: number;
    persisted?: number;
    skipped?: number;
    alreadyAdded?: number;
    duplicateMatchesSkipped?: number;
    dedupedWrites?: number;
    storageError?: string;
    failureReasons?: Record<string, number>;
    clientSaveErrors?: number;
    skippedSongs?: SkippedSong[];
  };
};

const cleanCellValue = (value: unknown): string => String(value ?? '').trim();

const parseCsvLine = (line: string): string[] => {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current);
  return values.map(cleanCellValue);
};

const findHeaderIndex = (headers: string[], aliases: string[]) =>
  aliases.reduce((found, alias) => {
    if (found !== -1) return found;
    return headers.indexOf(alias);
  }, -1);

const parseCsvSongs = (content: string): DetectedSong[] => {
  const lines = content
    .split(/\r?\n/)
    .flatMap((line) => {
      const trimmed = line.trim();
      return trimmed ? [trimmed] : [];
    });

  if (!lines.length) return [];

  const header = parseCsvLine(lines[0]).map((value) => value.toLowerCase());
  const titleIndex = findHeaderIndex(header, [
    'title',
    'track',
    'track name',
    'trackname',
    'track title',
    'song title',
    'song',
    'name',
  ]);
  const artistIndex = findHeaderIndex(header, [
    'artist',
    'artists',
    'artist names',
    'artist(s)',
    'artist name',
    'artist_name(s)',
    'artist name(s)',
    'singer',
  ]);
  const albumIndex = findHeaderIndex(header, ['album', 'album name', 'albumname', 'album title']);
  const addedAtIndex = findHeaderIndex(header, [
    'added at',
    'addedat',
    'added_at',
    'date added',
    'liked at',
    'saved at',
    'created at',
    'added on',
    'added_on',
    'timestamp',
  ]);

  const hasHeader = titleIndex !== -1 || artistIndex !== -1;
  const startIndex = hasHeader ? 1 : 0;

  const songs: DetectedSong[] = [];
  for (let i = startIndex; i < lines.length; i += 1) {
    const row = parseCsvLine(lines[i]);
    const title = titleIndex >= 0 ? row[titleIndex] : row[0] ?? '';
    const artist = artistIndex >= 0 ? row[artistIndex] : row[1] ?? '';
    const album = albumIndex >= 0 ? row[albumIndex] : row[2] ?? '';
    const addedAt = addedAtIndex >= 0 ? row[addedAtIndex] : '';

    songs.push({
      title: cleanCellValue(title),
      artist: cleanCellValue(artist),
      album: cleanCellValue(album),
      addedAt: cleanCellValue(addedAt),
    });
  }

  return songs;
};

const parseTxtSongs = (content: string): DetectedSong[] => {
  const lines = content
    .split(/\r?\n/)
    .flatMap((line) => {
      const trimmed = line.trim();
      return trimmed ? [trimmed] : [];
    });

  return lines.map((line) => {
    const dashSplit = line.match(/^(.*?)\s*-\s*(.+)$/);
    if (dashSplit) {
      return {
        title: cleanCellValue(dashSplit[1]),
        artist: cleanCellValue(dashSplit[2]),
        addedAt: '',
      };
    }

    return {
      title: cleanCellValue(line),
      artist: 'Unknown artist',
      addedAt: '',
    };
  });
};

const toSortableDate = (value?: string): number => {
  if (!value) return 0;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const parseDetectedSongs = (fileName: string, content: string): DetectedSong[] => {
  const lower = fileName.toLowerCase();
  const parsed = lower.endsWith('.csv') ? parseCsvSongs(content) : parseTxtSongs(content);

  const deduped = new Map<string, DetectedSong>();
  for (const song of parsed) {
    if (!song.title || !song.artist) continue;
    const key = `${song.title.toLowerCase()}|${song.artist.toLowerCase()}`;
    if (!deduped.has(key)) deduped.set(key, song);
  }

  return Array.from(deduped.values()).sort(
    (left, right) => toSortableDate(right.addedAt) - toSortableDate(left.addedAt)
  );
};

const normalizeReason = (reason?: string) => {
  if (!reason) return 'Unknown error';

  switch (reason) {
    case 'no_results':
      return 'No search results';
    case 'no_match':
      return 'Could not find exact match';
    case 'artist_mismatch':
      return 'Title found but artist did not match exactly';
    case 'audio_invalid':
      return 'Audio URL invalid';
    case 'search_error':
      return 'Search API failed';
    case 'incomplete_result':
      return 'Incomplete song data';
    case 'storage_failed':
      return 'Save failed';
    case 'already_added':
      return 'Already in liked songs';
    case 'duplicate_in_import':
      return 'Duplicate in current import';
    case 'invalid_song':
      return 'Missing title, artist, or ID';
    default:
      return reason.replace(/_/g, ' ');
  }
};

const buildImportToastMessage = (importReport: ImportReport) => {
  const matched = importReport.stats?.matched ?? importReport.importedSongs?.length ?? 0;
  const added = importReport.stats?.persisted ?? importReport.success ?? 0;
  const skipped = importReport.stats?.skipped ?? 0;
  const failed = importReport.failed ?? 0;

  const summaryParts = [`Matched ${matched}`, `added ${added}`];
  if (skipped > 0) summaryParts.push(`skipped ${skipped}`);
  if (failed > 0) summaryParts.push(`failed ${failed}`);

  return summaryParts.join(', ');
};

const toStableHash = (value: string): string => {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return Math.abs(hash).toString(36);
};

const DETECTED_SONG_ART_GRADIENTS = [
  'from-emerald-400/90 via-teal-500/80 to-cyan-500/80',
  'from-orange-400/90 via-amber-500/80 to-rose-500/80',
  'from-sky-500/90 via-indigo-500/80 to-violet-500/80',
  'from-lime-400/90 via-emerald-500/80 to-green-500/80',
  'from-pink-500/90 via-fuchsia-500/80 to-indigo-500/80',
  'from-cyan-500/90 via-blue-500/80 to-slate-700/80',
];

const getDeterministicIndex = (value: string, modulo: number) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }

  return Math.abs(hash) % modulo;
};

const getSongInitials = (song: DetectedSong): string => {
  const source = song.title || song.artist || '';
  const parts = source
    .split(/\s+/)
    .flatMap((part) => {
      const trimmed = part.trim();
      return trimmed ? [trimmed] : [];
    });

  if (!parts.length) return 'S';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
};

const getDetectedSongArtGradient = (song: DetectedSong): string => {
  const seed = `${song.title}|${song.artist}|${song.album || ''}`.toLowerCase();
  const index = getDeterministicIndex(seed, DETECTED_SONG_ART_GRADIENTS.length);
  return DETECTED_SONG_ART_GRADIENTS[index];
};

const formatAddedAtPreview = (value?: string): string => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
};

const resolveImportedLikedAt = (song: ImportedSong): string => {
  const nowIso = new Date().toISOString();
  const candidates = [song.addedAt, song.likedAt];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const parsedDate = new Date(candidate);
    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate.toISOString();
    }
  }

  return nowIso;
};

const mapImportedToDetected = (songs: ImportedSong[]): DetectedSong[] =>
  songs.map((song) => ({
    title: song.title,
    artist: song.artist,
    album: song.album,
    addedAt: song.addedAt || song.likedAt,
  }));

const toSongEntity = (song: ImportedSong, index: number): Song => {
  const likedAtIso = resolveImportedLikedAt(song);
  const now = new Date().toISOString();
  const docId = song.saavnId
    ? `saavn_${song.saavnId}`
    : `saavn_${toStableHash(`${song.title}|${song.artist}|${song.audioUrl}|${index}`)}`;

  return {
    _id: docId,
    title: song.title,
    artist: song.artist,
    album: song.album || null,
    albumId: song.album || null,
    imageUrl: song.image || '',
    audioUrl: song.audioUrl,
    duration: Number(song.duration) || 0,
    createdAt: likedAtIso,
    updatedAt: now,
    likedAt: likedAtIso,
  };
};

interface ImportPageState {
  selectedFile: File | null;
  detectedSongs: DetectedSong[];
  parsingFile: boolean;
  previewing: boolean;
  previewProgress: number;
  previewReport: ImportReport | null;
  importing: boolean;
  retrying: boolean;
  importProgress: number;
  report: ImportReport | null;
}

type ImportPageAction = Partial<ImportPageState> | ((state: ImportPageState) => ImportPageState);

const importPageReducer = (state: ImportPageState, action: ImportPageAction): ImportPageState => {
  if (typeof action === 'function') {
    return action(state);
  }
  return { ...state, ...action };
};


interface DetectedSongsListProps {
  parsingFile: boolean;
  previewing: boolean;
  detectedSongs: DetectedSong[];
  detectedPreviewSongs: DetectedSong[];
  detectedImageMap: Map<string, string>;
  previewReport: ImportReport | null;
}

const DetectedSongsList = ({
  parsingFile,
  previewing,
  detectedSongs,
  detectedPreviewSongs,
  detectedImageMap,
  previewReport,
}: DetectedSongsListProps) => {
  if (parsingFile || previewing) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={`placeholder-${index}`} className="flex items-center gap-3 rounded-xl border border-border/60 p-3 animate-pulse">
            <div className="h-12 w-12 rounded-lg bg-muted/50" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-2/3 bg-muted/50 rounded" />
              <div className="h-2.5 w-1/2 bg-muted/40 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (detectedSongs.length > 0) {
    return (
      <>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-muted-foreground">
            Showing {detectedPreviewSongs.length} of {detectedSongs.length} matched songs
          </p>
        </div>

        <div className="max-h-[58vh] overflow-y-auto space-y-2 pr-1">
          {detectedPreviewSongs.map((song, index) => {
            const matchKey = `${song.title}|${song.artist}`.toLowerCase().trim();
            const detectedImage = detectedImageMap.get(matchKey);
            const itemKey = `detected-${toStableHash(`${song.title}|${song.artist}|${index}`)}`;
            return (
              <div
                key={itemKey}
                className="group rounded-xl border border-border/70 bg-card/50 p-3 md:p-3.5 transition-colors hover:border-emerald-500/40 hover:bg-card/70"
              >
                <div className="flex items-center gap-3">
                  {detectedImage ? (
                    <img
                      src={detectedImage}
                      alt={song.title}
                      className="h-12 w-12 shrink-0 rounded-lg object-cover shadow-md"
                      loading="lazy"
                    />
                  ) : (
                    <div className={`h-12 w-12 shrink-0 rounded-lg bg-gradient-to-br ${getDetectedSongArtGradient(song)} flex items-center justify-center shadow-md`}>
                      <span className="text-sm font-semibold text-white tracking-wide">
                        {getSongInitials(song)}
                      </span>
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm md:text-[15px] truncate">{song.title}</p>
                    <p className="text-xs md:text-sm text-muted-foreground truncate">{song.artist}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                      {song.album ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/40 px-2 py-0.5 text-muted-foreground">
                          <Disc3 className="h-3 w-3" />
                          {song.album}
                        </span>
                      ) : null}
                      {song.addedAt ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/40 px-2 py-0.5 text-muted-foreground">
                          <CalendarDays className="h-3 w-3" />
                          {formatAddedAtPreview(song.addedAt)}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <p className="hidden sm:block text-xs text-muted-foreground w-8 text-right">
                    #{index + 1}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </>
    );
  }

  if (previewReport) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
        No matches found yet. Try the `Deep Recheck` option or update your CSV titles/artists.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
      Choose a CSV/TXT file to start song detection.
    </div>
  );
};

interface ImportReportViewProps {
  report: ImportReport | null;
  hasFailures: boolean;
  hasSkips: boolean;
}

const ImportReportView = ({
  report,
  hasFailures,
  hasSkips,
}: ImportReportViewProps) => {
  if (!report) return null;

  return (
    <div className="max-w-5xl mt-6 rounded-xl border border-border bg-card/40 p-5 md:p-6 space-y-4">
      <h2 className="text-lg font-semibold">Import Report</h2>
      <p className="text-sm text-muted-foreground">
        Matched {report.stats?.matched ?? report.importedSongs.length} playable songs, added{' '}
        {report.stats?.persisted ?? report.success}, skipped {report.stats?.skipped ?? 0}, failed{' '}
        {report.failed}.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 text-sm">
        <div className="rounded-lg border border-border p-3">
          <p className="text-muted-foreground">Unique</p>
          <p className="text-xl font-semibold">{report.total}</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-muted-foreground">Matched</p>
          <p className="text-xl font-semibold">{report.stats?.matched ?? report.importedSongs.length}</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-muted-foreground">Added</p>
          <p className="text-xl font-semibold text-green-500">{report.stats?.persisted ?? report.success}</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-muted-foreground">Skipped</p>
          <p className="text-xl font-semibold text-amber-500">{report.stats?.skipped ?? 0}</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-muted-foreground">Failed</p>
          <p className="text-xl font-semibold text-red-500">{report.failed}</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-muted-foreground">Duration</p>
          <p className="text-xl font-semibold">
            {Math.round((report.stats?.durationMs || 0) / 1000)}s
          </p>
        </div>
      </div>

      {(report.stats?.alreadyAdded || report.stats?.inputDuplicatesRemoved || report.stats?.duplicateMatchesSkipped) ? (
        <div className="rounded-lg border border-border p-3 text-sm text-muted-foreground space-y-1">
          {report.stats?.alreadyAdded ? (
            <p>Already added and skipped: {report.stats.alreadyAdded}</p>
          ) : null}
          {report.stats?.inputDuplicatesRemoved ? (
            <p>Duplicate rows removed before search: {report.stats.inputDuplicatesRemoved}</p>
          ) : null}
          {report.stats?.duplicateMatchesSkipped ? (
            <p>Duplicate matches skipped during save: {report.stats.duplicateMatchesSkipped}</p>
          ) : null}
        </div>
      ) : null}

      {hasSkips && (
        <div className="space-y-2">
          <h3 className="font-medium">Skipped Songs</h3>
          <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
            {report.stats?.skippedSongs?.slice(0, 100).map((song, index) => {
              const itemKey = `skipped-${toStableHash(`${song.title || ''}|${song.artist || ''}|${song.reason || ''}|${index}`)}`;
              return (
                <div
                  key={itemKey}
                  className="rounded-md border border-border p-3 text-sm"
                >
                  <p className="font-medium">{song.title || 'Unknown title'}</p>
                  <p className="text-muted-foreground">{song.artist || 'Unknown artist'}</p>
                  <p className="text-xs text-amber-400 mt-1">{normalizeReason(song.reason)}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {hasFailures && (
        <div className="space-y-2">
          <h3 className="font-medium">Failed Songs</h3>
          <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
            {report.failedSongs.slice(0, 100).map((song, index) => {
              const itemKey = `failed-${toStableHash(`${song.title || ''}|${song.artist || ''}|${index}`)}`;
              return (
                <div
                  key={itemKey}
                  className="rounded-md border border-border p-3 text-sm"
                >
                  <p className="font-medium">{song.title || 'Unknown title'}</p>
                  <p className="text-muted-foreground">{song.artist || 'Unknown artist'}</p>
                  {song.addedAt ? (
                    <p className="text-xs text-muted-foreground/80 mt-1">Added at: {song.addedAt}</p>
                  ) : null}
                  <p className="text-xs text-red-400 mt-1">{normalizeReason(song.reason)}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const LikedSongsImportPage = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [{
    selectedFile,
    detectedSongs,
    parsingFile,
    previewing,
    previewProgress,
    previewReport,
    importing,
    retrying,
    importProgress,
    report,
  }, dispatchImport] = useReducer(importPageReducer, {
    selectedFile: null,
    detectedSongs: [],
    parsingFile: false,
    previewing: false,
    previewProgress: 0,
    previewReport: null,
    importing: false,
    retrying: false,
    importProgress: 0,
    report: null,
  });

  const { loadLikedSongs } = useLikedSongsStore();

  const hasFailures = useMemo(
    () => Boolean(report?.failedSongs?.length),
    [report]
  );
  const hasSkips = useMemo(
    () => Boolean(report?.stats?.skippedSongs?.length),
    [report]
  );
  const hasDetectedView =
    parsingFile || previewing || Boolean(selectedFile) || detectedSongs.length > 0;
  const showUploadLanding = !hasDetectedView;
  const detectedPreviewSongs = useMemo(() => detectedSongs.slice(0, 300), [detectedSongs]);
  const detectedImageMap = useMemo(() => {
    const source = previewReport?.importedSongs?.length
      ? previewReport.importedSongs
      : report?.importedSongs || [];
    if (!source.length) return new Map<string, string>();
    const map = new Map<string, string>();
    source.forEach((song) => {
      const key = `${song.title || ''}|${song.artist || ''}`.toLowerCase().trim();
      if (!key) return;
      if (song.image) {
        map.set(key, song.image);
      }
    });
    return map;
  }, [previewReport, report]);

  const importStage = useMemo(() => {
    if (!importing) return '';
    if (importProgress < 99) return 'Uploading file...';
    return 'Matching and saving songs...';
  }, [importing, importProgress]);

  const persistImportedSongsClientSide = async (
    importReport: ImportReport
  ): Promise<ImportReport> => {
    const importedSongs = Array.isArray(importReport.importedSongs)
      ? importReport.importedSongs
      : [];
    if (!importedSongs.length) {
      return {
        ...importReport,
        stats: {
          ...importReport.stats,
          matched: importReport.stats?.matched ?? 0,
          skipped: 0,
          alreadyAdded: 0,
          duplicateMatchesSkipped: 0,
          skippedSongs: [],
        },
      };
    }

    const songsToSave = importedSongs.map((song, index) => toSongEntity(song, index));
    const saveResult = await addMultipleLikedSongs(songsToSave, 'saavn');
    const mergedFailedSongs = [
      ...(importReport.failedSongs || []),
      ...saveResult.errorSongs.map((song) => ({
        title: song.title,
        artist: song.artist,
        album: song.album || '',
        addedAt: song.addedAt || '',
        reason: song.reason,
      })),
    ];
    const mergedFailed = mergedFailedSongs.length;
    const matched = importReport.stats?.matched ?? importedSongs.length;
    const skipped = saveResult.skipped;
    const added = saveResult.added;

    return {
      ...importReport,
      success: added,
      failed: mergedFailed,
      partial: added > 0 && (mergedFailed > 0 || skipped > 0),
      failedSongs: mergedFailedSongs,
      stats: {
        ...importReport.stats,
        matched,
        persisted: added,
        skipped,
        alreadyAdded: saveResult.alreadyAdded,
        duplicateMatchesSkipped: saveResult.duplicateInImport,
        dedupedWrites: skipped,
        clientSaveErrors: saveResult.errors,
        skippedSongs: saveResult.skippedSongs,
      },
    };
  };

  const openPicker = () => {
    if (importing || retrying || parsingFile || previewing) return;
    fileInputRef.current?.click();
  };

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;

    if (!file) return;

    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.csv') && !lower.endsWith('.txt')) {
      toast.error('Only CSV and TXT files are supported');
      event.target.value = '';
      return;
    }

    dispatchImport({
      parsingFile: true,
      previewing: false,
      previewProgress: 0,
      selectedFile: file,
      report: null,
      previewReport: null,
      detectedSongs: [],
    });

    try {
      const fileContent = await file.text();
      const parsedSongs = parseDetectedSongs(file.name, fileContent);

      if (!parsedSongs.length) {
        toast.error('No valid songs detected in file');
        return;
      }

      dispatchImport({ previewing: true, previewProgress: 1 });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('persist', 'false');
      formData.append('deepSearch', 'true');

      const response = await axiosInstance.post('/liked-songs/import', formData, {
        timeout: 10 * 60 * 1000,
        onUploadProgress: (uploadEvent) => {
          if (!uploadEvent.total) return;
          const uploadProgress = Math.round((uploadEvent.loaded / uploadEvent.total) * 100);
          dispatchImport({ previewProgress: Math.max(1, Math.min(99, uploadProgress)) });
        },
      });

      const previewData = response.data?.data as ImportReport;
      dispatchImport({
        previewReport: previewData,
        detectedSongs: mapImportedToDetected(previewData?.importedSongs || []),
        previewProgress: 100,
      });
      toast.success(`Matched ${previewData?.importedSongs?.length || 0} songs`);
    } catch {
      dispatchImport({ selectedFile: null, detectedSongs: [] });
      toast.error('Failed to match songs from file');
    } finally {
      dispatchImport({ parsingFile: false, previewing: false });
      event.target.value = '';
    }
  };

  const importSelectedFile = async () => {
    if (!selectedFile) {
      toast.error('Select a CSV/TXT file first');
      return;
    }

    dispatchImport({ importing: true, importProgress: 1 });
    const loadingId = toast.loading(`Importing ${selectedFile.name}...`);

    try {
      let persistedReport: ImportReport;

      if (previewReport?.importedSongs?.length) {
        dispatchImport({ importProgress: 99 });
        persistedReport = await persistImportedSongsClientSide(previewReport);
      } else {
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('persist', 'false');
        formData.append('deepSearch', 'true');

        const response = await axiosInstance.post('/liked-songs/import', formData, {
          timeout: 10 * 60 * 1000,
          onUploadProgress: (event) => {
            if (!event.total) return;
            const uploadProgress = Math.round((event.loaded / event.total) * 100);
            dispatchImport({ importProgress: Math.max(1, Math.min(99, uploadProgress)) });
          },
        });

        const importReport = response.data?.data as ImportReport;
        persistedReport = await persistImportedSongsClientSide(importReport);
      }

      dispatchImport({ report: persistedReport });
      await loadLikedSongs();
      dispatchImport({ importProgress: 100 });

      toast.success(
        buildImportToastMessage(persistedReport),
        { id: loadingId }
      );
    } catch (error: any) {
      const message =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        'Import failed';
      toast.error(message, { id: loadingId });
    } finally {
      dispatchImport({ importing: false });
      window.setTimeout(() => dispatchImport({ importProgress: 0 }), 500);
    }
  };

  const retryFailedSongs = async () => {
    if (!report?.failedSongs?.length) {
      toast.error('No failed songs to retry');
      return;
    }

    dispatchImport({ retrying: true });
    const loadingId = toast.loading('Retrying failed songs...');

    try {
      const response = await axiosInstance.post('/liked-songs/import/retry', {
        failedSongs: report.failedSongs,
        persist: false,
      }, {
        timeout: 10 * 60 * 1000,
      });

      const retryReport = response.data?.data as ImportReport;
      const persistedRetryReport = await persistImportedSongsClientSide(retryReport);
      dispatchImport({ report: persistedRetryReport });
      await loadLikedSongs();

      toast.success(
        buildImportToastMessage(persistedRetryReport),
        { id: loadingId }
      );
    } catch (error: any) {
      const message =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        'Retry failed';
      toast.error(message, { id: loadingId });
    } finally {
      dispatchImport({ retrying: false });
    }
  };

  const retryFailedSongsEnhanced = async () => {
    if (!report?.failedSongs?.length) {
      toast.error('No failed songs to recheck');
      return;
    }

    dispatchImport({ retrying: true });
    const loadingId = toast.loading('Rechecking failed songs with deep match...');

    try {
      const response = await axiosInstance.post('/liked-songs/import/retry', {
        failedSongs: report.failedSongs,
        persist: false,
        deepSearch: true,
        relaxedMatch: true,
      }, {
        timeout: 10 * 60 * 1000,
      });

      const retryReport = response.data?.data as ImportReport;
      const persistedRetryReport = await persistImportedSongsClientSide(retryReport);
      dispatchImport({ report: persistedRetryReport });
      await loadLikedSongs();

      toast.success(
        buildImportToastMessage(persistedRetryReport),
        { id: loadingId }
      );
    } catch (error: any) {
      const message =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        'Recheck failed';
      toast.error(message, { id: loadingId });
    } finally {
      dispatchImport({ retrying: false });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-24 md:pb-8">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.txt,text/csv,text/plain"
        className="hidden"
        onChange={onFileChange}
      />

      <div className="px-4 md:px-8 pt-6 md:pt-8">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/liked-songs')}
            className="h-10 w-10 rounded-full"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold">Liked Songs Import Tool</h1>
            <p className="text-sm text-muted-foreground">
              Upload CSV/TXT and import matched playable songs.
            </p>
          </div>
        </div>

        {showUploadLanding && (
          <>
            <div className="max-w-4xl rounded-2xl border border-border/70 bg-card/40 p-6 md:p-8">
              <div className="rounded-2xl border border-dashed border-border/70 bg-gradient-to-br from-emerald-500/10 via-sky-500/5 to-transparent p-6 md:p-8">
                <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-2">
                    <p className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
                      <Sparkles className="h-3.5 w-3.5" />
                      Smart CSV Import
                    </p>
                    <h2 className="text-xl md:text-2xl font-semibold">Upload Your Liked Songs File</h2>
                    <p className="text-sm text-muted-foreground max-w-xl">
                      Supports `.csv` and `.txt`. We use title + artist matching with duplicate protection and date-preserving import.
                    </p>
                  </div>
                  <Button onClick={openPicker} size="lg" className="h-11 px-5 w-full md:w-auto" disabled={parsingFile}>
                    {parsingFile ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <FileText className="h-4 w-4 mr-2" />
                    )}
                    {parsingFile ? 'Reading File...' : 'Choose CSV/TXT'}
                  </Button>
                </div>
              </div>
            </div>

            <div className="max-w-4xl mt-6 rounded-2xl border border-border/70 bg-card/35 p-5 md:p-6 space-y-3 text-sm">
              <h2 className="text-lg font-semibold">CSV Format Reference</h2>
              <p className="text-muted-foreground">
                For best matching ratio, include clean track and artist names. If `Added At` is present, we keep the original date.
              </p>
              <p className="text-muted-foreground">
                Required fields: `Track Name` or `Title`, and `Artist Name(s)` or `Artist`.
              </p>
              <p className="text-muted-foreground">
                Optional fields: `Album Name` or `Album`, `Added At` or `Date Added`, `ISRC`.
              </p>
            </div>
          </>
        )}

        {hasDetectedView && (
          <div className="max-w-5xl rounded-2xl border border-border/70 bg-card/35 p-4 md:p-6 mt-2">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2">
                <p className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-300">
                  <Music4 className="h-3.5 w-3.5" />
                  Song Detection
                </p>
                <h2 className="text-xl md:text-2xl font-semibold">Matched Songs Workspace</h2>
                <p className="text-sm text-muted-foreground">
                  {previewing
                    ? 'Matching songs with JioSaavn...'
                    : parsingFile
                    ? 'Reading your file...'
                    : selectedFile
                    ? `File: ${selectedFile.name}`
                    : 'No file selected'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 md:gap-3">
                <Button onClick={openPicker} variant="outline" disabled={importing || retrying || parsingFile || previewing}>
                  <FileText className="h-4 w-4 mr-2" />
                  Change File
                </Button>
                <Button
                  onClick={importSelectedFile}
                  disabled={!selectedFile || importing || retrying || parsingFile || previewing}
                >
                  {importing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  {importing ? 'Importing...' : 'Start Import'}
                </Button>
                {hasFailures && (
                  <>
                    <Button onClick={retryFailedSongs} variant="secondary" disabled={retrying || importing}>
                      {retrying ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCcw className="h-4 w-4 mr-2" />
                      )}
                      {retrying ? 'Retrying...' : 'Retry Failed'}
                    </Button>
                    <Button onClick={retryFailedSongsEnhanced} variant="outline" disabled={retrying || importing}>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Deep Recheck
                    </Button>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
              <div className="rounded-xl border border-border/70 bg-background/40 p-3">
                <p className="text-xs text-muted-foreground">Matched Songs</p>
                <p className="text-xl font-semibold">
                  {previewReport?.importedSongs?.length ?? detectedSongs.length}
                </p>
              </div>
              <div className="rounded-xl border border-border/70 bg-background/40 p-3">
                <p className="text-xs text-muted-foreground">File Type</p>
                <p className="text-xl font-semibold uppercase">
                  {selectedFile ? selectedFile.name.split('.').pop() || 'CSV' : 'CSV'}
                </p>
              </div>
              <div className="rounded-xl border border-border/70 bg-background/40 p-3">
                <p className="text-xs text-muted-foreground">Date Order</p>
                <p className="text-xl font-semibold">Newest First</p>
              </div>
            </div>

            {(parsingFile || previewing || importing) && (
              <div className="space-y-2 mt-5">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {importing
                      ? importStage
                      : previewing
                      ? 'Matching songs with JioSaavn...'
                      : 'Reading file...'}
                  </span>
                  <span>{previewing ? previewProgress : importProgress}%</span>
                </div>
                <Progress value={previewing ? previewProgress : importProgress} className="h-2 bg-muted/40" />
              </div>
            )}

            <div className="mt-5 rounded-2xl border border-border/70 bg-background/30 p-3 md:p-4">
              <DetectedSongsList
                parsingFile={parsingFile}
                previewing={previewing}
                detectedSongs={detectedSongs}
                detectedPreviewSongs={detectedPreviewSongs}
                detectedImageMap={detectedImageMap}
                previewReport={previewReport}
              />
            </div>
          </div>
        )}

        <ImportReportView
          report={report}
          hasFailures={hasFailures}
          hasSkips={hasSkips}
        />
      </div>
    </div>
  );
};

export default LikedSongsImportPage;
