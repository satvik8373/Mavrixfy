export type AdminRole = 'super_admin' | 'content_editor' | 'moderator' | 'analyst';

export type AdminSectionKey =
  | 'overview'
  | 'songs'
  | 'playlists'
  | 'artists'
  | 'discovery'
  | 'moderation'
  | 'users'
  | 'analytics'
  | 'flags'
  | 'promotions'
  | 'notifications'
  | 'roles';

export type AdminPermission =
  | 'overview.view'
  | 'catalog.manage'
  | 'playlists.manage'
  | 'artists.manage'
  | 'discovery.manage'
  | 'moderation.manage'
  | 'users.manage'
  | 'analytics.view'
  | 'flags.manage'
  | 'promotions.manage'
  | 'notifications.manage'
  | 'roles.manage'
  | 'platform.view';

export type ContentState = 'draft' | 'review' | 'published' | 'scheduled';
export type HealthState = 'healthy' | 'warning' | 'critical';
export type UserPlan = 'premium' | 'free';
export type PlatformTarget = 'web' | 'android' | 'ios';
export type ModerationStatus = 'new' | 'investigating' | 'escalated' | 'resolved';
export type NotificationStatus = 'draft' | 'scheduled' | 'sent';
export type AccessSource = 'document' | 'claims' | 'preview' | 'none';

export interface AdminSectionConfig {
  key: AdminSectionKey;
  label: string;
  shortLabel: string;
  group: string;
  description: string;
  permission: AdminPermission;
  keywords: string[];
}

export interface AdminSession {
  status: 'checking' | 'granted' | 'denied' | 'signed_out';
  role: AdminRole | null;
  permissions: AdminPermission[];
  source: AccessSource;
  preview: boolean;
  name: string;
  email: string;
  uid: string | null;
  denialReason?: string;
}

export interface MetricCardData {
  key: string;
  label: string;
  value: string;
  delta: string;
  detail: string;
  status: 'positive' | 'neutral' | 'warning';
}

export interface TrendPoint {
  label: string;
  primary: number;
  secondary?: number;
}

export interface SearchTrend {
  keyword: string;
  lift: string;
  searchCount: string;
  intent: string;
}

export interface HealthSignal {
  label: string;
  value: string;
  state: HealthState;
  detail: string;
}

export interface RecentContentItem {
  id: string;
  title: string;
  kind: 'song' | 'playlist' | 'artist' | 'banner';
  owner: string;
  state: ContentState;
  timestamp: string;
}

export interface SongRecord {
  id: string;
  title: string;
  artist: string;
  album: string;
  artwork?: string;
  genre: string;
  language: string;
  duration: string;
  popularityScore: number;
  releaseDate: string;
  explicit: boolean;
  approvalState: ContentState;
  regions: string[];
  broken: boolean;
  ingestionNote: string;
}

export interface ImportJob {
  id: string;
  label: string;
  source: string;
  progress: number;
  status: 'queued' | 'processing' | 'blocked' | 'completed';
}

export interface PlaylistRecord {
  id: string;
  name: string;
  curator: string;
  category: string;
  songCount: number;
  trendingScore: number;
  publishAt: string;
  homepageSlot: string;
  approvalState: ContentState;
  listeners: string;
}

export interface ArtistRecord {
  id: string;
  name: string;
  verified: boolean;
  monthlyListeners: string;
  releaseVelocity: string;
  topMarket: string;
  discographyCount: number;
}

export interface SearchWeight {
  id: string;
  label: string;
  value: number;
  hint: string;
}

export interface CuratedBoost {
  id: string;
  keyword: string;
  placement: string;
  boost: number;
  expiresAt: string;
}

export interface TypoMapping {
  id: string;
  typo: string;
  canonical: string;
  language: string;
}

export interface ModerationCase {
  id: string;
  entity: string;
  reason: string;
  reporterType: string;
  severity: 'low' | 'medium' | 'high';
  status: ModerationStatus;
  createdAt: string;
}

export interface FraudSignal {
  id: string;
  title: string;
  detail: string;
  score: string;
}

export interface UserRecord {
  id: string;
  name: string;
  plan: UserPlan;
  country: string;
  language: string;
  reports: number;
  lastActiveAt: string;
  status: 'healthy' | 'watch' | 'restricted';
}

export interface RankedMetric {
  id: string;
  label: string;
  value: string;
  percent: number;
  sublabel: string;
}

export interface GeoInsight {
  id: string;
  market: string;
  share: string;
  retention: string;
  dominantLanguage: string;
}

export interface RealtimeEvent {
  id: string;
  action: string;
  detail: string;
  timestamp: string;
}

export interface FeatureFlagRecord {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  rollout: number;
  targets: PlatformTarget[];
  owner: string;
}

export interface OtaTrack {
  id: string;
  name: string;
  channel: PlatformTarget;
  rollout: string;
  build: string;
  status: 'ready' | 'paused' | 'monitoring';
}

export interface BannerRecord {
  id: string;
  title: string;
  placement: string;
  status: ContentState;
  audience: string;
  startAt: string;
  endAt: string;
  accent: string;
}

export interface NotificationCampaign {
  id: string;
  title: string;
  segment: string;
  channel: 'push' | 'in-app';
  status: NotificationStatus;
  scheduledAt: string;
  uplift: string;
}

export interface RoleDefinition {
  role: AdminRole;
  label: string;
  description: string;
  permissions: AdminPermission[];
}

export interface AuditEvent {
  id: string;
  actor: string;
  role: AdminRole;
  action: string;
  entity: string;
  timestamp: string;
}

export interface InternalNote {
  id: string;
  author: string;
  scope: string;
  body: string;
  createdAt: string;
}

export interface FirestoreCollectionSpec {
  path: string;
  purpose: string;
  keyFields: string[];
}

export interface IndexRecommendation {
  collection: string;
  fields: string[];
  purpose: string;
}

export interface WorkflowStage {
  label: string;
  detail: string;
}

export interface AdminSeedData {
  overviewMetrics: MetricCardData[];
  growthSeries: TrendPoint[];
  engagementSeries: TrendPoint[];
  searchTrends: SearchTrend[];
  healthSignals: HealthSignal[];
  recentContent: RecentContentItem[];
  songs: SongRecord[];
  importJobs: ImportJob[];
  playlists: PlaylistRecord[];
  artists: ArtistRecord[];
  searchWeights: SearchWeight[];
  curatedBoosts: CuratedBoost[];
  typoMappings: TypoMapping[];
  searchTokens: string[];
  moderationCases: ModerationCase[];
  fraudSignals: FraudSignal[];
  users: UserRecord[];
  topSongs: RankedMetric[];
  topPlaylists: RankedMetric[];
  geoInsights: GeoInsight[];
  realtimeEvents: RealtimeEvent[];
  featureFlags: FeatureFlagRecord[];
  otaTracks: OtaTrack[];
  banners: BannerRecord[];
  notifications: NotificationCampaign[];
  roleDefinitions: RoleDefinition[];
  auditEvents: AuditEvent[];
  notes: InternalNote[];
  firestoreCollections: FirestoreCollectionSpec[];
  indexRecommendations: IndexRecommendation[];
  securityConsiderations: string[];
  folderStructure: string[];
  workflowStages: WorkflowStage[];
}
