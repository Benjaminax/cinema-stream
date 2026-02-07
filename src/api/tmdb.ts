import { TMDBResult, MediaDetails, Genre, Credits, Video, Image, ImageSize, BackdropSize, SearchResponse } from '../types/media';
import { tmdbCache } from '../utils/tmdbCache';

// Configuration
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || '875bd4ff3b965afae93faa3d789f6d7e';

// Core functions

// Robust fetch wrapper: returns parsed JSON or null on error and logs useful context
async function safeFetch(url: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`TMDB fetch failed (${res.status} ${res.statusText}): ${url}`);
      return null;
    }
    return await res.json();
  } catch (error) {
    console.warn('TMDB fetch exception for URL:', url, error);
    return null;
  }
}

// Minimal fallback for MediaDetails when the API fails
function emptyDetails(type: 'movie' | 'tv', id: number): MediaDetails {
  return {
    id,
    title: '',
    name: '',
    original_title: '',
    original_name: '',
    overview: '',
    poster_path: null,
    backdrop_path: null,
    logo_path: null,
    release_date: undefined,
    first_air_date: undefined,
    vote_average: 0,
    vote_count: 0,
    genre_ids: [],
    genres: [],
    original_language: 'en',
    popularity: 0,
    media_type: type,
    adult: false,
    runtime: 0,
    episode_run_time: [],
    number_of_seasons: 0,
    number_of_episodes: 0,
    status: 'Unknown',
    tagline: undefined,
    budget: undefined,
    revenue: undefined,
    production_companies: [],
    production_countries: [],
    spoken_languages: []
  } as MediaDetails;
}

export interface EpisodeDetails {
  id: number;
  name: string;
  overview: string;
  still_path: string | null;
  season_number: number;
  episode_number: number;
  runtime?: number | null;
  air_date?: string;
  vote_average?: number;
}
export const getTrending = async (
  type: 'movie' | 'tv' = 'movie',
  timeWindow: 'day' | 'week' = 'week',
  region: string = 'US'
): Promise<TMDBResult[]> => {
  const url = `${TMDB_BASE_URL}/trending/${type}/${timeWindow}?api_key=${TMDB_API_KEY}&region=${region}`;
  const data: any = await safeFetch(url);
  return (data?.results ?? []).map((result: TMDBResult) => ({ ...result, media_type: type }));
};

export const getPopularMovies = async (page: number = 1): Promise<TMDBResult[]> => {
  const url = `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&sort_by=popularity.desc&page=${page}`;
  const data: any = await safeFetch(url);
  return (data?.results ?? []).map((result: TMDBResult) => ({
    ...result,
    media_type: 'movie' as const
  }));
};

export const getTopRatedMovies = async (page: number = 1): Promise<TMDBResult[]> => {
  const url = `${TMDB_BASE_URL}/movie/top_rated?api_key=${TMDB_API_KEY}&page=${page}`;
  const data: any = await safeFetch(url);
  return (data?.results ?? []).map((result: TMDBResult) => ({ ...result, media_type: 'movie' as const }));
};

export const searchMedia = async (
  query: string,
  type?: 'movie' | 'tv' | 'person',
  page: number = 1,
  year?: number
): Promise<SearchResponse> => {
  const endpoint = type ? `search/${type}` : 'search/multi';
  let url = `${TMDB_BASE_URL}/${endpoint}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&page=${page}`;

  if (year && type === 'movie') {
    url += `&year=${year}`;
  } else if (year && type === 'tv') {
    url += `&first_air_date_year=${year}`;
  }

  const data: any = await safeFetch(url);
  return data ?? { page: 1, results: [], total_pages: 0, total_results: 0 };
};

export const getGenres = async (type: 'movie' | 'tv' = 'movie'): Promise<Genre[]> => {
  const url = `${TMDB_BASE_URL}/genre/${type}/list?api_key=${TMDB_API_KEY}`;
  const data: any = await safeFetch(url);
  return data?.genres ?? [];
};

