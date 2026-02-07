import React, { useState, useEffect, useMemo } from 'react';
import { Film, RefreshCw, FileVideo, Search, Filter, X, ChevronDown } from 'lucide-react';
import { TMDBResult } from '../types/media';
import { LocalMediaFile, parseMediaFilename, localFileToTMDBResult } from '../utils/localMedia';
import { searchMedia, getImageUrl, getBackdropUrl, getIMDbRating, getDetails } from '../api/tmdb';
import DetailsModal from '../components/media/DetailsModal';
import { addRecentlyWatched } from '../utils/recentlyWatched';
import { libraryCache } from '../utils/libraryCache';
import { GENRE_NAME_MAP } from '../utils/genrePreferences';
import '../types/electron';

// All available genres for filtering from master map
const ALL_GENRES = Object.entries(GENRE_NAME_MAP)
  .filter(([id]) => parseInt(id) < 10000) // Keep primarily movie genres for this view
  .map(([id, name]) => ({ id: parseInt(id), name }));

// Sort options
type SortOption = 'title' | 'date' | 'rating' | 'size';

// Convert genre_ids to genres array
function convertGenreIdsToGenres(genreIds: number[]): Array<{ id: number, name: string }> {
  return genreIds.map(id => ({ id, name: GENRE_NAME_MAP[id] })).filter(g => g.name);
}

