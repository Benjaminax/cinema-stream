import React, { useState, useEffect } from 'react';
import { RefreshCw, TrendingUp, Calendar, Play, Clock, Star, Newspaper, Heart, Info, Tv, ChevronLeft, ChevronRight } from 'lucide-react';
import MediaRow from '../components/media/MediaRow';
import DetailsModal from '../components/media/DetailsModal';
import { TMDBResult, MediaDetails } from '../types/media';
import { getTrending, getDetails, getUpcomingMovies, getUpcomingTV, getPopularMovies, getTopRatedMovies, getDiscover } from '../api/tmdb';
import { analyzeUserGenres, filterByGenres, scanLocalLibrary } from '../utils/genreAnalysis';
import {
  getGenrePreferences,
  getTopGenrePreferences,
  updateGenrePreferences,
  GENRE_NAME_MAP
} from '../utils/genrePreferences';
import { getMyList } from '../utils/myList';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import NoInternetConnection from '../components/offline/NoInternetConnection';

// News API types
interface NewsArticle {
  source: {
    id: string | null;
    name: string;
  };
  author: string | null;
  title: string;
  description: string | null;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  content: string | null;
}

interface NewsResponse {
  status: string;
  totalResults: number;
  articles: NewsArticle[];
}

const Popular: React.FC = () => {
  const [trendingMovies, setTrendingMovies] = useState<TMDBResult[]>([]);
  const [trendingTV, setTrendingTV] = useState<TMDBResult[]>([]);
  const [upcomingMovies, setUpcomingMovies] = useState<TMDBResult[]>([]);
  const [upcomingTV, setUpcomingTV] = useState<TMDBResult[]>([]);

  // New discovery sections
  const [popularMovies, setPopularMovies] = useState<TMDBResult[]>([]);
  const [topRatedMovies, setTopRatedMovies] = useState<TMDBResult[]>([]);
  const [actionMovies, setActionMovies] = useState<TMDBResult[]>([]);
  const [netflixOriginals, setNetflixOriginals] = useState<TMDBResult[]>([]);

  const [filteredMovies, setFilteredMovies] = useState<TMDBResult[]>([]);
  const [filteredTV, setFilteredTV] = useState<TMDBResult[]>([]);
  const [filteredUpcomingMovies, setFilteredUpcomingMovies] = useState<TMDBResult[]>([]);
  const [filteredUpcomingTV, setFilteredUpcomingTV] = useState<TMDBResult[]>([]);

  // Watchlist and Local Data
  const [watchlistItems, setWatchlistItems] = useState<TMDBResult[]>([]);
  const [localMovies, setLocalMovies] = useState<TMDBResult[]>([]);
  const [localSeries, setLocalSeries] = useState<TMDBResult[]>([]);
  const [watchlistUpcoming, setWatchlistUpcoming] = useState<TMDBResult[]>([]);
  const [justForYou, setJustForYou] = useState<TMDBResult[]>([]);

  const [tvShowDetails, setTvShowDetails] = useState<Record<number, MediaDetails>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [genreNames, setGenreNames] = useState<string[]>([]);
  const [analyzingGenres, setAnalyzingGenres] = useState(false);

  // News state
  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([]);
  const [loadingNews, setLoadingNews] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());
  const { isOnline, retry } = useNetworkStatus();

  // Show offline page if not connected
  if (!isOnline) {
    return <NoInternetConnection onRetry={retry} />;
  }

  // News API configuration
  const NEWS_API_KEY = 'f0de56da99d04da99f846ad839959950';
  const NEWS_API_BASE_URL = 'https://newsapi.org/v2';

  // Fetch news based on user's preferred genres
  const fetchGenreBasedNews = async (genres: string[]): Promise<NewsArticle[]> => {
    if (genres.length === 0) return [];

    setLoadingNews(true);
    try {
      // Map movie/TV genres to news search terms
      const genreToNewsKeywords: { [key: string]: string[] } = {
        'Action': ['action movies casting', 'new action films', 'upcoming action series S02'],
        'Adventure': ['adventure movies news', 'adventure show renewal'],
        'Animation': ['new anime season news', 'animated series casting'],
        'Comedy': ['sitcom renewal news', 'comedy series season 2'],
        'Crime': ['crime show season news', 'true crime series renewal'],
        'Documentary': ['new documentaries news', 'trending docuseries'],
        'Drama': ['drama series casting news', 'drama show season 2'],
        'Family': ['family show renewal', 'upcoming family movies'],
        'Fantasy': ['fantasy series casting', 'witcher recast news', 'huge fantasy renewal'],
        'History': ['historical drama news', 'biopic casting'],
        'Horror': ['horror series season 2', 'new horror movie news'],
        'Music': ['music documentary news', 'musical show renewal'],
        'Mystery': ['mystery series season news', 'whodunnit renewal'],
        'Romance': ['romance show renewal', 'new rom-com casting'],
        'Science Fiction': ['sci-fi series season 2', 'science fiction casting news'],
        'Sci-Fi & Fantasy': ['fantasy show season 2', 'sci-fi series renewal news'],
        'TV Movie': ['streaming movie news', 'original film casting'],
        'Thriller': ['thriller series renewal', 'suspense movie news'],
        'War': ['war drama series', 'military movie news'],
        'War & Politics': ['political drama renewal', 'war series news'],
        'Western': ['western series season 2', 'new western movies'],
        'Action & Adventure': ['blockbuster news', 'action adventure series renewal'],
        'Kids': ['kids show season 2', 'childrens animation news'],
        'Reality': ['reality series renewal', 'trending reality tv casting']
      };

      // Get keywords for user's top genres
      const topGenres = genres.slice(0, 3); // Use top 3 genres
      const searchQueries: string[] = [];

      topGenres.forEach(genre => {
        const keywords = genreToNewsKeywords[genre];
        if (keywords) {
          searchQueries.push(...keywords.slice(0, 2)); // Take first 2 keywords per genre
        }
      });

      // If no specific keywords found, use general entertainment news
      if (searchQueries.length === 0) {
        searchQueries.push('entertainment news', 'movie news', 'TV news', 'latest show casting news', 'trending series renewed');
      }

      // Fetch news for each query and combine results
      const allArticles: NewsArticle[] = [];
      const usedTitles = new Set<string>(); // Avoid duplicates

      for (const query of searchQueries.slice(0, 3)) { // Limit to 3 queries to avoid rate limits
        try {
          const response = await fetch(
            `${NEWS_API_BASE_URL}/everything?q=${encodeURIComponent(query)}&sortBy=publishedAt&language=en&pageSize=10&apiKey=${NEWS_API_KEY}`
          );

          if (!response.ok) {
            console.warn(`News API error for query "${query}":`, response.status);
            continue;
          }

          const data: NewsResponse = await response.json();

          // Filter out duplicates and add to results
          const uniqueArticles = data.articles.filter(article =>
            article.title &&
            !usedTitles.has(article.title) &&
            article.urlToImage && // Only articles with images
            article.description // Only articles with descriptions
          );

          uniqueArticles.forEach(article => {
            usedTitles.add(article.title);
            allArticles.push(article);
          });

        } catch (error) {
          console.warn(`Error fetching news for "${query}":`, error);
        }
      }

      // Sort by published date and return top 20
      return allArticles
        .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
        .slice(0, 20);

    } catch (error) {
      console.error('Error fetching genre-based news:', error);
      return [];
    } finally {
      setLoadingNews(false);
    }
  };

  const [selectedMedia, setSelectedMedia] = useState<TMDBResult | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleMediaClick = (item: TMDBResult) => {
    setSelectedMedia(item);
    setIsModalOpen(true);
  };

  const handlePlay = (item: TMDBResult) => {
    if (window.electronAPI?.openFile && item.local_path) {
      window.electronAPI.openFile(item.local_path);
    } else {
      console.log('Play item:', item.title || item.name);
      setSelectedMedia(item);
      setIsModalOpen(true);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedMedia(null);
  };

  const loadTrending = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      // Get trending and upcoming content
      const [
        moviesData,
        tvData,
        upcomingMoviesData,
        upcomingTVData,
        popularMoviesData,
        topRatedMoviesData,
        actionMoviesData,
        netflixOriginalsData
      ] = await Promise.all([
        getTrending('movie', 'week'),
        getTrending('tv', 'week'),
        getUpcomingMovies(1),
        getUpcomingTV(1),
        getPopularMovies(1),
        getTopRatedMovies(1),
        getDiscover('movie', { genre: '28' }), // Action genre ID
        getDiscover('tv', { origin_country: 'US', sort_by: 'popularity.desc' }) // Approximate for Netflix Originals if we don't have network ID filter in helper
      ]);

      setTrendingMovies(moviesData);
      setTrendingTV(tvData);
      setUpcomingMovies(upcomingMoviesData);
      setUpcomingTV(upcomingTVData);
      setPopularMovies(popularMoviesData);
      setTopRatedMovies(topRatedMoviesData);
      setActionMovies(actionMoviesData);

      // Filter for Netflix originals specifically if possible, otherwise use fallback
      setNetflixOriginals(netflixOriginalsData);

      setFilteredMovies(moviesData);
      setFilteredTV(tvData);
      setFilteredUpcomingMovies(upcomingMoviesData);
      setFilteredUpcomingTV(upcomingTVData);

      // First, check if we have stored genre preferences
      const storedPrefs = getTopGenrePreferences(5);
      if (storedPrefs.length > 0) {
        // Use stored preferences immediately for quick loading
        const storedGenreIds = storedPrefs.map(p => p.id);
        const storedGenreNames = storedPrefs.map(p => p.name);
        setGenreNames(storedGenreNames);

        // Filter trending and upcoming content based on stored preferences
        setFilteredMovies(filterByGenres(moviesData, storedGenreIds).length > 0 ? filterByGenres(moviesData, storedGenreIds) : moviesData);
        setFilteredTV(filterByGenres(tvData, storedGenreIds).length > 0 ? filterByGenres(tvData, storedGenreIds) : tvData);
        setFilteredUpcomingMovies(filterByGenres(upcomingMoviesData, storedGenreIds).length > 0 ? filterByGenres(upcomingMoviesData, storedGenreIds) : upcomingMoviesData);
        setFilteredUpcomingTV(filterByGenres(upcomingTVData, storedGenreIds).length > 0 ? filterByGenres(upcomingTVData, storedGenreIds) : upcomingTVData);

        // Fetch news based on stored preferences
        fetchGenreBasedNews(storedGenreNames).then(news => {
          if (news.length > 0) setNewsArticles(news);
        });
      }

      // Fetch additional details for both trending and upcoming TV shows
      const tvDetails: Record<number, MediaDetails> = {};
      const showsToDetail = [...tvData.slice(0, 5), ...upcomingTVData.slice(0, 5)];

      await Promise.all(
        showsToDetail.map(async (show) => {
          try {
            if (!tvDetails[show.id]) {
              const details = await getDetails('tv', show.id);
              tvDetails[show.id] = details;
            }
          } catch (error) {
            console.error(`Error fetching details for TV show ${show.id}:`, error);
          }
        })
      );
      setTvShowDetails(tvDetails);
      setLoading(false);

      // Fetch Watchlist and Local Data
      const watchlist = getMyList();
      setWatchlistItems(watchlist);

      // Now analyze library in background and update stored preferences
      setAnalyzingGenres(true);
      try {
        const libraryData = await scanLocalLibrary();
        const lMovies = libraryData.movies;
        const lSeries = libraryData.series;

        setLocalMovies(lMovies);
        setLocalSeries(lSeries);

        // Analyze user's preferred genres from current library AND watchlist
        const mergedItems = [...lMovies, ...lSeries, ...watchlist];
        const preferredGenres = await analyzeUserGenres(mergedItems);
        // Note: analyzeUserGenres currently only takes 2 args, I'll update it or merge manually

        // Let's improve the merged analysis in a future step or just use the existing one with more data
        // For now, let's merge the items for analyzeUserGenres if I can, but the types match.

        if (preferredGenres.length > 0) {
          // Update stored preferences (accumulates, doesn't replace)
          updateGenrePreferences(preferredGenres, GENRE_NAME_MAP);

          // Get updated preferences
          const updatedPrefs = getTopGenrePreferences(5);
          const updatedGenreIds = updatedPrefs.map(p => p.id);
          const updatedGenreNames = updatedPrefs.map(p => p.name);
          setGenreNames(updatedGenreNames);

          // Update filters with background analysis results
          setFilteredMovies(filterByGenres(moviesData, updatedGenreIds).length > 0 ? filterByGenres(moviesData, updatedGenreIds) : moviesData);
          setFilteredTV(filterByGenres(tvData, updatedGenreIds).length > 0 ? filterByGenres(tvData, updatedGenreIds) : tvData);
          setFilteredUpcomingMovies(filterByGenres(upcomingMoviesData, updatedGenreIds).length > 0 ? filterByGenres(upcomingMoviesData, updatedGenreIds) : upcomingMoviesData);
          setFilteredUpcomingTV(filterByGenres(upcomingTVData, updatedGenreIds).length > 0 ? filterByGenres(upcomingTVData, updatedGenreIds) : upcomingTVData);

          // Consolidated list of series to check for upcoming episodes (Watchlist + Local)
          const allUserSeries = [...watchlist, ...lSeries].filter((item, index, self) =>
            (item.media_type === 'tv' || item.first_air_date) &&
            self.findIndex(t => t.id === item.id) === index
          );

          // Find upcoming episodes for watchlist items and local items
          const upcomingSeriesContent = await Promise.all(allUserSeries.map(async (item) => {
            try {
              const details = await getDetails('tv', item.id);
              if (details.next_episode_to_air) {
                return { ...item, next_episode: details.next_episode_to_air };
              }
            } catch (e) { }
            return null;
          }));

          const upcomingSeriesFound = upcomingSeriesContent.filter((i): i is any => i !== null);
          setWatchlistUpcoming(upcomingSeriesFound);

          // Find global genre matches for THIS WEEK
          const now = new Date();
          const nextWeek = new Date(now);
          nextWeek.setDate(now.getDate() + 7);

          const genreMatchesThisWeek = [
            ...upcomingMoviesData,
            ...upcomingTVData
          ].filter(item => {
            const releaseDate = item.release_date || item.first_air_date;
            if (!releaseDate) return false;
            const d = new Date(releaseDate);
            // Must be within next 7 days AND match genres
            const isThisWeek = d >= now && d <= nextWeek;
            const matchesGenres = item.genre_ids?.some(id => updatedGenreIds.includes(id));
            return isThisWeek && matchesGenres;
          }).map(item => ({
            ...item,
            next_episode: null // Not a specific "tracked" series episode yet
          }));

          // Merge everything for Dropping This Week
          const mergedDropping = [
            ...upcomingSeriesFound,
            ...genreMatchesThisWeek
          ].filter((item, index, self) =>
            self.findIndex(t => t.id === item.id) === index
          ).sort((a, b) => {
            const dateA = new Date(a.next_episode?.air_date || a.release_date || a.first_air_date || 0);
            const dateB = new Date(b.next_episode?.air_date || b.release_date || b.first_air_date || 0);
            return dateA.getTime() - dateB.getTime();
          });

          setWatchlistUpcoming(mergedDropping);

          // Set "Just For You" - Rest of upcoming (beyond just this week)
          const combinedRecommendations = [
            ...filterByGenres(upcomingMoviesData, updatedGenreIds),
            ...filterByGenres(upcomingTVData, updatedGenreIds)
          ].filter(item => !mergedDropping.some(d => d.id === item.id))
            .sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
          setJustForYou(combinedRecommendations.slice(0, 10));

          // Fetch news based on updated preferences
          if (updatedGenreNames.length > 0) {
            const news = await fetchGenreBasedNews(updatedGenreNames);
            if (news.length > 0) setNewsArticles(news);
          }
        }
      } catch (genreError) {
        console.warn('Could not analyze user genres, using stored preferences:', genreError);
      } finally {
        setAnalyzingGenres(false);
        if (showRefresh) setRefreshing(false);
      }
    } catch (error) {
      console.error('Error loading trending/upcoming content:', error);
      setLoading(false);
      setAnalyzingGenres(false);
      if (showRefresh) setRefreshing(false);
    }
  };

  useEffect(() => {
    loadTrending();

    // Also fetch some initial entertainment news if no news yet
    if (newsArticles.length === 0) {
      const storedPrefs = getTopGenrePreferences(3);
      const genreNamesToUse = storedPrefs.length > 0
        ? storedPrefs.map(p => p.name)
        : ['Entertainment'];

      fetchGenreBasedNews(genreNamesToUse).then(news => {
        if (news.length > 0 && newsArticles.length === 0) {
          setNewsArticles(news);
        }
      }).catch(error => {
        console.warn('Error fetching initial news:', error);
      });
    }
  }, []);

  // Auto-load when component mounts
  useEffect(() => {
    if (trendingMovies.length === 0) {
      loadTrending();
    }
  }, [trendingMovies.length]);

  const handleRefresh = () => {
    loadTrending(true);
  };

  const renderTVShowStatus = (show: TMDBResult) => {
    const details = tvShowDetails[show.id];
    if (!details) return null;

    const getStatusColor = (status: string, nextEpisode?: any) => {
      if (nextEpisode?.season_number > 1) return 'text-amber-400';
      switch (status.toLowerCase()) {
        case 'returning series':
          return 'text-white';
        case 'ended':
        case 'canceled':
          return 'text-red-400';
        case 'in production':
          return 'text-blue-400';
        default:
          return 'text-gray-400';
      }
    };

    const getStatusIcon = (status: string, inProduction?: boolean, nextEpisode?: any) => {
      if (nextEpisode?.season_number > 1) return <Star className="h-3 w-3 fill-amber-400" />;
      if (inProduction) return <Play className="h-3 w-3" />;
      if (status.toLowerCase().includes('returning')) return <Calendar className="h-3 w-3" />;
      return <Clock className="h-3 w-3" />;
    };

    const isNewSeason = (details.next_episode_to_air?.season_number ?? 0) > 1;

    return (
      <div className="absolute top-2 right-2 bg-black/80 rounded-lg px-2 py-1 text-xs flex items-center gap-1">
        {getStatusIcon(details.status, details.in_production, details.next_episode_to_air)}
        <span className={getStatusColor(details.status, details.next_episode_to_air)}>
          {isNewSeason ? `Season ${details.next_episode_to_air?.season_number}` : details.status}
        </span>
      </div>
    );
  };

  const renderUpcomingInfo = (show: TMDBResult) => {
    const details = tvShowDetails[show.id];
    if (!details?.next_episode_to_air) return null;

    const nextEpisode = details.next_episode_to_air;
    const airDate = new Date(nextEpisode.air_date);
    const now = new Date();
    const isUpcoming = airDate > now;

    if (!isUpcoming) return null;

    return (
      <div className="absolute bottom-2 left-2 right-2 bg-black/80 rounded-lg px-2 py-1 text-xs">
        <div className="text-white font-medium">
          Next: S{nextEpisode.season_number}E{nextEpisode.episode_number}
        </div>
        <div className="text-gray-300 text-xs">
          {airDate.toLocaleDateString()}
        </div>
      </div>
    );
  };

  // Get stored preferences for display
  const storedPreferences = getGenrePreferences();
  const hasStoredPrefs = storedPreferences.length > 0;

  // Spotlight picks for header cards
  const heroMovie = (filteredMovies.length > 0 ? filteredMovies : trendingMovies)[0];
  const heroShow = (filteredTV.length > 0 ? filteredTV : trendingTV)[0];

  // Unified upcoming timeline with deep details
  const upcomingCombined = [
    ...(filteredUpcomingMovies.length > 0 ? filteredUpcomingMovies : upcomingMovies).map(item => ({
      ...item,
      airDate: item.release_date || item.first_air_date,
      kind: 'movie' as const,
    })),
    ...(filteredUpcomingTV.length > 0 ? filteredUpcomingTV : upcomingTV).map(item => {
      // Find matches in watchlistUpcoming for deep info (S/E numbers)
      const matchingDeep = watchlistUpcoming.find(w => w.id === item.id);
      return {
        ...item,
        airDate: item.first_air_date || item.release_date,
        kind: 'tv' as const,
        next_episode: (matchingDeep as any)?.next_episode
      };
    }),
  ]
    .filter(item => item.airDate)
    .sort((a, b) => new Date(a.airDate as string).getTime() - new Date(b.airDate as string).getTime())
    .slice(0, 12); // Increased limit

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'TBA';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return 'TBA';

    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const isTomorrow = d.toDateString() === tomorrow.toDateString();

    if (isToday) return 'DROPPING TODAY';
    if (isTomorrow) return 'DROPPING TOMORROW';

    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];

    // Add empty slots for days before the first day of the month
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null);
    }

    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  };

  const calendarDays = getDaysInMonth(currentCalendarDate);
  const monthName = currentCalendarDate.toLocaleString('default', { month: 'long' });
  const currentYear = currentCalendarDate.getFullYear();

  const handlePrevMonth = () => {
    setCurrentCalendarDate(new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentCalendarDate(new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() + 1, 1));
  };

  const handleToday = () => {
    setCurrentCalendarDate(new Date());
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center gap-4 mb-8">
          <TrendingUp className="h-8 w-8 text-red-500 drop-shadow-lg" />
          <h1 className="text-3xl font-bold text-white drop-shadow-lg">New & Popular</h1>
        </div>
        <div className="flex flex-col items-center justify-center h-64 text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
          <div className="text-white text-sm md:text-base">Loading trending content...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 bg-[#050505] relative text-white overflow-x-hidden">
      {/* Dynamic Background Experience */}
      <div className="fixed inset-0 bg-[#050505] z-0" />
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(229,9,20,0.12)_0%,transparent_40%),radial-gradient(circle_at_80%_70%,rgba(220,38,38,0.08)_0%,transparent_45%),radial-gradient(circle_at_50%_-10%,rgba(255,255,255,0.03)_0%,transparent_50%)] z-0" />
      <div className="fixed inset-0 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] opacity-[0.03] z-0" />

      <div className="relative z-10">
        <div className="flex flex-wrap items-center justify-between gap-8 mb-12">
          <div className="flex items-center gap-6 group">
            <div className="relative">
              <div className="absolute -inset-2 bg-red-600/30 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-duration-700"></div>
              <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center shadow-[0_8px_32px_rgba(229,9,20,0.4)] border border-white/10 group-hover:scale-110 transition-transform duration-500">
                <TrendingUp className="h-8 w-8 text-white drop-shadow-md" />
              </div>
            </div>

            <div className="space-y-1">
              <h1 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter leading-none">
                New <span className="text-red-600">&</span> Popular
              </h1>
              <div className="flex items-center gap-3">
                <div className="h-0.5 w-12 bg-red-600 rounded-full"></div>
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-400">
                  {analyzingGenres
                    ? 'Synergizing preferences...'
                    : genreNames.length > 0
                      ? `Personalized: ${genreNames.join(' • ')}`
                      : 'Global Entertainment Feed'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden lg:flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
              <span className="text-[10px] items-center font-black uppercase tracking-widest text-white/60">Live Feed Active</span>
            </div>

            <div className="flex items-center gap-1.5 p-1.5 bg-black/40 rounded-2xl border border-white/5 backdrop-blur-xl shadow-2xl">
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-500 ${viewMode === 'list' ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.2)]' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
              >
                <TrendingUp className="h-3.5 w-3.5" />
                List
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-500 ${viewMode === 'calendar' ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.2)]' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
              >
                <Calendar className="h-3.5 w-3.5" />
                Events
              </button>
            </div>

            <button
              onClick={handleRefresh}
              disabled={refreshing || analyzingGenres}
              className="group w-12 h-12 flex items-center justify-center bg-white/5 hover:bg-red-600 hover:text-white disabled:bg-gray-800 text-white rounded-2xl transition-all border border-white/10 backdrop-blur-sm disabled:opacity-50"
              title="Refresh Global Feed"
            >
              <RefreshCw className={`h-5 w-5 transition-transform duration-700 ${refreshing || analyzingGenres ? 'animate-spin' : 'group-hover:rotate-180'}`} />
            </button>
          </div>
        </div>


        {/* Spotlight Duo Experience */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-16">
          {[heroMovie, heroShow].map((pick, idx) => pick ? (
            <div
              key={idx === 0 ? pick.id + '-movie' : pick.id + '-show'}
              className="group relative overflow-hidden rounded-[2.5rem] bg-black/40 border border-white/10 shadow-[0_32px_80px_rgba(0,0,0,0.6)] hover:border-red-600/30 transition-all duration-700 h-[480px]"
            >
              {/* Ambient Background Experience */}
              <div className="absolute inset-0 z-0">
                {pick.backdrop_path ? (
                  <img
                    src={`https://image.tmdb.org/t/p/w1280${pick.backdrop_path}`}
                    alt=""
                    className="w-full h-full object-cover transition-transform duration-[2000ms] group-hover:scale-110"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-gray-900 to-black" />
                )}
                <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(0,0,0,0.95)_0%,rgba(0,0,0,0.4)_50%,rgba(0,0,0,0.95)_100%)] opacity-80" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(229,9,20,0.25)_0%,transparent_60%)] group-hover:opacity-100 transition-opacity duration-700 animate-pulse" />
              </div>

              {/* Content Experience */}
              <div className="relative z-10 h-full p-10 flex flex-col justify-end">
                <div className="flex items-start gap-8">
                  {/* Poster Artwork */}
                  <div className="hidden sm:block w-36 h-52 flex-shrink-0 relative group/poster">
                    <div className="absolute -inset-2 bg-red-600/20 rounded-2xl blur-lg opacity-0 group-hover/poster:opacity-100 transition-opacity duration-500" />
                    <img
                      src={`https://image.tmdb.org/t/p/w342${pick.poster_path}`}
                      alt=""
                      className="relative w-full h-full object-cover rounded-2xl border border-white/20 shadow-2xl transition-transform duration-500 group-hover/poster:-translate-y-2 group-hover/poster:scale-105"
                    />
                  </div>

                  {/* Narrative Information */}
                  <div className="flex-1 space-y-6">
                    <div className="flex items-center gap-4">
                      <span className="px-3 py-1 bg-red-600 text-[10px] font-black uppercase tracking-[0.2em] rounded-md shadow-lg shadow-red-600/20">
                        Top Spotlight
                      </span>
                      <span className="text-white/40 text-[10px] uppercase font-black tracking-widest">
                        {idx === 0 ? 'Featured Film' : 'Featured Series'}
                      </span>
                    </div>

                    <div className="space-y-3">
                      <h2 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter leading-[0.9] drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">
                        {pick.title || pick.name}
                      </h2>
                      <p className="text-white/60 text-base font-medium line-clamp-3 leading-relaxed max-w-2xl">
                        {pick.overview}
                      </p>
                    </div>

                    {/* Dynamic Metrics */}
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-black/60 rounded-xl border border-white/5 backdrop-blur-md">
                        <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                        <span className="text-sm font-black text-amber-500">{(pick.vote_average || 0).toFixed(1)}</span>
                      </div>
                      {pick.release_date || pick.first_air_date ? (
                        <div className="px-3 py-1.5 bg-black/60 rounded-xl border border-white/5 backdrop-blur-md text-[11px] font-black uppercase text-gray-400 tracking-widest">
                          {(pick.release_date || pick.first_air_date)?.slice(0, 4)}
                        </div>
                      ) : null}
                    </div>

                    <div className="pt-2 flex flex-wrap gap-4">
                      <button
                        onClick={() => handleMediaClick(pick)}
                        className="group/btn relative px-8 py-3.5 bg-white text-black font-black uppercase tracking-widest rounded-2xl transition-all hover:bg-red-600 hover:text-white hover:scale-105 active:scale-95 shadow-2xl flex items-center gap-3 overflow-hidden"
                      >
                        <Play className="h-4 w-4 fill-current group-hover/btn:scale-110 transition-transform" />
                        Play Spotlight
                      </button>
                      <button
                        onClick={() => handleMediaClick(pick)}
                        className="px-8 py-3.5 bg-white/10 hover:bg-white/20 text-white font-black uppercase tracking-widest rounded-2xl transition-all border border-white/10 backdrop-blur-md flex items-center gap-3 active:scale-95"
                      >
                        <Info className="h-4 w-4" />
                        Details
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null)}
        </div>

        {/* Preferences badges */}
        {hasStoredPrefs && (
          <div className="mb-8 border border-white/10 rounded-[2.5rem] bg-white/[0.03] backdrop-blur-3xl p-8 shadow-2xl relative overflow-hidden group/prefs">
            <div className="absolute inset-0 bg-gradient-to-br from-red-600/5 to-transparent opacity-0 group-hover/prefs:opacity-100 transition-opacity duration-700 pointer-events-none" />
            <div className="flex items-center gap-3 mb-6 text-sm text-gray-200">
              <div className="w-8 h-8 rounded-xl bg-pink-600/20 flex items-center justify-center">
                <Heart className="h-4 w-4 text-pink-500" />
              </div>
              <span className="font-bold tracking-tight text-white/80">Based on your activity in {localMovies.length + localSeries.length} local titles & {watchlistItems.length} saved treasures</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {storedPreferences.slice(0, 12).map(pref => (
                <span
                  key={pref.id}
                  className="px-3 py-1.5 rounded-full bg-gradient-to-r from-red-600/25 to-pink-600/20 border border-red-500/30 text-sm text-white flex items-center gap-2 transition-all hover:scale-105"
                >
                  {pref.name}
                  <span className="text-[10px] text-gray-400 font-bold px-1.5 py-0.5 bg-black/30 rounded-md">{pref.count}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* DROPPING THIS WEEK - Personalized Timeline */}
        {(watchlistUpcoming.length > 0) && (
          <div className="mb-12 border border-blue-500/20 rounded-[2.5rem] bg-blue-500/5 backdrop-blur-3xl p-10 shadow-[0_32px_80px_rgba(59,130,246,0.1)] relative overflow-hidden transition-all duration-500 hover:border-blue-500/40">
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />
            <h2 className="text-3xl font-black italic uppercase tracking-tighter mb-6 flex items-center gap-3">
              <Clock className="h-8 w-8 text-blue-400" />
              Dropping This Week
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {watchlistUpcoming.slice(0, 6).map((item: any) => (
                <div
                  key={item.id}
                  className="group relative flex flex-col bg-black/40 rounded-2xl border border-white/10 hover:border-blue-500/50 transition-all cursor-pointer overflow-hidden p-4"
                  onClick={() => handleMediaClick(item)}
                >
                  <div className="flex gap-4">
                    <div className="w-20 h-28 rounded-lg overflow-hidden flex-shrink-0 relative">
                      <img src={`https://image.tmdb.org/t/p/w185${item.poster_path}`} className="w-full h-full object-cover" alt="" />
                      {/* Play Button Overlay */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePlay(item);
                          }}
                          className="p-2 bg-red-600 hover:bg-red-700 rounded-full transition-colors"
                        >
                          <Play size={16} fill="white" className="text-white translate-x-0.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col flex-1">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className={`px-2 py-0.5 text-white text-[9px] font-black uppercase rounded ${item.next_episode ? 'bg-blue-600' : 'bg-red-600'}`}>
                          {item.next_episode ? 'NEW EPISODE' : item.media_type === 'movie' ? 'MOVIE PREMIERE' : 'SERIES PREMIERE'}
                        </span>
                        <span className={`text-[10px] font-black uppercase tracking-tighter ${formatDate(item.next_episode?.air_date || item.release_date || item.first_air_date).includes('TODAY') ? 'text-red-500 animate-pulse' : 'text-blue-400'}`}>
                          {formatDate(item.next_episode?.air_date || item.release_date || item.first_air_date)}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold line-clamp-1">{item.name || item.title}</h3>
                      <p className="text-blue-200/60 text-xs font-black uppercase tracking-widest mb-2">
                        {item.next_episode ? `S${item.next_episode.season_number} • E${item.next_episode.episode_number}` : item.genre_ids?.map((id: number) => GENRE_NAME_MAP[id]).filter(Boolean).slice(0, 2).join(' / ')}
                      </p>
                      <p className="text-gray-400 text-xs line-clamp-2">
                        {item.next_episode ? `“${item.next_episode.name}”` : item.overview}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* JUST FOR YOU - Upcoming based on Genres */}
        {justForYou.length > 0 && (
          <div className="mb-12 border border-purple-500/20 rounded-[2.5rem] bg-purple-500/5 backdrop-blur-3xl p-10 shadow-[0_32px_80px_rgba(168,85,247,0.1)] transition-all duration-500 hover:border-purple-500/40">
            <h2 className="text-3xl font-black italic uppercase tracking-tighter mb-6 flex items-center gap-3">
              <Heart className="h-8 w-8 text-purple-400" />
              New For You
            </h2>
            <div className="flex space-x-6 overflow-x-auto pb-6 scrollbar-custom">
              {justForYou.map((item) => (
                <div
                  key={item.id}
                  className="relative flex-shrink-0 w-64 group cursor-pointer"
                  onClick={() => handleMediaClick(item)}
                >
                  <div className="aspect-video rounded-2xl overflow-hidden border border-white/10 group-hover:border-purple-500/50 transition-all mb-3 relative">
                    <img src={`https://image.tmdb.org/t/p/w780${item.backdrop_path}`} className="w-full h-full object-cover group-hover:scale-110 transition duration-700" alt="" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                    {/* Play Button Overlay */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlay(item);
                        }}
                        className="p-4 bg-red-600 hover:bg-red-700 rounded-full transition-colors shadow-xl"
                      >
                        <Play size={20} fill="white" className="text-white translate-x-0.5" />
                      </button>
                    </div>
                    <div className="absolute bottom-3 left-3 right-3 text-white">
                      <h4 className="font-bold text-sm truncate">{item.title || item.name}</h4>
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-black uppercase text-purple-400 tracking-widest">{item.media_type === 'movie' ? 'PREMIERE' : 'NEW SERIES'}</span>
                    <span className="text-[10px] font-bold text-gray-500">{item.release_date || item.first_air_date}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-10">
          {/* Trending Movies */}
          <div className="border border-white/10 rounded-[2.5rem] bg-white/[0.03] backdrop-blur-3xl p-8 shadow-[0_32px_80px_rgba(0,0,0,0.4)] transition-all duration-500 hover:border-white/20">
            <MediaRow
              title={`Trending Movies ${filteredMovies.length < trendingMovies.length ? `(${filteredMovies.length}/${trendingMovies.length} match you)` : ''}`}
              items={filteredMovies.length > 0 ? filteredMovies : trendingMovies}
              onCardClick={handleMediaClick}
              onPlay={handlePlay}
            />
          </div>

          {/* Trending TV */}
          <div className="border border-white/10 rounded-[2.5rem] bg-white/[0.03] backdrop-blur-3xl p-8 shadow-[0_32px_80px_rgba(0,0,0,0.4)] transition-all duration-500 hover:border-white/20">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-3">
              <Tv className="h-5 w-5 text-red-400" />
              Trending Series
              <span className="text-sm text-gray-400 font-normal">
                {filteredTV.length < trendingTV.length ? `${filteredTV.length}/${trendingTV.length} match you` : 'Global pulse'}
              </span>
            </h2>
            <div className="flex space-x-6 overflow-x-auto pb-4 scrollbar-custom">
              {(filteredTV.length > 0 ? filteredTV : trendingTV).map((show) => (
                <div
                  key={show.id}
                  className="relative flex-shrink-0 w-52 cursor-pointer transition-transform duration-300 hover:scale-105 hover:z-10 group"
                  onClick={() => handleMediaClick(show)}
                >
                  <div className="aspect-[2/3] rounded-2xl overflow-hidden bg-gray-900 shadow-lg border border-white/10">
                    <img
                      src={`https://image.tmdb.org/t/p/w500${show.poster_path}`}
                      alt={show.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      loading="lazy"
                    />
                  </div>
                  {renderTVShowStatus(show)}
                  {renderUpcomingInfo(show)}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent p-3 rounded-b-2xl">
                    <h3 className="text-white font-semibold text-sm line-clamp-2">{show.name}</h3>
                    <div className="flex items-center gap-2 text-xs text-gray-300 mt-1">
                      <span className="bg-white/10 px-1.5 py-0.5 rounded">{show.first_air_date ? new Date(show.first_air_date).getFullYear() : 'TBA'}</span>
                      <div className="flex items-center gap-1 text-white">
                        <Star className="h-3 w-3 fill-white" />
                        {show.vote_average.toFixed(1)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming timeline / Calendar Toggle */}
          {upcomingCombined.length > 0 && (
            <div className="border border-white/10 rounded-[2.5rem] bg-white/[0.03] backdrop-blur-3xl p-10 shadow-[0_32px_80px_rgba(0,0,0,0.5)] relative overflow-hidden transition-all duration-500 hover:border-white/20">
              <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />

              <div className="flex flex-wrap items-center justify-between gap-4 mb-6 relative z-10">
                <h2 className="text-2xl font-bold flex items-center gap-3">
                  <Calendar className="h-6 w-6 text-amber-400" />
                  On the Horizon
                </h2>

                {viewMode === 'calendar' && (
                  <div className="flex items-center gap-4 bg-black/40 px-4 py-2 rounded-2xl border border-white/10">
                    <button
                      onClick={handlePrevMonth}
                      className="p-1.5 hover:bg-white/10 rounded-lg transition text-gray-400 hover:text-white"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <div className="text-sm font-bold min-w-[140px] text-center">
                      {monthName} {currentYear}
                    </div>
                    <button
                      onClick={handleNextMonth}
                      className="p-1.5 hover:bg-white/10 rounded-lg transition text-gray-400 hover:text-white"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                    <div className="w-px h-4 bg-white/10 mx-1" />
                    <button
                      onClick={handleToday}
                      className="text-xs font-semibold hover:text-red-400 transition"
                    >
                      Today
                    </button>
                  </div>
                )}
              </div>

              {viewMode === 'list' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 relative z-10">
                  {upcomingCombined.map(item => (
                    <div
                      key={`${item.id}-${item.kind}`}
                      className="relative flex gap-4 rounded-2xl border border-white/10 bg-black/40 p-4 hover:border-white/20 hover:bg-white/5 transition cursor-pointer group"
                      onClick={() => handleMediaClick(item)}
                    >
                      {item.poster_path ? (
                        <div className="w-20 h-28 flex-shrink-0 relative overflow-hidden rounded-xl border border-white/10 shadow-lg">
                          <img
                            src={`https://image.tmdb.org/t/p/w185${item.poster_path}`}
                            alt={item.title || item.name}
                            className="w-full h-full object-cover group-hover:scale-110 transition duration-500"
                            loading="lazy"
                          />
                          {/* Play Button Overlay */}
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePlay(item);
                              }}
                              className="p-2 bg-red-600 hover:bg-red-700 rounded-full transition-colors"
                            >
                              <Play size={14} fill="white" className="text-white translate-x-0.5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="w-20 h-28 rounded-xl bg-gray-800 border border-white/10" />
                      )}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${item.kind === 'movie' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'}`}>
                              {item.kind === 'movie' ? 'Film' : 'Series'}
                            </span>
                            {(item as any).next_episode && (
                              <span className="px-2 py-0.5 bg-white/10 text-white text-[10px] font-black uppercase rounded">
                                S{(item as any).next_episode.season_number} E{(item as any).next_episode.episode_number}
                              </span>
                            )}
                          </div>
                          <span className={`text-[11px] font-bold ${formatDate(item.airDate).includes('TODAY') ? 'text-red-500 animate-pulse' : 'text-amber-300'}`}>{formatDate(item.airDate)}</span>
                        </div>
                        <h3 className="text-base font-bold line-clamp-2 leading-snug group-hover:text-red-400 transition">{item.title || item.name}</h3>
                        <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                          {(item as any).next_episode ? `Episode: ${(item as any).next_episode.name}` : item.overview}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="relative z-10 animate-fade-in">
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                      <div key={day} className="text-center text-[10px] font-bold uppercase tracking-widest text-gray-500 py-2">
                        {day}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-2">
                    {calendarDays.map((day, idx) => {
                      if (!day) return <div key={`empty-${idx}`} className="aspect-square bg-white/[0.02] rounded-xl border border-transparent" />;

                      const isToday = day.toDateString() === new Date().toDateString();
                      const dayItems = upcomingCombined.filter(item => {
                        const itemDate = new Date(item.airDate as string);
                        return itemDate.toDateString() === day.toDateString();
                      });

                      return (
                        <div
                          key={day.toISOString()}
                          className={`aspect-square relative rounded-2xl border transition-all p-2 flex flex-col items-center justify-center gap-1
                          ${isToday ? 'bg-red-600/20 border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.15)]' : 'bg-black/30 border-white/5 hover:border-white/20'}`}
                        >
                          <span className={`text-sm font-bold ${isToday ? 'text-red-400' : 'text-gray-400'}`}>
                            {day.getDate()}
                          </span>

                          <div className="flex -space-x-1.5 overflow-hidden">
                            {dayItems.slice(0, 3).map((item) => (
                              <div
                                key={item.id}
                                className="w-8 h-8 rounded-full border-2 border-black overflow-hidden hover:scale-125 hover:z-20 transition cursor-pointer shadow-lg"
                                title={item.title || item.name}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMediaClick(item);
                                }}
                              >
                                <img
                                  src={`https://image.tmdb.org/t/p/w92${item.poster_path}`}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ))}
                            {dayItems.length > 3 && (
                              <div className="w-8 h-8 rounded-full border-2 border-black bg-gray-800 flex items-center justify-center text-[9px] font-bold text-white z-10">
                                +{dayItems.length - 3}
                              </div>
                            )}
                          </div>

                          {isToday && <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Global Popular Movies */}
          {popularMovies.length > 0 && (
            <div className="border border-white/10 rounded-[2.5rem] bg-white/[0.03] backdrop-blur-3xl p-8 shadow-[0_32px_80px_rgba(0,0,0,0.4)] transition-all duration-500 hover:border-white/20">
              <MediaRow
                title="Global Popular Movies"
                items={popularMovies}
                onCardClick={handleMediaClick}
                onPlay={handlePlay}
              />
            </div>
          )}

          {/* Top Rated Hits */}
          {topRatedMovies.length > 0 && (
            <div className="border border-white/10 rounded-[2.5rem] bg-white/[0.03] backdrop-blur-3xl p-8 shadow-[0_32px_80px_rgba(0,0,0,0.4)] transition-all duration-500 hover:border-white/20">
              <MediaRow
                title="Top Rated Masterpieces"
                items={topRatedMovies}
                onCardClick={handleMediaClick}
                onPlay={handlePlay}
              />
            </div>
          )}

          {/* Action Blockbusters */}
          {actionMovies.length > 0 && (
            <div className="border border-white/10 rounded-[2.5rem] bg-white/[0.03] backdrop-blur-3xl p-8 shadow-[0_32px_80px_rgba(0,0,0,0.4)] transition-all duration-500 hover:border-white/20">
              <MediaRow
                title="Action Blockbusters"
                items={actionMovies}
                onCardClick={handleMediaClick}
                onPlay={handlePlay}
              />
            </div>
          )}

          {/* Netflix Originals (Approximate) */}
          {netflixOriginals.length > 0 && (
            <div className="border border-white/10 rounded-[2.5rem] bg-white/[0.03] backdrop-blur-3xl p-8 shadow-[0_32px_80px_rgba(0,0,0,0.4)] transition-all duration-500 hover:border-white/20">
              <MediaRow
                title="Netflix & Streaming Originals"
                items={netflixOriginals}
                onCardClick={handleMediaClick}
                onPlay={handlePlay}
              />
            </div>
          )}

          {/* CineStream Gazette: Premium Editorial Experience */}
          {(newsArticles.length > 0 || loadingNews || analyzingGenres) && (
            <div className="relative group/gazette">
              <div className="absolute -inset-4 bg-red-600/5 rounded-[3rem] blur-3xl opacity-0 group-hover/gazette:opacity-100 transition-opacity duration-1000"></div>

              <div className="relative border border-white/10 rounded-[2.5rem] bg-black/40 backdrop-blur-2xl p-8 lg:p-12 mt-12 shadow-[0_45px_100px_rgba(0,0,0,0.6)] overflow-hidden">
                {/* Decorative Accents */}
                <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-red-600/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-red-600/5 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2 pointer-events-none" />

                {/* Header */}
                <div className="text-center mb-12 relative z-10">
                  <div className="flex items-center justify-center gap-4 mb-6">
                    <div className="w-16 h-16 bg-gradient-to-br from-red-600 to-red-800 rounded-3xl flex items-center justify-center shadow-2xl shadow-red-600/30">
                      <Newspaper className="h-8 w-8 text-white" />
                    </div>
                    <div className="px-4 py-2 bg-red-600/10 border border-red-600/20 text-red-500 text-sm font-black uppercase tracking-[0.2em] rounded-2xl">
                      Live Updates
                    </div>
                  </div>
                  <h2 className="text-6xl lg:text-7xl font-black italic uppercase tracking-tighter leading-none mb-4">
                    CineStream <span className="text-red-600">Gazette</span>
                  </h2>
                  <p className="text-gray-400 text-sm font-bold tracking-[0.3em] uppercase">Entertainment Intelligence Hub</p>
                  <div className="flex items-center justify-center gap-4 mt-6">
                    <div className="h-px w-20 bg-red-600/30"></div>
                    <div className="text-xs font-black uppercase text-red-500/70 tracking-[0.2em] bg-red-600/5 px-4 py-2 rounded-full border border-red-600/10">
                      {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    </div>
                    <div className="h-px w-20 bg-red-600/30"></div>
                  </div>
                </div>

                {loadingNews ? (
                  <div className="flex flex-col items-center justify-center py-32 space-y-6">
                    <div className="relative">
                      <div className="w-16 h-16 border-4 border-red-600/20 border-t-red-600 rounded-full animate-spin" />
                      <div className="absolute inset-0 bg-red-600/10 blur-xl rounded-full animate-pulse" />
                    </div>
                    <span className="text-xs font-black uppercase tracking-[0.5em] text-gray-600 animate-pulse">Gathering Intelligence...</span>
                  </div>
                ) : newsArticles.length > 0 ? (
                  <div className="space-y-12 relative z-10">
                    {/* Featured Story */}
                    {newsArticles[0] && (
                      <div className="bg-gradient-to-br from-red-600/5 to-transparent rounded-[2rem] p-8 border border-red-600/10">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></div>
                          <span className="text-sm font-black uppercase text-red-500 tracking-[0.2em]">Featured Story</span>
                        </div>
                        <div 
                          className="group/featured cursor-pointer"
                          onClick={() => window.open(newsArticles[0].url, '_blank')}
                        >
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                            <div className="order-2 lg:order-1 space-y-6">
                              <div className="inline-block px-3 py-1 bg-white/10 backdrop-blur-md border border-white/20 text-white text-xs font-black uppercase rounded-lg tracking-wider">
                                {newsArticles[0].source.name}
                              </div>
                              <h3 className="text-3xl lg:text-4xl font-black leading-tight group-hover/featured:text-red-400 transition-colors uppercase tracking-tight">
                                {newsArticles[0].title}
                              </h3>
                              <p className="text-gray-400 text-lg leading-relaxed font-medium">
                                {newsArticles[0].description}
                              </p>
                              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                                <div className="flex items-center gap-2 text-gray-500">
                                  <Clock className="h-4 w-4" />
                                  <span className="text-sm font-bold">{new Date(newsArticles[0].publishedAt).toLocaleDateString()}</span>
                                </div>
                                <button className="flex items-center gap-2 text-sm font-black text-red-500 hover:text-white transition-colors uppercase tracking-wider">
                                  Read More <ChevronRight className="h-5 w-5" />
                                </button>
                              </div>
                            </div>
                            <div className="order-1 lg:order-2 relative">
                              <div className="aspect-video rounded-2xl overflow-hidden bg-gray-900 border border-white/10">
                                <img
                                  src={newsArticles[0].urlToImage || 'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&q=80'}
                                  className="w-full h-full object-cover group-hover/featured:scale-105 transition-transform duration-700"
                                  alt=""
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* News Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {newsArticles.slice(1, 10).map((article, i) => (
                        <div
                          key={i}
                          className="group/card bg-white/[0.02] rounded-2xl overflow-hidden border border-white/5 hover:border-red-600/20 hover:bg-white/[0.05] transition-all duration-500 cursor-pointer"
                          onClick={() => window.open(article.url, '_blank')}
                        >
                          <div className="aspect-video relative overflow-hidden">
                            <img
                              src={article.urlToImage || 'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&q=80'}
                              className="w-full h-full object-cover group-hover/card:scale-110 transition-transform duration-700"
                              alt=""
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                            <div className="absolute top-4 left-4 px-2 py-1 bg-black/60 backdrop-blur-md border border-white/20 text-white text-xs font-bold uppercase rounded tracking-wider">
                              {article.source.name}
                            </div>
                          </div>
                          <div className="p-6 space-y-4">
                            <h4 className="text-lg font-black leading-snug group-hover/card:text-red-400 transition-colors line-clamp-2 uppercase tracking-tight">
                              {article.title}
                            </h4>
                            <p className="text-gray-400 text-sm leading-relaxed line-clamp-2 font-medium">
                              {article.description}
                            </p>
                            <div className="flex items-center justify-between pt-4 border-t border-white/5">
                              <div className="flex items-center gap-2 text-gray-500">
                                <Clock className="h-3 w-3" />
                                <span className="text-xs font-bold">{new Date(article.publishedAt).toLocaleDateString()}</span>
                              </div>
                              <ChevronRight className="h-4 w-4 text-red-600 group-hover/card:translate-x-1 transition-transform" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Live Feed Section */}
                    {newsArticles.length > 10 && (
                      <div className="bg-gradient-to-r from-red-600/5 via-transparent to-red-600/5 rounded-2xl p-8 border border-red-600/10">
                        <div className="flex items-center justify-between mb-8">
                          <div className="flex items-center gap-3">
                            <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></div>
                            <h3 className="text-2xl font-black uppercase text-white tracking-tight">Live Updates</h3>
                          </div>
                          <div className="px-3 py-1 bg-red-600/20 text-red-400 text-xs font-black rounded-full border border-red-600/30">
                            STREAMING
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-red-600/20">
                          {newsArticles.slice(10, 20).map((article, i) => (
                            <div
                              key={i}
                              className="flex gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-red-600/20 hover:bg-white/[0.05] transition-all cursor-pointer group/update"
                              onClick={() => window.open(article.url, '_blank')}
                            >
                              <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-800 flex-shrink-0 border border-white/10">
                                <img
                                  src={article.urlToImage || 'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&q=80'}
                                  className="w-full h-full object-cover group-hover/update:scale-110 transition-transform duration-500"
                                  alt=""
                                />
                              </div>
                              <div className="flex flex-col justify-center space-y-2 min-w-0">
                                <span className="text-xs font-bold text-red-500 uppercase tracking-wide">
                                  {article.source.name}
                                </span>
                                <h5 className="text-sm font-black leading-snug group-hover/update:text-red-400 transition-colors line-clamp-2 uppercase tracking-tight">
                                  {article.title}
                                </h5>
                                <span className="text-xs text-gray-500 font-bold">
                                  {new Date(article.publishedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-40 space-y-4">
                    <Newspaper className="h-16 w-16 text-gray-800" />
                    <div className="text-center space-y-2">
                      <p className="text-gray-500 font-black uppercase tracking-[0.5em] text-sm animate-pulse">Gathering Intelligence...</p>
                      <p className="text-gray-700 text-[10px] font-bold uppercase tracking-widest">Global news feed will refresh automatically</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DetailsModal
          item={selectedMedia}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onPlay={handlePlay}
        />
      </div>
    </div>
  );
};

export default Popular;