export const getUpcomingMovies = async (page: number = 1, region: string = 'US'): Promise<TMDBResult[]> => {
  const url = `${TMDB_BASE_URL}/movie/upcoming?api_key=${TMDB_API_KEY}&page=${page}&region=${region}`;
  const data: any = await safeFetch(url);
  return (data?.results ?? []).map((result: TMDBResult) => ({
    ...result,
    media_type: 'movie' as const
  }));
};

export const getUpcomingTV = async (page: number = 1): Promise<TMDBResult[]> => {
  const today = new Date();
  const nextMonth = new Date();
  nextMonth.setDate(today.getDate() + 30);

  const todayStr = today.toISOString().split('T')[0];
  const nextMonthStr = nextMonth.toISOString().split('T')[0];

  const url = `${TMDB_BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&air_date.gte=${todayStr}&air_date.lte=${nextMonthStr}&sort_by=popularity.desc&page=${page}`;
  const data: any = await safeFetch(url);
  return (data?.results ?? []).map((result: TMDBResult) => ({
    ...result,
    media_type: 'tv' as const
  }));
};

export interface DiscoverParams {
  genre?: string;
  page?: number;
  region?: string;
  origin_country?: string;
  sort_by?: string;
}

export const getDiscover = async (
  type: 'movie' | 'tv',
  params: DiscoverParams = {}
): Promise<TMDBResult[]> => {
  const { genre, page = 1, region = 'US', origin_country, sort_by = 'popularity.desc' } = params;
  let url = `${TMDB_BASE_URL}/discover/${type}?api_key=${TMDB_API_KEY}&page=${page}&region=${region}&sort_by=${sort_by}`;

  if (genre) {
    url += `&with_genres=${genre}`;
  }
  if (origin_country) {
    url += `&with_origin_country=${origin_country}`;
  }

  const data: any = await safeFetch(url);
  return (data?.results ?? []).map((result: TMDBResult) => ({
    ...result,
    media_type: type as 'movie' | 'tv'
  }));
};

// Streaming provider mappings for US region
const STREAMING_PROVIDERS: Record<string, number> = {
  'netflix': 8,
  'amazon_prime': 119,
  'hulu': 15,
  'disney_plus': 337,
  'max': 384, // HBO Max
  'paramount_plus': 531,
  'apple_tv': 2,
  'cw': 233,
};

export const getStreamingProviderMap = (): Record<string, number> => {
  return STREAMING_PROVIDERS;
};

export interface StreamingDiscoverParams extends DiscoverParams {
  provider?: string;
}

export const getByStreamingProvider = async (
  type: 'movie' | 'tv',
  provider: string,
  params: StreamingDiscoverParams = {}
): Promise<TMDBResult[]> => {
  const providerId = STREAMING_PROVIDERS[provider.toLowerCase()];
  if (!providerId) {
    console.warn(`Unknown streaming provider: ${provider}`);
    return [];
  }

  const { genre, page = 1, region = 'US', sort_by = 'popularity.desc' } = params;
  let url = `${TMDB_BASE_URL}/discover/${type}?api_key=${TMDB_API_KEY}&page=${page}&region=${region}&sort_by=${sort_by}&with_watch_providers=${providerId}&watch_region=${region}`;

  if (genre) {
    url += `&with_genres=${genre}`;
  }

  const data: any = await safeFetch(url);
  return (data?.results ?? []).map((result: TMDBResult) => ({
    ...result,
    media_type: type as 'movie' | 'tv'
  }));
};

export const getLogos = async (
  id: number,
  type: 'movie' | 'tv'
): Promise<Image[]> => {
  const url = `${TMDB_BASE_URL}/${type}/${id}/images?api_key=${TMDB_API_KEY}`;
  const data: any = await safeFetch(url);
  return data?.logos ?? [];
};