const LocalMovies: React.FC = () => {
  const [movies, setMovies] = useState<TMDBResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [videosPath, setVideosPath] = useState<string>('');
  const [selectedMovie, setSelectedMovie] = useState<TMDBResult | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<number[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('title');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    console.log('🎬 LocalMovies component mounted');
    const init = async () => {
      await libraryCache.load();
      await loadLocalMovies();
    };
    init();
  }, []);

  const loadLocalMovies = async (force = false) => {
    try {
      if (!window.electronAPI) {
        console.error('Electron API not available');
        return;
      }

      if (force) {
        console.log('🔄 Forced refresh: clearing movie cache');
        libraryCache.clearMovies();
      }

      setLoading(true);

      // Get the Videos folder path
      const videosPath = await window.electronAPI.getVideosPath();
      setVideosPath(videosPath);

      console.log('Videos path:', videosPath);

      // Look for Movies folder inside Videos (capitalized)
      const moviesFolderPath = `${videosPath.replace(/\\/g, '/')}/Movies`;

      console.log('Scanning movies folder:', moviesFolderPath);

      // Check if movies folder exists by trying to scan it
      let files: LocalMediaFile[] = [];
      try {
        files = await window.electronAPI.scanDirectory(moviesFolderPath);
        console.log('Total movie files found after recursive scan:', files.filter(f => f.type === 'file').length);
      } catch (error) {
        console.log('Error scanning Movies folder:', error);
        // Movies folder doesn't exist or can't be accessed
        setMovies([]);
        setLoading(false);
        return;
      }

      // Filter to only include files (directories are included in scan but we only want files for movies)
      files = files.filter(f => f.type === 'file');
      console.log('Files after filtering:', files.length, files.slice(0, 3));

      // Parse and filter for movies, then enrich with TMDB data
      const movieFiles = files
        .map(file => {
          const parsed = parseMediaFilename(file.name);
          console.log('Parsing file:', file.name, '->', parsed);
          return {
            file,
            parsed
          };
        })
        .filter(({ parsed }) => parsed.type === 'movie');

      // Enrich with TMDB data
      const enrichedMovies = await Promise.all(
        movieFiles.map(async ({ file, parsed }) => {
          try {
            // Check cache first
            const cached = libraryCache.getMovie(file.path);
            if (cached) {
              console.log('📦 Found in cache:', parsed.title);
              // Migrate/Verify images and get the potentially updated result
              const verified = await libraryCache.ensureImagesCached(file.path, 'movie');
              const finalItem = verified || cached;

              return {
                ...finalItem,
                local_path: file.path,
                modified_date: file.modified,
                file_size: file.size
              };
            }

            // Search TMDB for the movie
            console.log('Searching TMDB for:', parsed.title, 'year:', parsed.year);
            const searchResults = await searchMedia(parsed.title, 'movie', 1, parsed.year);
            const tmdbMovie = searchResults.results?.[0];

            if (tmdbMovie) {
              console.log('Found TMDB movie:', tmdbMovie.title, 'poster_path:', tmdbMovie.poster_path);
              // Convert genre_ids to genres array for display
              const genres = tmdbMovie.genre_ids ? convertGenreIdsToGenres(tmdbMovie.genre_ids) : [];

              // Get detailed TMDB data to get IMDb ID
              let imdbRating: string | null = null;
              let tmdbRuntime = null;
              try {
                const details = await getDetails('movie', tmdbMovie.id);
                if (details.imdb_id) {
                  console.log('Found IMDb ID:', details.imdb_id);
                  imdbRating = await getIMDbRating(details.imdb_id);
                  if (imdbRating) {
                    console.log('Found IMDb rating:', imdbRating);
                  }
                }
                // Get runtime from TMDB as fallback
                if (details.runtime) {
                  tmdbRuntime = details.runtime;
                  console.log('Found TMDB runtime:', tmdbRuntime);
                }
              } catch (error) {
                console.error('Error fetching IMDb data for:', parsed.title, error);
              }

              // Merge TMDB data with local file data
              const movieData = {
                ...tmdbMovie,
                genres, // Add converted genres
                imdb_id: undefined, // Will be set from details if available
                imdb_rating: imdbRating ? parseFloat(imdbRating) : undefined,
                imdb_votes: undefined,
                local_path: file.path,
                file_size: file.size,
                modified_date: file.modified,
                // Include locally extracted rating and duration, fallback to TMDB
                rating: parsed.rating,
                duration: parsed.duration || tmdbRuntime || undefined,
                // Keep TMDB data for posters, overview, etc.
              };

              // Save to cache
              await libraryCache.setMovie(file.path, movieData);

              return movieData;
            } else {
              console.log('No TMDB results for:', parsed.title);
              // Fallback to basic local data if no TMDB match
              return localFileToTMDBResult(file, parsed);
            }
          } catch (error) {
            console.error('Error fetching TMDB data for:', parsed.title, error);
            // Fallback to basic local data
            return localFileToTMDBResult(file, parsed);
          }
        })
      );

      // Group by TMDB ID to avoid duplicates (e.g. multiple versions of the same movie)
      const groupedMovies = new Map<number, TMDBResult>();
      for (const movieItem of enrichedMovies) {
        if (groupedMovies.has(movieItem.id)) {
          const existing = groupedMovies.get(movieItem.id)!;
          if (!existing.local_paths) existing.local_paths = [existing.local_path!];
          if (movieItem.local_path && !existing.local_paths.includes(movieItem.local_path)) {
            existing.local_paths.push(movieItem.local_path);
          }
        } else {
          movieItem.local_paths = [movieItem.local_path!];
          groupedMovies.set(movieItem.id, movieItem);
        }
      }

      console.log('Final enriched movies:', Array.from(groupedMovies.values()).map((m: TMDBResult) => ({
        title: m.title,
        poster_path: m.poster_path,
        hasPoster: !!m.poster_path,
        local_path: m.local_path,
        local_paths: m.local_paths
      })));

      setMovies(Array.from(groupedMovies.values()));
    } catch (error) {
      console.error('Error loading local movies:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayMovie = async (movie: TMDBResult) => {
    if (movie.local_path) {
      try {
        // Add to recently watched with poster path
        const posterPath = movie.local_poster_path || (movie.poster_path ? getImageUrl(movie.poster_path, 'w500') : undefined);
        const backdropPath = movie.local_backdrop_path || (movie.backdrop_path ? getBackdropUrl(movie.backdrop_path, 'w1280') : undefined);

        console.log('🎬 Playing movie:', movie.title);
        console.log('🎬 local_poster_path:', movie.local_poster_path);
        console.log('🎬 local_backdrop_path:', movie.local_backdrop_path);
        console.log('🎬 Final posterPath for recently watched:', posterPath);
        console.log('🎬 Final backdropPath for recently watched:', backdropPath);

        addRecentlyWatched({
          id: movie.id,
          title: movie.title || movie.name || 'Unknown',
          type: 'movie',
          path: movie.local_path,
          poster_path: posterPath,
          backdrop_path: backdropPath
        });
        await window.electronAPI?.openFile(movie.local_path);
      } catch (error) {
        console.error('Error opening movie file:', error);
      }
    }
  };



  // Get available genres from current movies
  const availableGenres = useMemo(() => {
    const genreSet = new Set<number>();
    movies.forEach(movie => {
      if (movie.genre_ids) {
        movie.genre_ids.forEach(id => genreSet.add(id));
      }
      if (movie.genres) {
        movie.genres.forEach(g => genreSet.add(g.id));
      }
    });
    return ALL_GENRES.filter(g => genreSet.has(g.id));
  }, [movies]);

  // Filter and sort movies
  const filteredMovies = useMemo(() => {
    let result = [...movies];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(movie =>
        (movie.title?.toLowerCase().includes(query)) ||
        (movie.name?.toLowerCase().includes(query)) ||
        (movie.overview?.toLowerCase().includes(query))
      );
    }

    // Genre filter
    if (selectedGenres.length > 0) {
      result = result.filter(movie => {
        const movieGenreIds = movie.genre_ids || movie.genres?.map(g => g.id) || [];
        return selectedGenres.some(id => movieGenreIds.includes(id));
      });
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return (a.title || a.name || '').localeCompare(b.title || b.name || '');
        case 'date': {
          const dateA = a.modified_date ? new Date(a.modified_date).getTime() : 0;
          const dateB = b.modified_date ? new Date(b.modified_date).getTime() : 0;
          return dateB - dateA; // Most recent first
        }
        case 'rating': {
          return (b.vote_average || 0) - (a.vote_average || 0);
        }
        case 'size':
          return (b.file_size || 0) - (a.file_size || 0);
        default:
          return 0;
      }
    });

    return result;
  }, [movies, searchQuery, selectedGenres, sortBy]);

  const toggleGenre = (genreId: number) => {
    setSelectedGenres(prev =>
      prev.includes(genreId)
        ? prev.filter(id => id !== genreId)
        : [...prev, genreId]
    );
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedGenres([]);
    setSortBy('title');
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
            <Film className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">My Films</h1>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
            <div className="text-white">Scanning your movie library...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] relative overflow-hidden">
      {/* Ambient Background Glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-red-900/10 rounded-full blur-[100px] pointer-events-none z-0" />

      <div className="p-6 md:p-8 relative z-10">
        <div className="max-w-[2400px] mx-auto space-y-8">

          {/* Header */}
          <div className="flex flex-col md:flex-row items-end justify-between gap-4 mb-8 relative">
            <div className="flex items-center gap-5">
              <div className="relative">
                <div className="absolute inset-0 bg-red-600/30 rounded-2xl blur-xl"></div>
                <div className="relative w-16 h-16 bg-gradient-to-br from-red-600 to-red-900 rounded-2xl flex items-center justify-center shadow-2xl shadow-red-900/40">
                  <Film className="h-8 w-8 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-5xl font-bold text-white tracking-tight bg-gradient-to-r from-white to-gray-300 bg-clip-text">
                  My Films
                </h1>
                <p className="text-gray-400 mt-2 text-lg flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block"></span>
                  {movies.length} titles in library
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-xs font-semibold text-gray-400 bg-white/5 px-4 py-2 rounded-full border border-white/5 backdrop-blur-md">
                {filteredMovies.length} shown
              </div>
              <button
                onClick={() => loadLocalMovies(true)}
                className="p-3 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/5 transition-all hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] active:scale-95 group backdrop-blur-sm"
                title="Refresh Library (Force Re-scan)"
              >
                <RefreshCw className="h-5 w-5 group-hover:rotate-180 transition-transform duration-700" />
              </button>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="sticky top-[80px] z-30 transition-all duration-300">
            <div className="absolute inset-0 bg-red-900/5 blur-xl -z-10 rounded-3xl"></div>
            <div className="bg-[#0f0f0f]/80 rounded-2xl border border-white/10 p-2 backdrop-blur-xl shadow-2xl flex flex-col md:flex-row gap-3">
              {/* Search */}
              <div className="flex-1 relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 to-transparent opacity-0 group-focus-within:opacity-100 transition-opacity duration-500 rounded-xl pointer-events-none"></div>
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-500 group-focus-within:text-red-500 transition-colors" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search collection..."
                  className="w-full pl-12 pr-10 py-3.5 bg-transparent border-transparent rounded-xl text-white placeholder-gray-500 focus:outline-none focus:bg-white/5 transition-all font-medium"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-1 hover:bg-white/10 rounded-full transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Controls */}
              <div className="flex gap-2">
                <div className="relative min-w-[140px]">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="w-full h-full appearance-none pl-4 pr-10 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-white focus:outline-none cursor-pointer text-sm font-medium transition-colors"
                  >
                    <option value="title" className="bg-gray-900">Title A-Z</option>
                    <option value="date" className="bg-gray-900">Date Added</option>
                    <option value="rating" className="bg-gray-900">Rating</option>
                    <option value="size" className="bg-gray-900">File Size</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                </div>

                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`px-5 rounded-xl border flex items-center gap-2 font-medium whitespace-nowrap transition-all text-sm ${showFilters || selectedGenres.length > 0
                    ? 'bg-red-600/20 border-red-500/30 text-red-500 shadow-[0_0_15px_rgba(220,38,38,0.2)]'
                    : 'bg-white/5 border-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
                    }`}
                >
                  <Filter className="h-4 w-4" />
                  <span>Filters</span>
                  {selectedGenres.length > 0 && (
                    <span className="w-5 h-5 flex items-center justify-center bg-red-500 text-white text-[10px] rounded-full ml-1 font-bold">
                      {selectedGenres.length}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Expanded Filters */}
            {showFilters && (
              <div className="mt-4 pt-4 border-t border-white/5 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-gray-400 text-sm font-medium">Filter by Genre</h3>
                  {(selectedGenres.length > 0) && (
                    <button onClick={clearFilters} className="text-xs text-red-400 hover:text-red-300">
                      Clear all
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {availableGenres.map(genre => (
                    <button
                      key={genre.id}
                      onClick={() => toggleGenre(genre.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${selectedGenres.includes(genre.id)
                        ? 'bg-red-600 text-white shadow-lg shadow-red-600/20'
                        : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                        }`}
                    >
                      {genre.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {movies.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-96 text-center">
              <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mb-6">
                <Film className="h-8 w-8 text-gray-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">No movies found</h2>
              <p className="text-gray-400 mb-6 max-w-md">
                We couldn't find any movie files in your Videos/Movies folder.
              </p>
              <div className="bg-gray-900/50 p-4 rounded-xl border border-white/5 mb-6">
                <code className="text-green-400 font-mono text-sm">
                  {videosPath}/Movies
                </code>
              </div>
              <button
                onClick={() => loadLocalMovies(true)}
                className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors flex items-center gap-2 font-medium"
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </button>
            </div>
          ) : filteredMovies.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Search className="h-12 w-12 text-gray-600 mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">No matches found</h2>
              <p className="text-gray-400 mb-4">
                Try adjusting your search or filters
              </p>
              <button
                onClick={clearFilters}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-6 pb-20">
              {filteredMovies.map((movie) => (
                <div
                  key={movie.id}
                  className="bg-[#18181b] rounded-2xl overflow-hidden hover:scale-105 transition-all duration-300 cursor-pointer group shadow-lg ring-1 ring-white/5 hover:ring-red-500/50 flex flex-col"
                  onClick={() => {
                    setSelectedMovie(movie);
                    setIsModalOpen(true);
                  }}
                >
                  {/* Movie poster */}
                  <div className="aspect-[2/3] relative overflow-hidden bg-gray-900">
                    {movie.local_poster_path || movie.poster_path ? (
                      <img
                        src={movie.local_poster_path || getImageUrl(movie.poster_path, 'w500')}
                        alt={movie.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-center p-4">
                        <FileVideo className="h-12 w-12 text-gray-700 mb-2" />
                        <p className="text-sm text-gray-500 font-medium line-clamp-2">
                          {movie.title}
                        </p>
                      </div>
                    )}

                    {/* Rating Badge (Top Right) */}
                    {movie.vote_average > 0 && (
                      <div className="absolute top-3 right-3 bg-black/80 backdrop-blur-md px-2 py-1 rounded-lg text-xs text-yellow-500 font-bold border border-white/10 flex items-center gap-1">
                        <svg className="w-3 h-3 fill-current" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        {movie.vote_average.toFixed(1)}
                      </div>
                    )}
                  </div>

                  {/* Movie info */}
                  <div className="p-4 flex flex-col flex-1">
                    <h3 className="text-white font-bold text-base md:text-lg mb-2 leading-snug" title={movie.title}>
                      {movie.title}
                    </h3>

                    <div className="flex items-center justify-between mb-3 text-sm text-gray-400 font-medium">
                      <span className="bg-gray-800 px-2 py-0.5 rounded text-gray-300">
                        {movie.release_date ? new Date(movie.release_date).getFullYear() : 'Unknown'}
                      </span>

                      {/* Format (e.g. MKV) */}
                      {movie.file_path && (
                        <span className="uppercase text-xs font-bold text-gray-500 bg-gray-900/50 px-1.5 py-0.5 rounded border border-white/5">
                          {movie.file_path.split('.').pop()}
                        </span>
                      )}
                    </div>

                    {/* Genres */}
                    {movie.genres && movie.genres.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-auto">
                        {movie.genres.slice(0, 2).map(genre => (
                          <span
                            key={genre.id}
                            className="px-3 py-1 bg-gray-800 rounded-full text-[10px] font-semibold text-gray-400 uppercase tracking-wide border border-white/5"
                          >
                            {genre.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Details Modal */}
          <DetailsModal
            item={selectedMovie}
            isOpen={isModalOpen}
            onClose={() => {
              setIsModalOpen(false);
              setSelectedMovie(null);
            }}
            onPlay={handlePlayMovie}
            hideSimilar={true}
          />
        </div>
      </div>
    </div>
  );
};

export default LocalMovies;
