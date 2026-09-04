import { TMDBResult, MediaDetails, Genre, Credits, Video, Image, ImageSize, BackdropSize, SearchResponse, Franchise } from '../types/media';
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
  const url = `${TMDB_BASE_URL}/trending/${type}/${timeWindow}?api_key=${TMDB_API_KEY}&region=${region}&language=en-US`;
  const data: any = await safeFetch(url);
  return (data?.results ?? []).map((result: TMDBResult) => ({ ...result, media_type: type }));
};

export const getPopularMovies = async (page: number = 1): Promise<TMDBResult[]> => {
  const url = `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&sort_by=popularity.desc&page=${page}&language=en-US&region=US`;
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

export const normalizeTMDBResult = (result: any, defaultType?: 'movie' | 'tv') => {
  const media_type = result.media_type || defaultType || (result.first_air_date ? 'tv' : (result.release_date ? 'movie' : (result.title && !result.name ? 'movie' : 'tv')));
  const displayTitle = result.title || result.name || result.original_title || result.original_name || '';
  const displayDate = result.release_date || result.first_air_date || null;
  return { ...result, media_type, displayTitle, displayDate };
};

export const getGenres = async (type: 'movie' | 'tv' = 'movie'): Promise<Genre[]> => {
  const url = `${TMDB_BASE_URL}/genre/${type}/list?api_key=${TMDB_API_KEY}`;
  const data: any = await safeFetch(url);
  return data?.genres ?? [];
};

export const getUpcomingMovies = async (page: number = 1, region: string = 'US'): Promise<TMDBResult[]> => {
  const url = `${TMDB_BASE_URL}/movie/upcoming?api_key=${TMDB_API_KEY}&page=${page}&region=${region}&language=en-US`;
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

  const url = `${TMDB_BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&air_date.gte=${todayStr}&air_date.lte=${nextMonthStr}&sort_by=popularity.desc&page=${page}&language=en-US&region=US`;
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
  let url = `${TMDB_BASE_URL}/discover/${type}?api_key=${TMDB_API_KEY}&page=${page}&region=${region}&sort_by=${sort_by}&language=en-US`;

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
  let url = `${TMDB_BASE_URL}/discover/${type}?api_key=${TMDB_API_KEY}&page=${page}&region=${region}&sort_by=${sort_by}&with_watch_providers=${providerId}&watch_region=${region}&language=en-US`;

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
  const url = `${TMDB_BASE_URL}/${type}/${id}/similar?api_key=${TMDB_API_KEY}&page=1&language=en-US`;
  const data: any = await safeFetch(url);
  return (data?.results ?? []).map((r: TMDBResult) => ({ ...r, media_type: type }));
};

export const getRecommendations = async (
  type: 'movie' | 'tv',
  id: number,
  page: number = 1
): Promise<TMDBResult[]> => {
  const url = `${TMDB_BASE_URL}/${type}/${id}/recommendations?api_key=${TMDB_API_KEY}&language=en-US&page=${page}`;
  const data: any = await safeFetch(url);
  return (data?.results ?? []).map((r: TMDBResult) => ({ ...r, media_type: type }));
};

export interface Collection {
  id: number;
  name: string;
  overview?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  parts: TMDBResult[];
}

export const getCollection = async (collectionId: number): Promise<Collection | null> => {
  const url = `${TMDB_BASE_URL}/collection/${collectionId}?api_key=${TMDB_API_KEY}`;
  const data: any = await safeFetch(url);
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    overview: data.overview,
    poster_path: data.poster_path ?? null,
    backdrop_path: data.backdrop_path ?? null,
    parts: (data.parts ?? []).map((p: any) => ({ ...p, media_type: 'movie' as const }))
  };
};

const GENRE_MAP: Record<number, string> = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Sci-Fi',
  10770: 'TV Movie',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
};

