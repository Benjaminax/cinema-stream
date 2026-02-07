export interface TMDBResult {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  logo_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
  genres?: Genre[]; // Add genres array for display
  credits?: Credits; // Add credits for cast and crew caching
  original_language: string;
  popularity: number;
  media_type?: 'movie' | 'tv';
  adult?: boolean;
  // Local media properties
  file_path?: string;
  file_size?: number;
  modified_date?: Date;
  local_path?: string;
  local_paths?: string[]; // Multiple directories or files for the same media
  rating?: string; // MPAA rating extracted from filename
  duration?: number; // Duration in minutes extracted from filename
  progress?: number; // Current playback position in seconds
  resolution?: string; // 1080p, 720p, 4K, etc.
  videoCodec?: string; // x264, x265, HEVC, etc.
  audioCodec?: string; // AAC, AC3, DTS, etc.
  source?: string; // BluRay, WEBRip, HDRip, etc.
  fileSize?: string; // Human readable file size
  imdb_id?: string; // IMDb ID for external rating lookup
  imdb_rating?: number; // IMDb rating fetched from OMDB
  imdb_votes?: string; // IMDb vote count
  local_poster_path?: string; // Path to locally cached poster
  local_backdrop_path?: string; // Path to locally cached backdrop
  local_still_path?: string; // Path to locally cached episode still
  still_path?: string; // Path to episode still frame
  season?: number; // Season number for episodes
  episode?: number; // Episode number for episodes
}

export interface MediaDetails extends TMDBResult {
  runtime?: number;
  episode_run_time?: number[];
  number_of_seasons?: number;
  number_of_episodes?: number;
  status: string;
  tagline?: string;
  budget?: number;
  revenue?: number;
  genres: Genre[];
  production_companies: ProductionCompany[];
  production_countries: ProductionCountry[];
  spoken_languages: SpokenLanguage[];
  imdb_id?: string; // IMDb ID for external rating lookup
  imdb_rating?: number; // IMDb rating fetched from OMDB
  imdb_votes?: string; // IMDb vote count
  // TV show specific fields
  in_production?: boolean;
  type?: string;
  last_air_date?: string;
  next_episode_to_air?: NextEpisodeToAir | null;
  credits?: Credits; // Add credits for cast and crew
}

export interface Genre {
  id: number;
  name: string;
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  order: number;
}

export interface CrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
  profile_path: string | null;
}

export interface Credits {
  cast: CastMember[];
  crew: CrewMember[];
}

export interface Video {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
  official: boolean;
  published_at: string;
}

export interface Image {
  aspect_ratio: number;
  file_path: string;
  height: number;
  width: number;
  iso_639_1: string | null;
  vote_average: number;
  vote_count: number;
}

export interface ProductionCompany {
  id: number;
  logo_path: string | null;
  name: string;
  origin_country: string;
}

export interface ProductionCountry {
  iso_3166_1: string;
  name: string;
}

export interface SpokenLanguage {
  english_name: string;
  iso_639_1: string;
  name: string;
}

export type ImageSize = 'w92' | 'w154' | 'w185' | 'w342' | 'w500' | 'w780' | 'original';
export type BackdropSize = 'w300' | 'w780' | 'w1280' | 'original';

export interface DiscoverParams {
  genre?: string;
  year?: number;
  sort_by?: 'popularity.desc' | 'popularity.asc' | 'release_date.desc' | 'release_date.asc' | 'vote_average.desc' | 'vote_average.asc';
  page?: number;
  region?: string;
  origin_country?: string;
}

export interface NextEpisodeToAir {
  id: number;
  name: string;
  overview: string;
  vote_average: number;
  vote_count: number;
  air_date: string;
  episode_number: number;
  episode_type: string;
  production_code: string;
  runtime: number | null;
  season_number: number;
  show_id: number;
  still_path: string | null;
}

export interface Episode {
  id?: number;
  name?: string;
  title?: string;
  season?: number;
  episode?: number;
  file_path?: string;
  file_size?: number;
  modified_date?: Date;
  seriesName?: string;
  seriesPath?: string;
  progress?: number; // Current playback position in seconds
}

export interface SearchResponse {
  page: number;
  results: TMDBResult[];
  total_pages: number;
  total_results: number;
}