export const getDetails = async (
  type: 'movie' | 'tv',
  id: number
): Promise<MediaDetails> => {
  const cacheKey = `${type}_${id}`;
  const cached = tmdbCache.get(cacheKey);
  if (cached?.details && cached.details.credits?.cast?.length) {
    return cached.details;
  }

  const url = `${TMDB_BASE_URL}/${type}/${id}?api_key=${TMDB_API_KEY}&append_to_response=credits`;
  const data: any = await safeFetch(url);

  if (!data) {
    const fallback = emptyDetails(type, id);
    tmdbCache.set(cacheKey, { details: fallback });
    return fallback;
  }

  tmdbCache.set(cacheKey, { details: data });
  return data as MediaDetails;
};

export const getSeasonDetails = async (
  tvId: number,
  seasonNumber: number
): Promise<any> => {
  const url = `${TMDB_BASE_URL}/tv/${tvId}/season/${seasonNumber}?api_key=${TMDB_API_KEY}`;
  return await safeFetch(url);
};

export const getEpisodeDetails = async (
  tvId: number,
  seasonNumber: number,
  episodeNumber: number
): Promise<EpisodeDetails | null> => {
  const cacheKey = `tv_${tvId}_s${seasonNumber}e${episodeNumber}`;
  const cached = tmdbCache.get(cacheKey);
  if (cached?.episode) {
    return cached.episode as EpisodeDetails;
  }

  const url = `${TMDB_BASE_URL}/tv/${tvId}/season/${seasonNumber}/episode/${episodeNumber}?api_key=${TMDB_API_KEY}`;
  const data: any = await safeFetch(url);
  if (!data) return null;

  const episode: EpisodeDetails = {
    id: data.id,
    name: data.name,
    overview: data.overview,
    still_path: data.still_path,
    season_number: data.season_number,
    episode_number: data.episode_number,
    runtime: data.runtime ?? data.episode_run_time ?? null,
    air_date: data.air_date,
    vote_average: data.vote_average,
  };

  tmdbCache.set(cacheKey, { episode });
  return episode;
};

export const getCredits = async (
  type: 'movie' | 'tv',
  id: number
): Promise<Credits> => {
  const url = `${TMDB_BASE_URL}/${type}/${id}/credits?api_key=${TMDB_API_KEY}`;
  const data: any = await safeFetch(url);
  return data ?? { cast: [], crew: [] } as Credits;
};

export const getSimilar = async (
  type: 'movie' | 'tv',
  id: number
): Promise<TMDBResult[]> => {
  const url = `${TMDB_BASE_URL}/${type}/${id}/similar?api_key=${TMDB_API_KEY}&page=1`;
  const data: any = await safeFetch(url);
  return (data?.results ?? []).map((r: TMDBResult) => ({ ...r, media_type: type }));
};

export const searchByGenre = async (
  type: 'movie' | 'tv',
  genreId: number,
  page: number = 1
): Promise<{ results: TMDBResult[]; total_pages: number; total_results: number }> => {
  const url = `${TMDB_BASE_URL}/discover/${type}?api_key=${TMDB_API_KEY}&with_genres=${genreId}&page=${page}&sort_by=popularity.desc&vote_average.gte=6.0`;
  const data: any = await safeFetch(url);
  if (!data) return { results: [], total_pages: 0, total_results: 0 };
  
  return {
    results: (data.results ?? []).map((r: TMDBResult) => ({ ...r, media_type: type })),
    total_pages: data.total_pages ?? 0,
    total_results: data.total_results ?? 0
  };
};

export const getVideos = async (
  type: 'movie' | 'tv',
  id: number
): Promise<Video[]> => {
  const cacheKey = `${type}_${id}_videos`;
  const cached = tmdbCache.get(cacheKey);
  if (cached?.videos) {
    return cached.videos;
  }

  const url = `${TMDB_BASE_URL}/${type}/${id}/videos?api_key=${TMDB_API_KEY}`;
  const data: any = await safeFetch(url);

  const results = data?.results ?? [];
  tmdbCache.set(cacheKey, { videos: results });
  return results;
};

