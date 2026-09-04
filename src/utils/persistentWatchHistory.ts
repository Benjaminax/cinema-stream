import { TMDBResult } from '../types/media';
import { getRecommendations, getTrending, normalizeTMDBResult } from '../api/tmdb';

export interface PersistentMediaItem {
  id: string | number;
  tmdb_id?: number;
  title: string;
  media_type: 'movie' | 'tv';
  genre_ids?: number[];
  genres?: string[];
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
  watched_at: number;
  watch_count: number;
  is_local?: boolean;
}

const STORAGE_KEY = 'theora_persistent_watch_history';
const MAX_HISTORY_ITEMS = 100;

export const getPersistentWatchHistory = (): PersistentMediaItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.sort((a, b) => (b.watched_at || 0) - (a.watched_at || 0));
    }
    return [];
  } catch (err) {
    console.error('Error reading persistent watch history:', err);
    return [];
  }
};

export const recordMediaInteraction = (
  item: any,
  defaultType: 'movie' | 'tv' = 'movie',
  isLocal: boolean = false
) => {
  if (!item) return;

  try {
    const history = getPersistentWatchHistory();
    const title = item.title || item.name || item.original_title || item.original_name || '';
    if (!title) return;

    const rawId = item.id || item.tmdb_id || title;
    const mediaType: 'movie' | 'tv' =
      item.media_type === 'tv' || item.first_air_date || defaultType === 'tv'
        ? 'tv'
        : 'movie';

    const tmdbId = typeof item.id === 'number' ? item.id : (typeof item.tmdb_id === 'number' ? item.tmdb_id : undefined);

    // Extract genre IDs
    let genreIds: number[] = [];
    if (Array.isArray(item.genre_ids)) {
      genreIds = item.genre_ids;
    } else if (Array.isArray(item.genres)) {
      genreIds = item.genres.map((g: any) => (typeof g === 'object' ? g.id : g)).filter((g: any) => typeof g === 'number');
    }

    const existingIndex = history.findIndex(
      (h) => (tmdbId && h.tmdb_id === tmdbId) || h.title.toLowerCase() === title.toLowerCase()
    );

    const now = Date.now();
    if (existingIndex >= 0) {
      const existing = history[existingIndex];
      existing.watch_count = (existing.watch_count || 1) + 1;
      existing.watched_at = now;
      if (item.poster_path && !existing.poster_path) existing.poster_path = item.poster_path;
      if (item.backdrop_path && !existing.backdrop_path) existing.backdrop_path = item.backdrop_path;
      if (genreIds.length > 0 && (!existing.genre_ids || existing.genre_ids.length === 0)) {
        existing.genre_ids = genreIds;
      }
      history.splice(existingIndex, 1);
      history.unshift(existing);
    } else {
      const newItem: PersistentMediaItem = {
        id: rawId,
        tmdb_id: tmdbId,
        title,
        media_type: mediaType,
        genre_ids: genreIds,
        poster_path: item.poster_path || null,
        backdrop_path: item.backdrop_path || null,
        vote_average: item.vote_average || undefined,
        release_date: item.release_date,
        first_air_date: item.first_air_date,
        watched_at: now,
        watch_count: 1,
        is_local: isLocal
      };
      history.unshift(newItem);
    }

    const trimmed = history.slice(0, MAX_HISTORY_ITEMS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));

    try {
      window.dispatchEvent(new CustomEvent('theora-watch-history-updated'));
    } catch {
      // ignore
    }
  } catch (err) {
    console.error('Error saving persistent watch history:', err);
  }
};

// Generate high-quality personalized recommendations based on persistent watch history
export const getPersistentRecommendations = async (): Promise<{
  suggestedMovies: TMDBResult[];
  suggestedSeries: TMDBResult[];
  seedTitles: string[];
}> => {
  const history = getPersistentWatchHistory();

  // If no history exists yet, return trending top content as baseline suggestions
  if (history.length === 0) {
    try {
      const [movies, tv] = await Promise.all([
        getTrending('movie', 'week', 'US'),
        getTrending('tv', 'week', 'US')
      ]);
      return {
        suggestedMovies: movies.slice(0, 12),
        suggestedSeries: tv.slice(0, 12),
        seedTitles: []
      };
    } catch {
      return { suggestedMovies: [], suggestedSeries: [], seedTitles: [] };
    }
  }

  const seedTitles = history.slice(0, 3).map((h) => h.title);
  const watchedTmdbIds = new Set<number>(
    history.map((h) => h.tmdb_id).filter((id): id is number => typeof id === 'number')
  );

  const movieSeeds = history.filter((h) => h.media_type === 'movie' && typeof h.tmdb_id === 'number');
  const tvSeeds = history.filter((h) => h.media_type === 'tv' && typeof h.tmdb_id === 'number');

  const movieRecPromises = movieSeeds.slice(0, 3).map((s) => getRecommendations('movie', s.tmdb_id!));
  const tvRecPromises = tvSeeds.slice(0, 3).map((s) => getRecommendations('tv', s.tmdb_id!));

  const [movieRecsResults, tvRecsResults] = await Promise.all([
    Promise.all(movieRecPromises),
    Promise.all(tvRecPromises)
  ]);

  const rawMovies = movieRecsResults.flat();
  const rawTV = tvRecsResults.flat();

  // Deduplicate and filter out already-watched titles
  const seenMovieIds = new Set<number>();
  const filteredMovies = rawMovies
    .map((m) => normalizeTMDBResult(m, 'movie'))
    .filter((m) => {
      if (!m.id || watchedTmdbIds.has(m.id) || seenMovieIds.has(m.id)) return false;
      seenMovieIds.add(m.id);
      return true;
    });

  const seenTVIds = new Set<number>();
  const filteredTV = rawTV
    .map((t) => normalizeTMDBResult(t, 'tv'))
    .filter((t) => {
      if (!t.id || watchedTmdbIds.has(t.id) || seenTVIds.has(t.id)) return false;
      seenTVIds.add(t.id);
      return true;
    });

  // If we don't have enough recommendations, top up with trending/popular
  let finalMovies = filteredMovies;
  if (finalMovies.length < 8) {
    try {
      const topMovies = await getTrending('movie', 'week', 'US');
      const additional = topMovies.filter(
        (m) => !watchedTmdbIds.has(m.id) && !seenMovieIds.has(m.id)
      );
      finalMovies = [...finalMovies, ...additional];
    } catch {
      // ignore
    }
  }

  let finalTV = filteredTV;
  if (finalTV.length < 8) {
    try {
      const topTV = await getTrending('tv', 'week', 'US');
      const additional = topTV.filter(
        (t) => !watchedTmdbIds.has(t.id) && !seenTVIds.has(t.id)
      );
      finalTV = [...finalTV, ...additional];
    } catch {
      // ignore
    }
  }

  return {
    suggestedMovies: finalMovies.slice(0, 16),
    suggestedSeries: finalTV.slice(0, 16),
    seedTitles
  };
};
