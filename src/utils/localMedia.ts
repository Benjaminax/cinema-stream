import { TMDBResult } from '../types/media';
import { parseMediaFilename, ParsedMediaInfo } from './mediaParser';

export interface LocalMediaFile {
  name: string;
  path: string;
  size: number;
  modified: Date;
  type: 'file' | 'directory'; // Match what electron API returns
  isDirectory?: boolean; // Keep for backward compatibility
}

// Re-export for backward compatibility
export { parseMediaFilename };
export type { ParsedMediaInfo };

// Common genre keywords and their corresponding TMDB genre IDs
const GENRE_KEYWORDS = {
  // Action/Adventure
  action: 28,
  adventure: 12,
  superhero: 28,
  marvel: 28,
  dc: 28,
  batman: 28,
  superman: 28,
  avengers: 28,
  xmen: 28,
  spiderman: 28,
  
  // Sci-Fi
  scifi: 878,
  science: 878,
  fiction: 878,
  space: 878,
  alien: 878,
  robot: 878,
  cyberpunk: 878,
  dystopian: 878,
  future: 878,
  avatar: 878,
  tron: 878,
  matrix: 878,
  
  // Fantasy
  fantasy: 14,
  magic: 14,
  wizard: 14,
  dragon: 14,
  elf: 14,
  dwarf: 14,
  hobbit: 14,
  lord: 14,
  rings: 14,
  harry: 14,
  potter: 14,
  
  // Horror
  horror: 27,
  zombie: 27,
  vampire: 27,
  ghost: 27,
  haunted: 27,
  nightmare: 27,
  scream: 27,
  friday: 27,
  halloween: 27,
  
  // Comedy
  comedy: 35,
  funny: 35,
  laugh: 35,
  humor: 35,
  romantic: 35,
  chick: 35,
  flick: 35,
  
  // Drama
  drama: 18,
  emotional: 18,
  story: 18,
  life: 18,
  family: 18,
  relationship: 18,
  
  // Thriller
  thriller: 53,
  suspense: 53,
  mystery: 53,
  detective: 53,
  crime: 53,
  murder: 53,
  killer: 53,
  
  // Animation
  animation: 16,
  animated: 16,
  cartoon: 16,
  disney: 16,
  pixar: 16,
  dreamworks: 16,
  
  // Documentary
  documentary: 99,
  doc: 99,
  real: 99,
  history: 99,
  biography: 99,
  
  // Romance
  romance: 10749,
  love: 10749,
  romantic_comedy: 10749,
  dating: 10749,
  wedding: 10749,
  
  // Western
  western: 37,
  cowboy: 37,
  gunslinger: 37,
  saloon: 37,
  
  // War
  war: 10752,
  battle: 10752,
  military: 10752,
  soldier: 10752,
  
  // Music
  music: 10402,
  musical: 10402,
  concert: 10402,
  band: 10402,
  singer: 10402
};

// TMDB genre objects
const GENRE_MAP: Record<number, { id: number; name: string }> = {
  28: { id: 28, name: 'Action' },
  12: { id: 12, name: 'Adventure' },
  16: { id: 16, name: 'Animation' },
  35: { id: 35, name: 'Comedy' },
  80: { id: 80, name: 'Crime' },
  99: { id: 99, name: 'Documentary' },
  18: { id: 18, name: 'Drama' },
  10751: { id: 10751, name: 'Family' },
  14: { id: 14, name: 'Fantasy' },
  36: { id: 36, name: 'History' },
  27: { id: 27, name: 'Horror' },
  10402: { id: 10402, name: 'Music' },
  9648: { id: 9648, name: 'Mystery' },
  10749: { id: 10749, name: 'Romance' },
  878: { id: 878, name: 'Science Fiction' },
  10770: { id: 10770, name: 'TV Movie' },
  53: { id: 53, name: 'Thriller' },
  10752: { id: 10752, name: 'War' },
  37: { id: 37, name: 'Western' }
};

function inferGenresFromTitle(title: string, source?: string): Array<{id: number, name: string}> {
  const genres = new Set<number>();
  const lowerTitle = title.toLowerCase();
  
  // Check for genre keywords in title
  for (const [keyword, genreId] of Object.entries(GENRE_KEYWORDS)) {
    if (lowerTitle.includes(keyword)) {
      genres.add(genreId);
    }
  }
  
  // Special cases based on source
  if (source) {
    const lowerSource = source.toLowerCase();
    if (lowerSource.includes('bluray') || lowerSource.includes('bd')) {
      // BluRay often indicates higher quality/action films
    }
    if (lowerSource.includes('webrip') || lowerSource.includes('web')) {
      // WebRip could be various genres
    }
  }
  
  // Convert genre IDs to genre objects
  return Array.from(genres).map(id => GENRE_MAP[id]).filter(Boolean);
}

function generateOverview(parsed: ParsedMediaInfo, file: LocalMediaFile): string {
  const parts = [];
  
  if (parsed.type === 'movie') {
    parts.push(`A ${parsed.year || 'recent'} ${parsed.source ? parsed.source.toLowerCase() : 'movie'} file`);
  } else {
    parts.push(`A ${parsed.year || 'recent'} ${parsed.source ? parsed.source.toLowerCase() : 'series'} episode`);
  }
  
  if (parsed.resolution) {
    parts.push(`in ${parsed.resolution} resolution`);
  }
  
  if (parsed.videoCodec) {
    parts.push(`encoded with ${parsed.videoCodec}`);
  }
  
  if (parsed.audioCodec) {
    parts.push(`and ${parsed.audioCodec} audio`);
  }
  
  if (parsed.rating) {
    parts.push(`rated ${parsed.rating}`);
  }
  
  if (parsed.duration) {
    const hours = Math.floor(parsed.duration / 60);
    const minutes = parsed.duration % 60;
    const durationStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    parts.push(`with a runtime of ${durationStr}`);
  }
  
  parts.push(`(${formatFileSize(file.size)}).`);
  
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function localFileToTMDBResult(file: LocalMediaFile, parsed: ParsedMediaInfo): TMDBResult {
  const fallbackTitle = file.name.replace(/\.[^/.]+$/, '').trim() || 'Unknown Movie';
  
  // Infer genres from keywords in title and metadata
  const inferredGenres = inferGenresFromTitle(parsed.title, parsed.source);
  
  // Create a more informative overview
  const overview = generateOverview(parsed, file);
  
  return {
    id: Math.random(), // Generate a unique ID
    title: parsed.title?.trim() || fallbackTitle,
    name: parsed.title?.trim() || fallbackTitle,
    overview,
    poster_path: null,
    backdrop_path: null,
    release_date: parsed.year ? `${parsed.year}-01-01` : undefined,
    first_air_date: parsed.year ? `${parsed.year}-01-01` : undefined,
    vote_average: 0,
    vote_count: 0,
    genre_ids: inferredGenres.map(g => g.id),
    genres: inferredGenres, // Add genres array for display
    original_language: 'en',
    original_title: parsed.title?.trim() || fallbackTitle,
    popularity: 0,
    media_type: parsed.type === 'movie' ? 'movie' : 'tv',
    adult: false,
    // Local file specific properties
    file_path: file.path,
    file_size: file.size,
    modified_date: file.modified,
    local_path: file.path,
    rating: parsed.rating,
    duration: parsed.duration,
    resolution: parsed.resolution,
    videoCodec: parsed.videoCodec,
    audioCodec: parsed.audioCodec,
    source: parsed.source,
    fileSize: formatFileSize(file.size)
  };
}