const FEATURED_FRANCHISE_CONFIGS = [
  {
    id: 86311,
    customTitle: 'The Avengers',
    customTagline: "Earth's Mightiest Heroes assemble to save the universe.",
    curatedVotes: '18.5M votes',
    curatedRating: '8.1',
    yearRangeOverride: '2012-2019',
    curatedGenres: ['Action', 'Sci-Fi', 'Adventure']
  },
  {
    id: 10,
    customTitle: 'Star Wars',
    customTagline: 'In a galaxy far, far away, the battle between Light and Dark.',
    curatedVotes: '16.2M votes',
    curatedRating: '7.8',
    yearRangeOverride: '1977-2019',
    curatedGenres: ['Sci-Fi', 'Adventure', 'Action', 'Fantasy']
  },
  {
    id: 1241,
    customTitle: 'Harry Potter',
    customTagline: 'The boy who lived and the legendary wizarding world.',
    curatedVotes: '12.4M votes',
    curatedRating: '7.8',
    yearRangeOverride: '2001-2011',
    curatedGenres: ['Fantasy', 'Adventure', 'Family']
  },
  {
    id: 119,
    customTitle: 'The Lord of the Rings',
    customTagline: 'One Ring to rule them all in the mythic lands of Middle-earth.',
    curatedVotes: '11.5M votes',
    curatedRating: '8.5',
    yearRangeOverride: '2001-2003',
    curatedGenres: ['Fantasy', 'Adventure', 'Action']
  },
  {
    id: 263,
    customTitle: 'The Dark Knight',
    customTagline: "Gotham's protector against chaos, anarchy, and terror.",
    curatedVotes: '9.8M votes',
    curatedRating: '8.3',
    yearRangeOverride: '2005-2012',
    curatedGenres: ['Action', 'Crime', 'Drama', 'Thriller']
  },
  {
    id: 556,
    customTitle: 'Spider-Man',
    customTagline: 'With great power comes great responsibility.',
    curatedVotes: '8.9M votes',
    curatedRating: '7.5',
    yearRangeOverride: '2002-2021',
    curatedGenres: ['Action', 'Sci-Fi', 'Adventure']
  },
  {
    id: 404609,
    customTitle: 'John Wick',
    customTagline: 'The legendary Boogeyman seeking unstoppable vengeance.',
    curatedVotes: '4.2M votes',
    curatedRating: '7.6',
    yearRangeOverride: '2014-2023',
    curatedGenres: ['Action', 'Thriller', 'Crime']
  },
  {
    id: 328,
    customTitle: 'Jurassic Park',
    customTagline: 'Life finds a way across Isla Nublar and the mainland.',
    curatedVotes: '7.1M votes',
    curatedRating: '7.1',
    yearRangeOverride: '1993-2022',
    curatedGenres: ['Sci-Fi', 'Adventure', 'Action']
  },
  {
    id: 9485,
    customTitle: 'Fast & Furious',
    customTagline: 'It is all about family, high-speed heists, and speed.',
    curatedVotes: '8.6M votes',
    curatedRating: '6.9',
    yearRangeOverride: '2001-2023',
    curatedGenres: ['Action', 'Crime', 'Thriller']
  },
  {
    id: 87359,
    customTitle: 'Mission: Impossible',
    customTagline: 'Ethan Hunt and the IMF taking on impossible assignments.',
    curatedVotes: '5.8M votes',
    curatedRating: '7.4',
    yearRangeOverride: '1996-2023',
    curatedGenres: ['Action', 'Adventure', 'Thriller']
  },
  {
    id: 295,
    customTitle: 'Pirates of the Caribbean',
    customTagline: 'Captain Jack Sparrow sailing through supernatural seas.',
    curatedVotes: '8.1M votes',
    curatedRating: '7.2',
    yearRangeOverride: '2003-2017',
    curatedGenres: ['Adventure', 'Fantasy', 'Action', 'Comedy']
  },
  {
    id: 10194,
    customTitle: 'Toy Story',
    customTagline: 'To infinity and beyond with Woody, Buzz, and the gang.',
    curatedVotes: '6.7M votes',
    curatedRating: '7.8',
    yearRangeOverride: '1995-2019',
    curatedGenres: ['Animation', 'Family', 'Comedy', 'Adventure']
  },
  {
    id: 2150,
    customTitle: 'Shrek',
    customTagline: 'The lovable ogre who turned fairytale tropes upside down.',
    curatedVotes: '5.9M votes',
    curatedRating: '7.3',
    yearRangeOverride: '2001-2010',
    curatedGenres: ['Animation', 'Comedy', 'Family', 'Fantasy']
  },
  {
    id: 137696,
    customTitle: 'Monsters, Inc.',
    customTagline: "Pixar's lovable top scarers Mike and Sulley.",
    curatedVotes: '5.3M votes',
    curatedRating: '7.6',
    yearRangeOverride: '2001-2013',
    curatedGenres: ['Animation', 'Comedy', 'Family']
  },
  {
    id: 137697,
    customTitle: 'Finding Nemo',
    customTagline: "Just keep swimming through Pixar's vast ocean adventures.",
    curatedVotes: '5.3M votes',
    curatedRating: '7.4',
    yearRangeOverride: '2003-2016',
    curatedGenres: ['Animation', 'Adventure', 'Family']
  },
  {
    id: 86066,
    customTitle: 'Despicable Me',
    customTagline: 'Gru, his girls, and an endless army of yellow Minions.',
    curatedVotes: '6.2M votes',
    curatedRating: '7.1',
    yearRangeOverride: '2010-2024',
    curatedGenres: ['Animation', 'Comedy', 'Family']
  },
  {
    id: 77816,
    customTitle: 'Kung Fu Panda',
    customTagline: 'Po the giant panda discovering the Dragon Warrior within.',
    curatedVotes: '4.8M votes',
    curatedRating: '7.3',
    yearRangeOverride: '2008-2024',
    curatedGenres: ['Animation', 'Action', 'Comedy', 'Family']
  },
  {
    id: 91361,
    customTitle: 'Halloween',
    customTagline: 'Michael Myers returns to stalk the streets of Haddonfield.',
    curatedVotes: '3.1M votes',
    curatedRating: '6.2',
    yearRangeOverride: '1978-2022',
    curatedGenres: ['Horror', 'Thriller']
  },
  {
    id: 313086,
    customTitle: 'The Conjuring',
    customTagline: 'Ed and Lorraine Warren investigating terrifying paranormal cases.',
    curatedVotes: '3.8M votes',
    curatedRating: '7.2',
    yearRangeOverride: '2013-2021',
    curatedGenres: ['Horror', 'Mystery', 'Thriller']
  },
  {
    id: 2602,
    customTitle: 'Scream',
    customTagline: 'What is your favorite scary movie? Ghostface dials in.',
    curatedVotes: '3.4M votes',
    curatedRating: '6.8',
    yearRangeOverride: '1996-2023',
    curatedGenres: ['Horror', 'Mystery', 'Thriller']
  },
  {
    id: 8091,
    customTitle: 'Alien',
    customTagline: 'In space no one can hear you scream against the Xenomorph.',
    curatedVotes: '4.5M votes',
    curatedRating: '7.4',
    yearRangeOverride: '1979-1997',
    curatedGenres: ['Horror', 'Sci-Fi', 'Thriller']
  },
  {
    id: 2344,
    customTitle: 'The Matrix',
    customTagline: 'Take the red pill and wake up to the true reality.',
    curatedVotes: '5.6M votes',
    curatedRating: '7.6',
    yearRangeOverride: '1999-2021',
    curatedGenres: ['Sci-Fi', 'Action']
  },
  {
    id: 84,
    customTitle: 'Indiana Jones',
    customTagline: 'Fortune and glory with the iconic fedora-wearing archaeologist.',
    curatedVotes: '5.2M votes',
    curatedRating: '7.5',
    yearRangeOverride: '1981-2023',
    curatedGenres: ['Adventure', 'Action']
  },
  {
    id: 131635,
    customTitle: 'The Hunger Games',
    customTagline: 'May the odds be ever in your favor in Panem.',
    curatedVotes: '6.1M votes',
    curatedRating: '7.4',
    yearRangeOverride: '2012-2023',
    curatedGenres: ['Sci-Fi', 'Adventure', 'Action', 'Thriller']
  },
  {
    id: 87096,
    customTitle: 'Avatar',
    customTagline: 'Enter the lush, breathtaking biosphere of Pandora.',
    curatedVotes: '4.9M votes',
    curatedRating: '7.6',
    yearRangeOverride: '2009-2022',
    curatedGenres: ['Sci-Fi', 'Adventure', 'Action', 'Fantasy']
  },
  {
    id: 8945,
    customTitle: 'Mad Max',
    customTagline: 'High-octane survival across the brutal post-apocalyptic wasteland.',
    curatedVotes: '4.1M votes',
    curatedRating: '7.3',
    yearRangeOverride: '1979-2024',
    curatedGenres: ['Action', 'Sci-Fi', 'Thriller', 'Adventure']
  },
  {
    id: 925155,
    customTitle: 'Demon Slayer',
    customTagline: 'Tanjiro Kamado and the Demon Slayer Corps against Muzan.',
    curatedVotes: '3.7M votes',
    curatedRating: '8.2',
    yearRangeOverride: '2019-2025',
    curatedGenres: ['Animation', 'Action', 'Fantasy']
  }
];