export const getImages = async (
  type: 'movie' | 'tv',
  id: number
): Promise<Image[]> => {
  const url = `${TMDB_BASE_URL}/${type}/${id}/images?api_key=${TMDB_API_KEY}`;
  const data: any = await safeFetch(url);
  return data?.logos ?? [];
};

// Image URL helpers
export const getImageUrl = (
  path: string | null,
  size: ImageSize = 'w500'
): string => {
  if (!path) return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQ1MCIgdmlld0JveD0iMCAwIDMwMCA0NTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3Lm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iNDUwIiBmaWxsPSIjMTExODI3Ii8+Cjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNmI3MjgwIiBmb250LXNpemU9IjE2IiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiPk5vIEltYWdlPC90ZXh0Pgo8L3N2Zz4=';
  if (path.includes('://')) return path;
  return `https://image.tmdb.org/t/p/${size}/${path}`;
};

export const getBackdropUrl = (
  path: string | null,
  size: BackdropSize = 'w1280'
): string => {
  if (!path) return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4MCIgaGVpZ2h0PSI3MjAiIHZpZXdCb3g9IjAgMCAxMjgwIDcyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjEyODAiIGhlaWdodD0iNzIwIiBmaWxsPSIjMTExODI3Ii8+Cjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNmI3MjgwIiBmb250LXNpemU9IjE2IiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiPk5vIEJhY2tkcm9wPC90ZXh0Pgo8L3N2Zz4=';
  if (path.includes('://')) return path;
  return `https://image.tmdb.org/t/p/${size}/${path}`;
};

// Cached image functions
export const getCachedImageUrl = async (
  path: string,
  size: ImageSize = 'w500'
): Promise<string> => {
  if (!path) return getImageUrl(null, size);

  let cachedPath: string | null = null;
  try {
    cachedPath = await tmdbCache.getImage(path, size);
  } catch (err) {
    console.warn('tmdbCache.getImage threw an error:', err);
    cachedPath = null;
  }

  if (cachedPath) {
    return `file://${cachedPath}`;
  }

  // Download and cache the image
  const originalUrl = getImageUrl(path, size);
  try {
    await tmdbCache.downloadAndCacheImage(originalUrl, path, size);
    const newCachedPath = await tmdbCache.getImage(path, size);
    return newCachedPath ? `file://${newCachedPath}` : originalUrl;
  } catch (error) {
    console.warn('Failed to cache image:', error);
    return originalUrl;
  }
};

export const getCachedBackdropUrl = async (
  path: string,
  size: BackdropSize = 'w1280'
): Promise<string> => {
  if (!path) return getBackdropUrl(null, size);

  let cachedPath: string | null = null;
  try {
    cachedPath = await tmdbCache.getImage(path, size);
  } catch (err) {
    console.warn('tmdbCache.getImage threw an error:', err);
    cachedPath = null;
  }

  if (cachedPath) {
    return `file://${cachedPath}`;
  }

  // Download and cache the image
  const originalUrl = getBackdropUrl(path, size);
  try {
    await tmdbCache.downloadAndCacheImage(originalUrl, path, size);
    const newCachedPath = await tmdbCache.getImage(path, size);
    return newCachedPath ? `file://${newCachedPath}` : originalUrl;
  } catch (error) {
    console.warn('Failed to cache backdrop:', error);
    return originalUrl;
  }
};

// OMDB API for IMDb ratings (no API key required for basic usage)
export const getIMDbRating = async (imdbId: string): Promise<string | null> => {
  try {
    const response = await fetch(`https://www.omdbapi.com/?i=${imdbId}&apikey=trilogy`);
    const data = await response.json();
    return data.imdbRating || null;
  } catch (error) {
    console.warn('Failed to fetch IMDb rating:', error);
    return null;
  }
};
