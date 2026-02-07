import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import HeroCarousel from '../components/media/HeroCarousel';
import MediaRow from '../components/media/MediaRow';
import DetailsModal from '../components/media/DetailsModal';
import { TMDBResult, DiscoverParams, Episode } from '../types/media';
import { getTrending, getLogos, getDiscover, getCredits, getByStreamingProvider } from '../api/tmdb';
import { getRecentlyWatched, addRecentlyWatched } from '../utils/recentlyWatched';
import { getImageUrl } from '../api/tmdb';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import NoInternetConnection from '../components/offline/NoInternetConnection';

const Home: React.FC<{ isActive?: boolean }> = ({ isActive = true }) => {
  const [trendingMovies, setTrendingMovies] = useState<TMDBResult[]>([]);
  const [trendingTV, setTrendingTV] = useState<TMDBResult[]>([]);
  const [actionMovies, setActionMovies] = useState<TMDBResult[]>([]);
  const [comedyMovies, setComedyMovies] = useState<TMDBResult[]>([]);
  const [dramaMovies, setDramaMovies] = useState<TMDBResult[]>([]);
  const [horrorMovies, setHorrorMovies] = useState<TMDBResult[]>([]);
  const [scifiMovies, setScifiMovies] = useState<TMDBResult[]>([]);
  const [romanceMovies, setRomanceMovies] = useState<TMDBResult[]>([]);
  const [thrillerMovies, setThrillerMovies] = useState<TMDBResult[]>([]);
  const [animationMovies, setAnimationMovies] = useState<TMDBResult[]>([]);
  const [adventureMovies, setAdventureMovies] = useState<TMDBResult[]>([]);
  const [fantasyMovies, setFantasyMovies] = useState<TMDBResult[]>([]);
  const [crimeMovies, setCrimeMovies] = useState<TMDBResult[]>([]);
  const [familyMovies, setFamilyMovies] = useState<TMDBResult[]>([]);
  const [warMovies, setWarMovies] = useState<TMDBResult[]>([]);
  const [musicMovies, setMusicMovies] = useState<TMDBResult[]>([]);
  const [documentaryMovies, setDocumentaryMovies] = useState<TMDBResult[]>([]);
  const [westernMovies, setWesternMovies] = useState<TMDBResult[]>([]);
  const [actionTV, setActionTV] = useState<TMDBResult[]>([]);
  const [animationTV, setAnimationTV] = useState<TMDBResult[]>([]);
  const [animeTV, setAnimeTV] = useState<TMDBResult[]>([]);
  const [comedyTV, setComedyTV] = useState<TMDBResult[]>([]);
  const [crimeTV, setCrimeTV] = useState<TMDBResult[]>([]);
  const [documentaryTV, setDocumentaryTV] = useState<TMDBResult[]>([]);
  const [dramaTV, setDramaTV] = useState<TMDBResult[]>([]);
  const [familyTV, setFamilyTV] = useState<TMDBResult[]>([]);
  const [mysteryTV, setMysteryTV] = useState<TMDBResult[]>([]);
  const [scifiTV, setScifiTV] = useState<TMDBResult[]>([]);
  const [talkTV, setTalkTV] = useState<TMDBResult[]>([]);
  const [westernTV, setWesternTV] = useState<TMDBResult[]>([]);
  const [realityTV, setRealityTV] = useState<TMDBResult[]>([]);
  const [newsTV, setNewsTV] = useState<TMDBResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<TMDBResult | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [autoPlayTrailer, setAutoPlayTrailer] = useState(false);
  const { isOnline, retry } = useNetworkStatus();
  
  // Streaming service sections for Movies
  const [netflixMovies, setNetflixMovies] = useState<TMDBResult[]>([]);
  const [amazonPrimeMovies, setAmazonPrimeMovies] = useState<TMDBResult[]>([]);
  const [huluMovies, setHuluMovies] = useState<TMDBResult[]>([]);
  const [disneyPlusMovies, setDisneyPlusMovies] = useState<TMDBResult[]>([]);
  const [maxMovies, setMaxMovies] = useState<TMDBResult[]>([]);
  const [paramountPlusMovies, setParamountPlusMovies] = useState<TMDBResult[]>([]);
  const [appleTvMovies, setAppleTvMovies] = useState<TMDBResult[]>([]);
  const [cwMovies, setCwMovies] = useState<TMDBResult[]>([]);
  
  // Streaming service sections for TV
  const [netflixTV, setNetflixTV] = useState<TMDBResult[]>([]);
  const [amazonPrimeTV, setAmazonPrimeTV] = useState<TMDBResult[]>([]);
  const [huluTV, setHuluTV] = useState<TMDBResult[]>([]);
  const [disneyPlusTV, setDisneyPlusTV] = useState<TMDBResult[]>([]);
  const [maxTV, setMaxTV] = useState<TMDBResult[]>([]);
  const [paramountPlusTV, setParamountPlusTV] = useState<TMDBResult[]>([]);
  const [appleTvTV, setAppleTvTV] = useState<TMDBResult[]>([]);
  const [cwTV, setCwTV] = useState<TMDBResult[]>([]);
  const [activeTab, setActiveTab] = useState<'movies' | 'tv' | string>(() => {
    // Always try to read from localStorage on initialization
    try {
      const saved = localStorage.getItem('homeActiveTab');
      console.log('Initializing activeTab from localStorage:', saved);
      if (saved === 'tv') {
        return 'tv';
      }
      return 'movies'; // Default to movies
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return 'movies';
    }
  });

  // Save activeTab to localStorage whenever it changes
  useEffect(() => {
    try {
      console.log('Saving activeTab to localStorage:', activeTab);
      localStorage.setItem('homeActiveTab', activeTab);
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  }, [activeTab]);
  const [shownMovies, setShownMovies] = useState<Set<number>>(new Set());
  const [carouselItems, setCarouselItems] = useState<TMDBResult[]>([]);
  const [tvCarouselItems, setTvCarouselItems] = useState<TMDBResult[]>([]);
  const [recentlyWatched, setRecentlyWatched] = useState<TMDBResult[]>([]);

  const fetchData = async (isRefresh = false) => {
    // Don't fetch if we already have data and it's not a refresh
    if (!isRefresh && trendingMovies.length > 0 && trendingTV.length > 0) {
      return;
    }

    if (isRefresh) setRefreshing(true);
    try {
      // Use different time windows for refresh to get different content
      const timeWindow = isRefresh ? 'day' : 'week';

      // Helper to fetch multiple pages for a genre
      const fetchGenrePages = async (type: 'movie' | 'tv', genreId: string, pages: number = 3, extraParams: Partial<DiscoverParams> = {}, isRefresh = false) => {
        const promises = [];
        // Use random start page for initial load to get different content
        const startPage = isRefresh ? Math.floor(Math.random() * 10) + 1 : Math.floor(Math.random() * 5) + 1;
        for (let i = 0; i < pages; i++) {
          const page = startPage + i;
          promises.push(getDiscover(type, { genre: genreId, page, region: 'US', ...extraParams }));
        }
        const results = await Promise.all(promises);
        const flattened = results.flat();
        // Remove duplicates within the genre
        const seen = new Set<number>();
        return flattened.filter(item => {
          if (seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        });
      };

      const [
        trendingMoviesData,
        trendingTVData,
        actionMoviesData,
        comedyMoviesData,
        dramaMoviesData,
        horrorMoviesData,
        scifiMoviesData,
        romanceMoviesData,
        thrillerMoviesData,
        animationMoviesData,
        adventureMoviesData,
        fantasyMoviesData,
        crimeMoviesData,
        familyMoviesData,
        warMoviesData,
        musicMoviesData,
        documentaryMoviesData,
        westernMoviesData,
        actionTVData,
        animationTVData,
        animeTVData,
        comedyTVData,
        crimeTVData,
        documentaryTVData,
        dramaTVData,
        familyTVData,
        mysteryTVData,
        scifiTVData,
        talkTVData,
        westernTVData,
        realityTVData,
        newsTVData,
        // Streaming services - Movies
        netflixMoviesData,
        amazonPrimeMoviesData,
        huluMoviesData,
        disneyPlusMoviesData,
        maxMoviesData,
        paramountPlusMoviesData,
        appleTvMoviesData,
        cwMoviesData,
        // Streaming services - TV
        netflixTVData,
        amazonPrimeTVData,
        huluTVData,
        disneyPlusTVData,
        maxTVData,
        paramountPlusTVData,
        appleTvTVData,
        cwTVData
      ] = await Promise.all([
        getTrending('movie', timeWindow, 'US'),
        getTrending('tv', timeWindow, 'US'),
        fetchGenrePages('movie', '28', 3, {}, isRefresh),
        fetchGenrePages('movie', '35', 3, {}, isRefresh),
        fetchGenrePages('movie', '18', 3, {}, isRefresh),
        fetchGenrePages('movie', '27', 3, {}, isRefresh),
        fetchGenrePages('movie', '878', 3, {}, isRefresh),
        fetchGenrePages('movie', '10749', 3, {}, isRefresh),
        fetchGenrePages('movie', '53', 3, {}, isRefresh),
        fetchGenrePages('movie', '16', 3, {}, isRefresh),
        fetchGenrePages('movie', '12', 3, {}, isRefresh),
        fetchGenrePages('movie', '14', 3, {}, isRefresh),
        fetchGenrePages('movie', '80', 3, {}, isRefresh),
        fetchGenrePages('movie', '10751', 3, {}, isRefresh), // Family
        fetchGenrePages('movie', '10752', 3, {}, isRefresh), // War
        fetchGenrePages('movie', '10402', 3, {}, isRefresh), // Music
        fetchGenrePages('movie', '99', 3, {}, isRefresh), // Documentary
        fetchGenrePages('movie', '37', 3, {}, isRefresh), // Western
        fetchGenrePages('tv', '10759', 3, {}, isRefresh),
        fetchGenrePages('tv', '16', 3, {}, isRefresh),
        fetchGenrePages('tv', '16', 3, { origin_country: 'JP' }, isRefresh), // Anime
        fetchGenrePages('tv', '35', 3, {}, isRefresh),
        fetchGenrePages('tv', '80', 3, {}, isRefresh),
        fetchGenrePages('tv', '99', 3, {}, isRefresh),
        fetchGenrePages('tv', '18', 3, {}, isRefresh),
        fetchGenrePages('tv', '10751', 3, {}, isRefresh),
        fetchGenrePages('tv', '9648', 3, {}, isRefresh),
        fetchGenrePages('tv', '10765', 3, {}, isRefresh),
        fetchGenrePages('tv', '10767', 3, {}, isRefresh),
        fetchGenrePages('tv', '37', 3, {}, isRefresh),
        fetchGenrePages('tv', '10764', 3, {}, isRefresh), // Reality
        fetchGenrePages('tv', '10763', 3, {}, isRefresh), // News
        // Streaming services - Movies
        getByStreamingProvider('movie', 'netflix', { page: 1, sort_by: 'popularity.desc' }),
        getByStreamingProvider('movie', 'amazon_prime', { page: 1, sort_by: 'popularity.desc' }),
        getByStreamingProvider('movie', 'hulu', { page: 1, sort_by: 'popularity.desc' }),
        getByStreamingProvider('movie', 'disney_plus', { page: 1, sort_by: 'popularity.desc' }),
        getByStreamingProvider('movie', 'max', { page: 1, sort_by: 'popularity.desc' }),
        getByStreamingProvider('movie', 'paramount_plus', { page: 1, sort_by: 'popularity.desc' }),
        getByStreamingProvider('movie', 'apple_tv', { page: 1, sort_by: 'popularity.desc' }),
        getByStreamingProvider('movie', 'cw', { page: 1, sort_by: 'popularity.desc' }),
        // Streaming services - TV
        getByStreamingProvider('tv', 'netflix', { page: 1, sort_by: 'popularity.desc' }),
        getByStreamingProvider('tv', 'amazon_prime', { page: 1, sort_by: 'popularity.desc' }),
        getByStreamingProvider('tv', 'hulu', { page: 1, sort_by: 'popularity.desc' }),
        getByStreamingProvider('tv', 'disney_plus', { page: 1, sort_by: 'popularity.desc' }),
        getByStreamingProvider('tv', 'max', { page: 1, sort_by: 'popularity.desc' }),
        getByStreamingProvider('tv', 'paramount_plus', { page: 1, sort_by: 'popularity.desc' }),
        getByStreamingProvider('tv', 'apple_tv', { page: 1, sort_by: 'popularity.desc' }),
        getByStreamingProvider('tv', 'cw', { page: 1, sort_by: 'popularity.desc' })
      ]);

      console.log('Fetched trending movies sample:', trendingMoviesData.slice(0, 3));
      console.log('Sample movie poster paths:', trendingMoviesData.slice(0, 3).map(m => ({ title: m.title, poster_path: m.poster_path })));

      // Filter out previously shown movies for carousel
      if (isRefresh) {
        setShownMovies(new Set()); // Reset on refresh to allow showing previously seen movies
      }

      // Create final trending movies array first (this will be used for both carousel and MediaRow)
      const allTrendingMovies = isRefresh ? [...trendingMoviesData].sort(() => Math.random() - 0.5) : trendingMoviesData;

      // Fetch logos for carousel movies (take first 5 from trending)
      const carouselMovies = allTrendingMovies.slice(0, 5);
      const trendingWithLogos = await Promise.all(
        carouselMovies.map(async (movie) => {
          try {
            const [logos, credits] = await Promise.all([
              getLogos(movie.id, 'movie'),
              getCredits('movie', movie.id)
            ]);
            const englishLogo = logos.find(logo => logo.iso_639_1 === 'en' || logo.iso_639_1 === null);
            return {
              ...movie,
              logo_path: englishLogo?.file_path || logos[0]?.file_path,
              credits
            };
          } catch (error) {
            console.error(`Error fetching data for ${movie.title}:`, error);
            return movie;
          }
        })
      );

      // Create final trending movies array (carousel movies with logos + remaining trending movies)
      const finalTrendingMovies = [
        ...trendingWithLogos,
        ...allTrendingMovies.slice(5) // Add remaining trending movies after carousel ones
      ];

      // Update shown movies set
      const newShownIds = new Set(shownMovies);
      carouselMovies.forEach(movie => newShownIds.add(movie.id));
      setShownMovies(newShownIds);

      setTrendingMovies(finalTrendingMovies);

      // Create final trending TV (similar to movies, but without logos since TV shows don't have them)
      const finalTrendingTV = isRefresh ? [...trendingTVData].sort(() => Math.random() - 0.5) : trendingTVData;
      setTrendingTV(finalTrendingTV);

      // Global deduplication: First collect all trending/top-rated IDs
      const usedMovieIds = new Set<number>();
      const usedTVIds = new Set<number>();

      // Add trending movies IDs
      finalTrendingMovies.forEach(movie => usedMovieIds.add(movie.id));

      // Add trending TV IDs
      finalTrendingTV.forEach(tv => usedTVIds.add(tv.id));

      // Now process genre sections with global deduplication
      const processGenre = (data: TMDBResult[]) => {
        const filtered = data.filter(item => !usedMovieIds.has(item.id));
        const selected = filtered.slice(0, Math.max(16, Math.min(20, filtered.length)));
        selected.forEach(item => usedMovieIds.add(item.id));
        return isRefresh ? selected.sort(() => Math.random() - 0.5) : selected;
      };

      const processTVGenre = (data: TMDBResult[]) => {
        const filtered = data.filter(item => !usedTVIds.has(item.id));
        const selected = filtered.slice(0, Math.max(16, Math.min(20, filtered.length)));
        selected.forEach(item => usedTVIds.add(item.id));
        return isRefresh ? selected.sort(() => Math.random() - 0.5) : selected;
      };

      setActionMovies(processGenre(actionMoviesData));
      setComedyMovies(processGenre(comedyMoviesData));
      setDramaMovies(processGenre(dramaMoviesData));
      setHorrorMovies(processGenre(horrorMoviesData));
      setScifiMovies(processGenre(scifiMoviesData));
      setRomanceMovies(processGenre(romanceMoviesData));
      setThrillerMovies(processGenre(thrillerMoviesData));
      setAnimationMovies(processGenre(animationMoviesData));
      setAdventureMovies(processGenre(adventureMoviesData));
      setFantasyMovies(processGenre(fantasyMoviesData));
      setCrimeMovies(processGenre(crimeMoviesData));
      setFamilyMovies(processGenre(familyMoviesData));
      setWarMovies(processGenre(warMoviesData));
      setMusicMovies(processGenre(musicMoviesData));
      setDocumentaryMovies(processGenre(documentaryMoviesData));
      setWesternMovies(processGenre(westernMoviesData));

      setActionTV(processTVGenre(actionTVData));
      setAnimationTV(processTVGenre(animationTVData));
      setAnimeTV(processTVGenre(animeTVData));
      setComedyTV(processTVGenre(comedyTVData));
      setCrimeTV(processTVGenre(crimeTVData));
      setDocumentaryTV(processTVGenre(documentaryTVData));
      setDramaTV(processTVGenre(dramaTVData));
      setFamilyTV(processTVGenre(familyTVData));
      setMysteryTV(processTVGenre(mysteryTVData));
      setScifiTV(processTVGenre(scifiTVData));
      setTalkTV(processTVGenre(talkTVData));
      setWesternTV(processTVGenre(westernTVData));
      setRealityTV(processTVGenre(realityTVData));
      setNewsTV(processTVGenre(newsTVData));

      // Set streaming service movies
      setNetflixMovies(processGenre(netflixMoviesData));
      setAmazonPrimeMovies(processGenre(amazonPrimeMoviesData));
      setHuluMovies(processGenre(huluMoviesData));
      setDisneyPlusMovies(processGenre(disneyPlusMoviesData));
      setMaxMovies(processGenre(maxMoviesData));
      setParamountPlusMovies(processGenre(paramountPlusMoviesData));
      setAppleTvMovies(processGenre(appleTvMoviesData));
      setCwMovies(processGenre(cwMoviesData));

      // Set streaming service TV
      setNetflixTV(processTVGenre(netflixTVData));
      setAmazonPrimeTV(processTVGenre(amazonPrimeTVData));
      setHuluTV(processTVGenre(huluTVData));
      setDisneyPlusTV(processTVGenre(disneyPlusTVData));
      setMaxTV(processTVGenre(maxTVData));
      setParamountPlusTV(processTVGenre(paramountPlusTVData));
      setAppleTvTV(processTVGenre(appleTvTVData));
      setCwTV(processTVGenre(cwTVData));

      // Initialize carousels with trending items strictly
      const initialCarouselMovies = finalTrendingMovies.slice(0, 5);
      setCarouselItems(initialCarouselMovies);

      const carouselTVRaw = finalTrendingTV.slice(0, 5);

      // Fetch logos and credits for TV carousel items
      const carouselTV = await Promise.all(
        carouselTVRaw.map(async (tv) => {
          try {
            const [logos, credits] = await Promise.all([
              getLogos(tv.id, 'tv'),
              getCredits('tv', tv.id)
            ]);
            const englishLogo = logos.find(logo => logo.iso_639_1 === 'en' || logo.iso_639_1 === null);
            return {
              ...tv,
              logo_path: englishLogo?.file_path || logos[0]?.file_path,
              credits
            };
          } catch (error) {
            console.error(`Error fetching data for ${tv.name}:`, error);
            return tv;
          }
        })
      );

      setTvCarouselItems(carouselTV);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  };

  const loadRecentlyWatched = () => {
    const items = getRecentlyWatched();
    // Map to TMDBResult structure for MediaRow
    const mapped: TMDBResult[] = items.map(item => ({
      id: typeof item.id === 'string' ? Math.floor(Math.random() * 1000000) : item.id, // Ensure numeric ID for stability
      title: item.title,
      overview: item.type === 'episode' ? `Season ${item.season} Episode ${item.episode}` : '',
      poster_path: item.poster_path || null,
      backdrop_path: item.backdrop_path || null,
      still_path: item.still_path,
      // Pass local paths explicitly for MediaCard
      local_poster_path: item.poster_path,
      local_backdrop_path: item.backdrop_path,
      local_still_path: item.still_path,
      media_type: item.type === 'episode' ? 'tv' : item.type as any,
      vote_average: 0,
      vote_count: 0,
      genre_ids: [],
      original_language: 'en',
      popularity: 0,
      local_path: item.path,
      season: item.season,
      episode: item.episode,
      progress: item.progress // Map progress from history
    }));
    setRecentlyWatched(mapped);
  };

  useEffect(() => {
    loadRecentlyWatched();
    const handler = () => loadRecentlyWatched();
    window.addEventListener('recently-watched-updated', handler);
    return () => window.removeEventListener('recently-watched-updated', handler);
  }, []);

  useEffect(() => {
    // Initial fetch only on first mount
    fetchData();

    // Set up intervals that only run when active
    let refreshInterval: NodeJS.Timeout | null = null;
    let carouselInterval: NodeJS.Timeout | null = null;

    const setupIntervals = () => {
      if (isActive) {
        // Set up interval to refresh trending movies every 8 minutes
        refreshInterval = setInterval(() => fetchData(), 8 * 60 * 1000); // 8 minutes

        // Set up interval to rotate carousel every 5 minutes
        carouselInterval = setInterval(() => {
          rotateCarousel();
          rotateTvCarousel();
        }, 5 * 60 * 1000); // 5 minutes
      }
    };

    const clearIntervals = () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
      }
      if (carouselInterval) {
        clearInterval(carouselInterval);
        carouselInterval = null;
      }
    };

    if (isActive) {
      setupIntervals();
    }

    return () => {
      clearIntervals();
    };
  }, []); // Only run on mount

  // Auto-load when component mounts
  useEffect(() => {
    if (trendingMovies.length === 0) {
      fetchData();
    }
  }, [trendingMovies.length]);

  // Handle active state changes
  useEffect(() => {
    let refreshInterval: NodeJS.Timeout | null = null;
    let carouselInterval: NodeJS.Timeout | null = null;

    const setupIntervals = () => {
      // Set up interval to refresh trending movies every 8 minutes
      refreshInterval = setInterval(() => fetchData(), 8 * 60 * 1000); // 8 minutes

      // Set up interval to rotate carousel every 5 minutes
      carouselInterval = setInterval(() => {
        rotateCarousel();
        rotateTvCarousel();
      }, 5 * 60 * 1000); // 5 minutes
    };

    const clearIntervals = () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
      }
      if (carouselInterval) {
        clearInterval(carouselInterval);
        carouselInterval = null;
      }
    };

    if (isActive) {
      setupIntervals();
    } else {
      clearIntervals();
    }

    return () => {
      clearIntervals();
    };
  }, [isActive]);

  const handlePlay = (item: TMDBResult | Episode) => {
    // Check if it's an episode with a file path
    if ('file_path' in item && item.file_path) {
      // Play the episode file directly
      if (window.electronAPI?.openFile) {
        // Find parent series if possible for metadata
        const seriesTitle = (item as any).seriesTitle || (selectedItem?.name || selectedItem?.title || 'Unknown Series');

        addRecentlyWatched({
          id: item.file_path,
          title: `${seriesTitle} - ${item.title}`,
          type: 'episode',
          path: item.file_path,
          season: item.season,
          episode: item.episode,
          poster_path: selectedItem?.local_poster_path || (selectedItem?.poster_path ? getImageUrl(selectedItem.poster_path, 'w500') : undefined),
          backdrop_path: selectedItem?.local_backdrop_path || (selectedItem?.backdrop_path ? getImageUrl(selectedItem.backdrop_path, 'original') : undefined),
          still_path: (item as any).local_still_path || (item as any).still_path
        });

        window.electronAPI.openFile(item.file_path, item.progress);
      } else {
        console.log('Play episode file:', item.file_path);
      }
    } else if ('local_path' in item && item.local_path) {
      // For series/movies with local path, add to recently watched and open
      const posterPath = item.local_poster_path || (item.poster_path ? getImageUrl(item.poster_path, 'w500') : undefined);
      const backdropPath = item.local_backdrop_path || (item.backdrop_path ? getImageUrl(item.backdrop_path, 'original') : undefined);

      addRecentlyWatched({
        id: item.id,
        title: item.title || item.name || 'Unknown',
        type: (item.first_air_date || item.media_type === 'tv') ? 'tv' : 'movie',
        path: item.local_path,
        poster_path: posterPath,
        backdrop_path: backdropPath
      });

      if (window.electronAPI?.openFile) {
        window.electronAPI.openFile(item.local_path, item.progress);
      }
    } else {
      // For TMDB items without local files, open modal with trailer
      setSelectedItem(item as TMDBResult);
      setAutoPlayTrailer(true);
      setIsModalOpen(true);
      console.log('Play movie/show:', (item as TMDBResult).title || (item as TMDBResult).name);
    }
  };

  const handleMoreInfo = (item: TMDBResult) => {
    setSelectedItem(item);
    setAutoPlayTrailer(false);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedItem(null);
    setAutoPlayTrailer(false);
  };

  const rotateCarousel = () => {
    if (trendingMovies.length === 0) return;

    // Get movies not shown in current carousel
    const availableMovies = trendingMovies.filter(movie => !carouselItems.some(ci => ci.id === movie.id));

    if (availableMovies.length >= 5) {
      // Take next 5 movies
      const nextCarousel = availableMovies.slice(0, 5);
      setCarouselItems(nextCarousel);
    } else {
      // If not enough new movies, reset and take first 5 (excluding current)
      const resetMovies = trendingMovies.filter(movie => !carouselItems.some(ci => ci.id === movie.id));
      const nextCarousel = resetMovies.slice(0, 5);
      setCarouselItems(nextCarousel);
    }
  };

  const rotateTvCarousel = () => {
    if (trendingTV.length === 0) return;

    // Get TV shows not shown in current carousel
    const availableTV = trendingTV.filter(tv => !tvCarouselItems.some(ci => ci.id === tv.id));

    if (availableTV.length >= 5) {
      // Take next 5 TV shows
      const nextCarousel = availableTV.slice(0, 5);
      setTvCarouselItems(nextCarousel);
    } else {
      // If not enough new TV shows, reset and take first 5 (excluding current)
      const resetTV = trendingTV.filter(tv => !tvCarouselItems.some(ci => ci.id === tv.id));
      const nextCarousel = resetTV.slice(0, 5);
      setTvCarouselItems(nextCarousel);
    }
  };

  const handleRefresh = () => {
    fetchData(true);
    // Also rotate carousels when refresh is clicked
    rotateCarousel();
    rotateTvCarousel();
  };

  // Show offline page if not connected
  if (!isOnline) {
    return <NoInternetConnection onRetry={retry} />;
  }

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen scrollbar-custom">
      {/* Refresh Button */}
      {/* Refresh Button */}
      <div className="fixed right-4 z-40" style={{ top: 'calc(var(--titlebar-height) + 16px)' }}>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-3 bg-gray-800/80 hover:bg-gray-700/80 rounded-full text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Refresh content"
        >
          <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {activeTab === 'movies' ? (
        <>
          <HeroCarousel
            items={carouselItems}
            onPlay={handlePlay}
            onMoreInfo={handleMoreInfo}
          />


          {/* Content Tabs - After Carousel */}
          <div className="px-8 md:px-16 py-4">
            <div className="flex justify-center">
              <div className="flex bg-gray-800/90 rounded-lg p-1">
                <button
                  onClick={() => setActiveTab('movies')}
                  className={`px-6 py-3 rounded-md text-sm font-medium transition-colors ${activeTab === 'movies'
                    ? 'bg-netflix-red text-white'
                    : 'text-gray-300 hover:text-white'
                    }`}
                >
                  Movies
                </button>
                <button
                  onClick={() => setActiveTab('tv')}
                  className={`px-6 py-3 rounded-md text-sm font-medium transition-colors ${(activeTab as string) === 'tv'
                    ? 'bg-netflix-red text-white'
                    : 'text-gray-300 hover:text-white'
                    }`}
                >
                  TV Shows
                </button>
              </div>
            </div>
          </div>

          <div className="px-8 md:px-16 py-8 space-y-8">
            {recentlyWatched.length > 0 && (
              <MediaRow
                title="Continue Watching"
                items={recentlyWatched}
                onCardClick={handleMoreInfo}
                onPlay={handlePlay}
                aspect="poster"
              />
            )}

            <MediaRow
              title="Trending Movies"
              items={trendingMovies}
              onCardClick={handleMoreInfo}
              onPlay={handlePlay}
            />

            <MediaRow
              title="Family Favorites"
              items={familyMovies}
              onCardClick={handleMoreInfo}
              onPlay={handlePlay}
            />

            <MediaRow
              title="Action-Packed Adventures"
              items={actionMovies}
              onCardClick={handleMoreInfo}
              onPlay={handlePlay}
            />

            <MediaRow
              title="Side-Splitting Comedies"
              items={comedyMovies}
              onCardClick={handleMoreInfo}
              onPlay={handlePlay}
            />

            <MediaRow
              title="Heartfelt Dramas"
              items={dramaMovies}
              onCardClick={handleMoreInfo}
              onPlay={handlePlay}
            />

            <MediaRow
              title="Spine-Chilling Horrors"
              items={horrorMovies}
              onCardClick={handleMoreInfo}
              onPlay={handlePlay}
            />

            <MediaRow
              title="Mind-Bending Sci-Fi"
              items={scifiMovies}
              onCardClick={handleMoreInfo}
              onPlay={handlePlay}
            />

            <MediaRow
              title="Romantic Love Stories"
              items={romanceMovies}
              onCardClick={handleMoreInfo}
              onPlay={handlePlay}
            />

            <MediaRow
              title="Edge-of-Your-Seat Thrillers"
              items={thrillerMovies}
              onCardClick={handleMoreInfo}
              onPlay={handlePlay}
            />

            <MediaRow
              title="Animated Wonders"
              items={animationMovies}
              onCardClick={handleMoreInfo}
              onPlay={handlePlay}
            />

            <MediaRow
              title="Epic Adventures"
              items={adventureMovies}
              onCardClick={handleMoreInfo}
              onPlay={handlePlay}
            />

            <MediaRow
              title="Magical Fantasy Worlds"
              items={fantasyMovies}
              onCardClick={handleMoreInfo}
              onPlay={handlePlay}
            />

            <MediaRow
              title="Crime & Mystery"
              items={crimeMovies}
              onCardClick={handleMoreInfo}
              onPlay={handlePlay}
            />

            <MediaRow
              title="War & History"
              items={warMovies}
              onCardClick={handleMoreInfo}
              onPlay={handlePlay}
            />

            <MediaRow
              title="Music & Musicals"
              items={musicMovies}
              onCardClick={handleMoreInfo}
              onPlay={handlePlay}
            />

            <MediaRow
              title="Documentary Features"
              items={documentaryMovies}
              onCardClick={handleMoreInfo}
              onPlay={handlePlay}
            />

            <MediaRow
              title="Western Classics"
              items={westernMovies}
              onCardClick={handleMoreInfo}
              onPlay={handlePlay}
            />

            {/* Streaming Service Sections */}
            <div className="pt-8 border-t border-gray-700">
              <h2 className="text-2xl font-bold text-white mb-8">Trending on Streaming Services</h2>
            </div>

            {netflixMovies.length > 0 && (
              <MediaRow
                title="Trending on Netflix"
                items={netflixMovies}
                onCardClick={handleMoreInfo}
                onPlay={handlePlay}
              />
            )}

            {amazonPrimeMovies.length > 0 && (
              <MediaRow
                title="Trending on Amazon Prime"
                items={amazonPrimeMovies}
                onCardClick={handleMoreInfo}
                onPlay={handlePlay}
              />
            )}

            {huluMovies.length > 0 && (
              <MediaRow
                title="Trending on Hulu"
                items={huluMovies}
                onCardClick={handleMoreInfo}
                onPlay={handlePlay}
              />
            )}

            {disneyPlusMovies.length > 0 && (
              <MediaRow
                title="Trending on Disney+"
                items={disneyPlusMovies}
                onCardClick={handleMoreInfo}
                onPlay={handlePlay}
              />
            )}

            {maxMovies.length > 0 && (
              <MediaRow
                title="Trending on Max"
                items={maxMovies}
                onCardClick={handleMoreInfo}
                onPlay={handlePlay}
              />
            )}

            {paramountPlusMovies.length > 0 && (
              <MediaRow
                title="Trending on Paramount+"
                items={paramountPlusMovies}
                onCardClick={handleMoreInfo}
                onPlay={handlePlay}
              />
            )}

            {appleTvMovies.length > 0 && (
              <MediaRow
                title="Trending on Apple TV+"
                items={appleTvMovies}
                onCardClick={handleMoreInfo}
                onPlay={handlePlay}
              />
            )}

            {cwMovies.length > 0 && (
              <MediaRow
                title="Trending on The CW"
                items={cwMovies}
                onCardClick={handleMoreInfo}
                onPlay={handlePlay}
              />
            )}
          </div>
        </>
      ) : (
        <>
          <HeroCarousel
            items={tvCarouselItems}
            onPlay={handlePlay}
            onMoreInfo={handleMoreInfo}
          />

          {/* Content Tabs - After Carousel */}
          <div className="px-8 md:px-16 py-4">
            <div className="flex justify-center">
              <div className="flex bg-gray-800/90 rounded-lg p-1">
                <button
                  onClick={() => setActiveTab('movies')}
                  className={`px-6 py-3 rounded-md text-sm font-medium transition-colors ${(activeTab as string) === 'movies'
                    ? 'bg-netflix-red text-white'
                    : 'text-gray-300 hover:text-white'
                    }`}
                >
                  Movies
                </button>
                <button
                  onClick={() => setActiveTab('tv')}
                  className={`px-6 py-3 rounded-md text-sm font-medium transition-colors ${activeTab === 'tv'
                    ? 'bg-netflix-red text-white'
                    : 'text-gray-300 hover:text-white'
                    }`}
                >
                  TV Shows
                </button>
              </div>
            </div>
          </div>

          <div className="px-8 md:px-16 py-8 space-y-8">
            {recentlyWatched.length > 0 && (
              <MediaRow
                title="Continue Watching"
                items={recentlyWatched}
                onCardClick={handleMoreInfo}
                onPlay={handlePlay}
                aspect="poster"
              />
            )}

            <MediaRow
              title="Trending TV Shows"
              items={trendingTV}
              onCardClick={handleMoreInfo}
              onPlay={handlePlay}
            />

            <MediaRow
              title="Popular TV Shows"
              items={trendingTV.slice().reverse()} // Just reverse for variety
              onCardClick={handleMoreInfo}
              onPlay={handlePlay}
            />

            <MediaRow
              title="Action-Packed Adventures"
              items={actionTV}
              onCardClick={handleMoreInfo}
              onPlay={handlePlay}
            />

            <MediaRow
              title="Animated Series"
              items={animationTV}
              onCardClick={handleMoreInfo}
              onPlay={handlePlay}
            />

            <MediaRow
              title="Anime Adventures"
              items={animeTV}
              onCardClick={handleMoreInfo}
              onPlay={handlePlay}
            />

            <MediaRow
              title="Hilarious Sitcoms"
              items={comedyTV}
              onCardClick={handleMoreInfo}
              onPlay={handlePlay}
            />

            <MediaRow
              title="Crime Dramas"
              items={crimeTV}
              onCardClick={handleMoreInfo}
              onPlay={handlePlay}
            />

            <MediaRow
              title="Documentary Series"
              items={documentaryTV}
              onCardClick={handleMoreInfo}
              onPlay={handlePlay}
            />

            <MediaRow
              title="Gripping Dramas"
              items={dramaTV}
              onCardClick={handleMoreInfo}
              onPlay={handlePlay}
            />

            <MediaRow
              title="Family-Friendly Shows"
              items={familyTV}
              onCardClick={handleMoreInfo}
              onPlay={handlePlay}
            />

            <MediaRow
              title="Mystery & Suspense"
              items={mysteryTV}
              onCardClick={handleMoreInfo}
              onPlay={handlePlay}
            />

            <MediaRow
              title="Sci-Fi & Fantasy"
              items={scifiTV}
              onCardClick={handleMoreInfo}
              onPlay={handlePlay}
            />

            <MediaRow
              title="Talk Shows"
              items={talkTV}
              onCardClick={handleMoreInfo}
              onPlay={handlePlay}
            />

            <MediaRow
              title="Western Classics"
              items={westernTV}
              onCardClick={handleMoreInfo}
              onPlay={handlePlay}
            />

            <MediaRow
              title="Reality TV"
              items={realityTV}
              onCardClick={handleMoreInfo}
              onPlay={handlePlay}
            />

            <MediaRow
              title="News & Current Affairs"
              items={newsTV}
              onCardClick={handleMoreInfo}
              onPlay={handlePlay}
            />

            {/* Streaming Service Sections */}
            <div className="pt-8 border-t border-gray-700">
              <h2 className="text-2xl font-bold text-white mb-8">Trending on Streaming Services</h2>
            </div>

            {netflixTV.length > 0 && (
              <MediaRow
                title="Trending on Netflix"
                items={netflixTV}
                onCardClick={handleMoreInfo}
                onPlay={handlePlay}
              />
            )}

            {amazonPrimeTV.length > 0 && (
              <MediaRow
                title="Trending on Amazon Prime"
                items={amazonPrimeTV}
                onCardClick={handleMoreInfo}
                onPlay={handlePlay}
              />
            )}

            {huluTV.length > 0 && (
              <MediaRow
                title="Trending on Hulu"
                items={huluTV}
                onCardClick={handleMoreInfo}
                onPlay={handlePlay}
              />
            )}

            {disneyPlusTV.length > 0 && (
              <MediaRow
                title="Trending on Disney+"
                items={disneyPlusTV}
                onCardClick={handleMoreInfo}
                onPlay={handlePlay}
              />
            )}

            {maxTV.length > 0 && (
              <MediaRow
                title="Trending on Max"
                items={maxTV}
                onCardClick={handleMoreInfo}
                onPlay={handlePlay}
              />
            )}

            {paramountPlusTV.length > 0 && (
              <MediaRow
                title="Trending on Paramount+"
                items={paramountPlusTV}
                onCardClick={handleMoreInfo}
                onPlay={handlePlay}
              />
            )}

            {appleTvTV.length > 0 && (
              <MediaRow
                title="Trending on Apple TV+"
                items={appleTvTV}
                onCardClick={handleMoreInfo}
                onPlay={handlePlay}
              />
            )}

            {cwTV.length > 0 && (
              <MediaRow
                title="Trending on The CW"
                items={cwTV}
                onCardClick={handleMoreInfo}
                onPlay={handlePlay}
              />
            )}
          </div>
        </>
      )}

      <DetailsModal
        item={selectedItem}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        autoPlayTrailer={autoPlayTrailer}
        onPlay={handlePlay}
        onPlayEpisode={handlePlay}
        forceFetchEpisodes={true}
      />
    </div>
  );
};

export default React.memo(Home);