let cachedFeaturedFranchises: Franchise[] | null = null;

export const getFeaturedFranchises = async (): Promise<Franchise[]> => {
  if (cachedFeaturedFranchises && cachedFeaturedFranchises.length > 0) {
    return cachedFeaturedFranchises;
  }

  const results: Franchise[] = [];
  for (const config of FEATURED_FRANCHISE_CONFIGS) {
    try {
      const collection = await getCollection(config.id);
      if (collection && collection.parts && collection.parts.length > 0) {
        const parts = collection.parts;
        const validPosters = parts
          .map(p => p.poster_path)
          .filter((p): p is string => Boolean(p));

        const years = parts
          .map(p => p.release_date?.substring(0, 4))
          .filter((y): y is string => Boolean(y))
          .sort();

        const yearRange = config.yearRangeOverride || (
          years.length > 0
            ? (years[0] === years[years.length - 1] ? years[0] : `${years[0]}-${years[years.length - 1]}`)
            : '2015-2024'
        );

        const sumRating = parts.reduce((acc, p) => acc + (p.vote_average || 0), 0);
        const avgRating = config.curatedRating || (parts.length > 0 ? (sumRating / parts.length).toFixed(1) : '7.5');

        const totalVotes = parts.reduce((acc, p) => acc + (p.vote_count || 0), 0);
        const formattedVotes = config.curatedVotes || (
          totalVotes >= 1000000
            ? `${(totalVotes / 1000000).toFixed(1)}M votes`
            : totalVotes >= 1000
            ? `${(totalVotes / 1000).toFixed(0)}K votes`
            : `${totalVotes} votes`
        );

        // Compute genres
        const genreSet = new Set<string>();
        if ((config as any).curatedGenres) {
          (config as any).curatedGenres.forEach((g: string) => genreSet.add(g));
        }
        parts.forEach(p => {
          p.genre_ids?.forEach(id => {
            const name = GENRE_MAP[id];
            if (name) genreSet.add(name);
          });
        });
        const genres = Array.from(genreSet);

        results.push({
          id: config.id,
          name: collection.name,
          displayTitle: config.customTitle,
          tagline: config.customTagline,
          overview: collection.overview || config.customTagline,
          poster_path: collection.poster_path,
          backdrop_path: collection.backdrop_path,
          titlesCount: parts.length,
          yearRange,
          avgRating,
          totalVotes,
          formattedVotes,
          posters: validPosters.slice(0, 4),
          parts,
          genres
        });
      }
    } catch (e) {
      console.warn(`Failed to fetch franchise ${config.customTitle}:`, e);
    }
  }

  cachedFeaturedFranchises = results;
  return results;
};

export const searchByGenre = async (
  type: 'movie' | 'tv',
  genreId: number,
  page: number = 1,
  region: string = 'US',
  language: string = 'en-US',
  originalLanguage?: string // e.g., 'en' to prefer English originals
): Promise<{ results: TMDBResult[]; total_pages: number; total_results: number }> => {
  let url = `${TMDB_BASE_URL}/discover/${type}?api_key=${TMDB_API_KEY}&with_genres=${genreId}&page=${page}&sort_by=popularity.desc&vote_average.gte=6.0&region=${region}&language=${language}`;
  if (originalLanguage) {
    url += `&with_original_language=${originalLanguage}`;
  }

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
