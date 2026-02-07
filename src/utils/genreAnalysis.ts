import { TMDBResult } from '../types/media';
import { getGenres, searchMedia } from '../api/tmdb';
import { parseMediaFilename, localFileToTMDBResult } from './localMedia';
import { LocalMediaFile } from './localMedia';
import '../types/electron';

// TMDB genre objects for converting genre_ids to genres
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

// Convert genre_ids to genres array
function convertGenreIdsToGenres(genreIds: number[]): Array<{ id: number, name: string }> {
  return genreIds.map(id => GENRE_MAP[id]).filter(Boolean);
}

// Scan and enrich local media library
export async function scanLocalLibrary(): Promise<{ movies: TMDBResult[], series: TMDBResult[] }> {
  try {
    if (!window.electronAPI) {
      console.error('Electron API not available');
      return { movies: [], series: [] };
    }
    // Get the Videos folder path
    const videosPath = await window.electronAPI.getVideosPath();

    const movies: TMDBResult[] = [];
    const series: TMDBResult[] = [];

    // Scan Movies folder
    try {
      const moviesFolderPath = `${videosPath.replace(/\\/g, '/')}/Movies`;
      const movieFiles: LocalMediaFile[] = await window.electronAPI.scanDirectory(moviesFolderPath);

      // Filter to only include files
      const filteredMovieFiles = movieFiles.filter(f => f.type === 'file');

      // Parse and enrich movies
      for (const file of filteredMovieFiles.slice(0, 50)) { // Limit to 50 for performance
        const parsed = parseMediaFilename(file.name);
        if (parsed.type === 'movie') {
          try {
            const searchResults = await searchMedia(parsed.title, 'movie', 1, parsed.year);
            const tmdbMovie = searchResults.results?.[0];

            if (tmdbMovie) {
              // Convert genre_ids to genres array for display
              const genres = tmdbMovie.genre_ids ? convertGenreIdsToGenres(tmdbMovie.genre_ids) : [];
              movies.push({
                ...tmdbMovie,
                genres, // Add converted genres
                local_path: file.path,
                file_size: file.size,
                modified_date: file.modified,
              });
            } else {
              movies.push(localFileToTMDBResult(file, parsed));
            }
          } catch (error) {
            // Fallback to basic local data
            movies.push(localFileToTMDBResult(file, parsed));
          }
        }
      }
    } catch (error) {
      console.warn('Could not scan Movies folder:', error);
    }

    // Scan Series folder
    try {
      const seriesFolderPath = `${videosPath.replace(/\\/g, '/')}/Series`;
      const seriesFiles: LocalMediaFile[] = await window.electronAPI.scanDirectory(seriesFolderPath);

      // Filter to only include files
      const filteredSeriesFiles = seriesFiles.filter(f => f.type === 'file');

      // Parse and enrich series
      for (const file of filteredSeriesFiles.slice(0, 50)) { // Limit to 50 for performance
        const parsed = parseMediaFilename(file.name);
        if (parsed.type === 'series') {
          try {
            const searchResults = await searchMedia(parsed.title, 'tv', 1, parsed.year);
            const tmdbSeries = searchResults.results?.[0];

            if (tmdbSeries) {
              // Convert genre_ids to genres array for display
              const genres = tmdbSeries.genre_ids ? convertGenreIdsToGenres(tmdbSeries.genre_ids) : [];
              series.push({
                ...tmdbSeries,
                genres, // Add converted genres
                local_path: file.path,
                file_size: file.size,
                modified_date: file.modified,
              });
            } else {
              series.push(localFileToTMDBResult(file, parsed));
            }
          } catch (error) {
            // Fallback to basic local data
            series.push(localFileToTMDBResult(file, parsed));
          }
        }
      }
    } catch (error) {
      console.warn('Could not scan Series folder:', error);
    }

    return { movies, series };
  } catch (error) {
    console.error('Error scanning local library:', error);
    return { movies: [], series: [] };
  }
}

// Analyze user's media items to determine preferred genres
export async function analyzeUserGenres(items: TMDBResult[]): Promise<number[]> {
  const genreCounts: { [key: number]: number } = {};

  // Count genre occurrences
  items.forEach(item => {
    if (item.genre_ids && item.genre_ids.length > 0) {
      item.genre_ids.forEach(genreId => {
        genreCounts[genreId] = (genreCounts[genreId] || 0) + 1;
      });
    }
  });

  // Sort genres by frequency and return top genres
  const sortedGenres = Object.entries(genreCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([genreId]) => parseInt(genreId));

  // Return top 5 genres, or all if less than 5
  return sortedGenres.slice(0, 5);
}

// Get genre names for display
export async function getGenreNames(genreIds: number[]): Promise<string[]> {
  try {
    const allGenres = await getGenres();
    return genreIds.map(id => {
      const genre = allGenres.find(g => g.id === id);
      return genre ? genre.name : `Genre ${id}`;
    });
  } catch (error) {
    console.error('Error fetching genre names:', error);
    return genreIds.map(id => `Genre ${id}`);
  }
}

// Filter trending content by user's preferred genres
export function filterByGenres(items: TMDBResult[], preferredGenreIds: number[]): TMDBResult[] {
  if (preferredGenreIds.length === 0) {
    return items; // Return all if no preferences
  }

  return items.filter(item => {
    if (!item.genre_ids || item.genre_ids.length === 0) {
      return false; // Skip items without genre info
    }

    // Check if item has at least one preferred genre
    return item.genre_ids.some(genreId => preferredGenreIds.includes(genreId));
  });
}



