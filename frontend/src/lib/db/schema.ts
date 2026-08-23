export type MediaType = 'film' | 'tv' | 'game' | 'anime' | 'manga' | 'manhwa' | 'manhua' | 'comic' | 'book';
export type MediaSource = 'tmdb' | 'rawg' | 'steam' | 'igdb' | 'anilist' | 'comicvine' | 'openlibrary' | 'manual';
export type TrackingStatusType = 'planned' | 'in_progress' | 'completed' | 'dropped' | 'paused';
export type CompletionTier = 'main_story' | 'main_plus_sides' | 'completionist';

export type ActivityEventType =
  | 'status_changed'
  | 'episode_watched'
  | 'chapter_read'
  | 'issue_read'
  | 'pages_updated'
  | 'hours_updated'
  | 'score_set'
  | 'score_changed'
  | 'note_updated'
  | 'rewatch_started'
  | 'rewatch_completed'
  | 'added_to_collection'
  | 'removed_from_collection'
  | 'mal_import'
  | 'anilist_import'
  | 'tmdb_import';

export interface Media {
  id: string; // UUID
  source: MediaSource;
  externalId: string;
  type: MediaType;
  title: string;
  year?: number;
  posterUrl?: string;
  description?: string;
  totalEpisodes?: number; // TV/Anime specific
  totalSeasons?: number; // TV/Anime specific
  platforms?: string; // JSON array (Game specific)
  totalPages?: number; // Book specific
}

export interface TrackingStatus {
  id: string; // UUID
  mediaId: string;
  status: TrackingStatusType;
  score?: number; // 1-10
  note?: string;
  currentEpisode?: number;
  currentSeason?: number;
  currentChapter?: number;
  currentVolume?: number;
  currentPage?: number;
  currentIssue?: number;
  hoursPlayed?: number;
  completionTier?: CompletionTier;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

export interface WatchCycle {
  id: string; // UUID
  mediaId: string;
  cycleNumber: number; // 1 = first watch, 2 = rewatch #1...
  startedAt?: string; // ISO date
  finishedAt?: string; // ISO date
}

export interface Collection {
  id: string; // UUID
  name: string;
  description?: string;
  createdAt: string; // ISO string
}

export interface CollectionItem {
  id: string; // UUID
  collectionId: string;
  mediaId: string;
  sortOrder: number;
  addedAt: string; // ISO string
}

export interface ActivityLog {
  id: string; // UUID
  mediaId: string;
  mediaTitle: string;
  mediaPosterUrl?: string;
  mediaType: MediaType;
  eventType: ActivityEventType;
  payload: string; // JSON string
  occurredAt: string; // ISO string
}

export interface Goal {
  id: string; // UUID
  mediaType: MediaType | 'any';
  targetCount: number;
  year: number;
  createdAt: string; // ISO string
}

export interface ApiCache {
  cacheKey: string;
  data: string; // JSON string
  cachedAt: string; // ISO string
}

export interface AppSettings {
  key: string;
  value: string;
}
