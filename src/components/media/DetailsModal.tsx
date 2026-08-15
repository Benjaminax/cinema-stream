import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Tv, Play, BookmarkPlus, Check, Youtube, Maximize2, ArrowLeft } from 'lucide-react';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { TMDBResult, MediaDetails, Video } from '../../types/media';
import { getImageUrl, getDetails, getVideos, getIMDbRating, getEpisodeDetails, getSeasonDetails, getSimilar, getRecommendations, searchByGenre, normalizeTMDBResult, getCollection } from '../../api/tmdb';
import { scoreCandidate, aggregateCandidateScores, filterCandidates } from '../../utils/scoring';
import { libraryCache } from '../../utils/libraryCache';
import { addToMyList, removeFromMyList, isInMyList as checkIsInMyList } from '../../utils/myList';
import { getRecentlyWatched, normalizePath } from '../../utils/recentlyWatched';
import { getTopGenrePreferences, getPreferredGenreIds } from '../../utils/genrePreferences';
import { getNextEpisode } from '../../utils/mediaPlayback';

const PLACEHOLDER_BACKDROP = new URL('/placeholder-backdrop.png', import.meta.url).href;
const PLACEHOLDER = new URL('/placeholder.png', import.meta.url).href;

interface Episode {
  season: number;
  episode: number;
  title: string;
  path: string;
  size: number;
  modified: Date;
  overview?: string;
  still_path?: string | null;
  local_still_path?: string;
  runtime?: number | null;
  tmdb_id?: number;
  air_date?: string;
  seriesPath?: string;
  progress?: number;
  duration?: number;
}

interface DetailsModalProps {
  item: TMDBResult | null;
  isOpen: boolean;
  onClose: () => void;
  autoPlayTrailer?: boolean;
  overrideTrailerKey?: string; // Optional override: use this YouTube key instead of the TMDB-provided trailer
  onPlay?: (item: TMDBResult) => void;
  onPlayEpisode?: (episode: Episode) => void;
  forceFetchEpisodes?: boolean;
  hideSimilar?: boolean;
  hideMainPlay?: boolean; // Hide the big Play button in the hero (useful for Series views)
}

const DetailsModal: React.FC<DetailsModalProps> = ({ item, isOpen, onClose, autoPlayTrailer = false, overrideTrailerKey, onPlay, onPlayEpisode, forceFetchEpisodes = false, hideMainPlay = false }) => {
  const [details, setDetails] = useState<MediaDetails | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [showTrailer, setShowTrailer] = useState(false);
  const [loading, setLoading] = useState(false);
  const { isOnline } = useNetworkStatus();
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [attemptedEpisodeFetch, setAttemptedEpisodeFetch] = useState(false);
  const [inList, setInList] = useState(false);
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [similar, setSimilar] = useState<TMDBResult[]>([]);
  const [combinedRecommendations, setCombinedRecommendations] = useState<Array<TMDBResult & { reason?: string; score?: number }>>([]);
  const [franchiseRecommendations, setFranchiseRecommendations] = useState<Array<TMDBResult & { reason?: string; score?: number }>>([]);
  const [history, setHistory] = useState<TMDBResult[]>([]);
  const [currentItem, setCurrentItem] = useState<TMDBResult | null>(item);
  const [shouldAutoPlayNext, setShouldAutoPlayNext] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'more-like-this'>('overview');
  const [loadingImdb, setLoadingImdb] = useState(false);
  const [currentPlayingEpisode, setCurrentPlayingEpisode] = useState<Episode | null>(null);
  const [nextEpisode, setNextEpisode] = useState<Episode | null>(null);
  const [autoplayEnabled, setAutoplayEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem('cinestream_autoplay_enabled');
      return saved !== null ? JSON.parse(saved) : true;
    } catch (e) {
      return true;
    }
  });
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isTV = currentItem?.media_type === 'tv' || !!currentItem?.first_air_date;

  const modalContentRef = useRef<HTMLDivElement>(null);
  const episodesRef = useRef<Episode[]>([]);
  const currentPlayingEpisodeRef = useRef<Episode | null>(null);
  const nextEpisodeRef = useRef<Episode | null>(null);
  const lastTriggerTime = useRef<number>(0);
  // Used for either the iframe OR the Electron <webview> element
  const trailerIframeRef = useRef<HTMLElement | null>(null);

  // Playback / trailer error states
  const [trailerError, setTrailerError] = useState<{ code?: number | string; message?: string } | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  // Allow switching embed host when a trailer is blocked (youtube-nocookie sometimes blocks more videos)
  const [trailerHost, setTrailerHost] = useState<'www.youtube-nocookie.com' | 'www.youtube.com'>('www.youtube-nocookie.com');

  // Electron webview preload path (when available) — used to load the full YouTube watch page inside a webview
  const [trailerPreloadPath, setTrailerPreloadPath] = useState<string | null>(null);

  // If an override key was provided (Home requested a specific season trailer), prefer that.
  const overrideVideo = overrideTrailerKey ? ({ id: 'override', key: overrideTrailerKey, name: 'Season Trailer', site: 'YouTube', type: 'Trailer', official: true, published_at: new Date().toISOString() } as Video) : null;

  const trailer = overrideVideo || videos.find(v => v.site === 'YouTube' && v.type === 'Trailer') ||
    videos.find(v => v.site === 'YouTube' && ['Teaser', 'Clip'].includes(v.type));





  useEffect(() => {
    setCurrentItem(item);
    // Reset to overview tab when item changes
    setActiveTab('overview');
  }, [item]);

  useEffect(() => {
    if (currentItem && isOpen) {
      setInList(checkIsInMyList(currentItem.id));
    }
    const handleUpdate = () => {
      if (currentItem) setInList(checkIsInMyList(currentItem.id));
    };
    window.addEventListener('my-list-updated', handleUpdate);
    return () => window.removeEventListener('my-list-updated', handleUpdate);
  }, [currentItem, isOpen]);

  const handleToggleMyList = () => {
    if (!currentItem) return;
    if (checkIsInMyList(currentItem.id)) {
      removeFromMyList(currentItem.id);
    } else {
      addToMyList(currentItem);
    }
  };

  // Create smart recommendations combining similar content with user preferences
  const createCombinedRecommendations = (similarItems: TMDBResult[], recommendedItems: TMDBResult[], personalizedItems: TMDBResult[], currentDetails: MediaDetails | null, userPrefs: any[], mediaType: 'movie' | 'tv', excludeIds: Set<number> = new Set()) => {
    // Use the scoring utilities to produce deterministic, explainable recommendations
    const seedGenres = currentDetails?.genres?.map(g => g.id) ?? [];
    const seedYear = currentDetails?.release_date ? parseInt(currentDetails.release_date.slice(0,4)) : (currentDetails?.first_air_date ? parseInt(currentDetails.first_air_date.slice(0,4)) : undefined);

    // Tag sources for provenance
    const taggedSimilar = similarItems.map(s => ({ ...s, __sources: ['similar'] } as TMDBResult & { __sources?: string[] }));
    const taggedRecommended = recommendedItems.map(s => ({ ...s, __sources: ['recommended'] } as TMDBResult & { __sources?: string[] }));
    const taggedPersonalized = personalizedItems.map(s => ({ ...s, __sources: ['personalized'] } as TMDBResult & { __sources?: string[] }));

    // Hard-filter candidates: prefer same media type and require reasonable genre overlap
    const allCandidates = [...taggedSimilar, ...taggedRecommended, ...taggedPersonalized];
    const filtered = filterCandidates(allCandidates, { genres: seedGenres } as any, { requireSameType: true, mediaType, requireGenreDominated: true, genreThreshold: 0.25, seedYear, eraWindowYears: 25, requireSameLanguage: true, seedLanguage: currentDetails?.original_language })
      .filter(c => !excludeIds.has(c.id));

    // Score each candidate relative to the seed
    const scored = filtered.map(candidate => {
      const s = scoreCandidate({ genres: seedGenres, year: seedYear, affinity: 1 }, candidate as TMDBResult);
      // Boost items TMDB itself recommends — stronger signal
      if ((candidate as any).__sources?.includes('recommended')) {
        s.score = s.score * 1.25;
      }
      // Preserve sources
      s.candidate.__sources = Array.from(new Set([...(candidate as any).__sources || [], ...(s.candidate.__sources || [])]));
      return s;
    });

    // Aggregate multiple seed contributions (if any) and return top 20
    const aggregated = aggregateCandidateScores(scored).slice(0, 20).map(sc => {
      const reasonFromPrefs = userPrefs.length > 0 && sc.candidate.genre_ids ? userPrefs.find((p:any) => sc.candidate.genre_ids?.includes(p.id)) : null;
      let reason = sc.candidate.__sources?.includes('recommended') ? 'Recommended for you' : (sc.candidate.__sources?.includes('similar') ? 'Similar to this title' : 'Recommended for you');
      if (reasonFromPrefs) reason = `Because you enjoy ${reasonFromPrefs.name.toLowerCase()}`;
      return { ...sc.candidate, reason, score: sc.score } as TMDBResult & { reason?: string; score?: number };
    });

    return aggregated;
  };

  const fetchDetails = async () => {
    if (!currentItem || !currentItem.id) return;

    // Efficiency: Avoid re-fetching if we already have details for this item
    if (details && details.id === currentItem.id && videos.length > 0 && similar.length > 0) {
      return;
    }

    const hasTMDBMatch = currentItem.id && currentItem.id < 10000000;

    if (!hasTMDBMatch) {
      setDetails(null);
      setVideos([]);
      setSimilar([]);
      setCombinedRecommendations([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const mediaType = currentItem.media_type || (currentItem.first_air_date ? 'tv' : 'movie');
      
      // Get user's preferred genres for personalized recommendations
      const userPrefs = getTopGenrePreferences(3);
      const preferredGenreIds = getPreferredGenreIds(3);
      
      const [detailsData, videosData, rawSimilarData, rawRecommendedData, rawPersonalizedData] = await Promise.all([
        getDetails(mediaType, currentItem.id),
        getVideos(mediaType, currentItem.id),
        getSimilar(mediaType, currentItem.id),
        // TMDB's recommendations endpoint (better base signal)
        getRecommendations(mediaType, currentItem.id),
        // Get personalized recommendations based on user's genre preferences
        preferredGenreIds.length > 0 ? searchByGenre(mediaType, preferredGenreIds[0], 1).then(data => data.results || []) : Promise.resolve([])
      ]);
      
      // Normalize results to ensure consistent fields (media_type, displayTitle, displayDate)
      const normalizedSimilar = (rawSimilarData ?? []).map((r: any) => normalizeTMDBResult(r, mediaType));
      const normalizedRecommended = (rawRecommendedData ?? []).map((r: any) => normalizeTMDBResult(r, mediaType));
      const normalizedPersonalized = (rawPersonalizedData ?? []).map((r: any) => normalizeTMDBResult(r, mediaType));
      
      // Set base details/video/similar state
      setDetails(detailsData);
      setVideos(videosData);
      setSimilar(normalizedSimilar);

      // Franchise/collection: only movies can belong to a collection in TMDB
      let franchiseItems: TMDBResult[] = [];
      if (mediaType === 'movie' && (detailsData as any)?.belongs_to_collection?.id) {
        try {
          const collection = await getCollection((detailsData as any).belongs_to_collection.id);
          franchiseItems = (collection?.parts ?? []).map((p: any) => normalizeTMDBResult(p, 'movie'));
          // Exclude the current item from franchiseItems
          franchiseItems = franchiseItems.filter(f => f.id !== detailsData.id);
        } catch (e) {
          console.warn('Failed to fetch franchise collection:', e);
        }
      }

      const franchiseIdSet = new Set(franchiseItems.map(f => f.id));

      // Create combined recommendations with reasons using normalized items (exclude franchise IDs from the regular pool)
      const combined = createCombinedRecommendations(normalizedSimilar, normalizedRecommended, normalizedPersonalized, detailsData, userPrefs, mediaType, franchiseIdSet);
      setCombinedRecommendations(combined);
      setFranchiseRecommendations(franchiseItems.map(f => ({ ...f, reason: (detailsData as any)?.belongs_to_collection?.name ? `Part of ${(detailsData as any).belongs_to_collection.name}` : 'Same franchise', score: Number.POSITIVE_INFINITY } as TMDBResult & { reason?: string; score?: number })));


      if (currentItem.local_path || currentItem.local_paths) {
        libraryCache.updateMetadata(currentItem.id, mediaType === 'tv' ? 'series' : 'movie', {
          genres: detailsData.genres,
          credits: detailsData.credits
        });
      }

      if (detailsData?.imdb_id) {
        setLoadingImdb(true);
        try {
          const imdbRating = await getIMDbRating(detailsData.imdb_id);
          if (imdbRating) {
            setDetails(prev => prev ? { ...prev, imdb_rating: parseFloat(imdbRating) } : null);
          }
        } catch (imdbError) {
          console.warn('Failed to fetch IMDb rating:', imdbError);
        } finally {
          setLoadingImdb(false);
        }
      }
    } catch (error) {
      console.error('Error fetching details:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && currentItem) {
      fetchDetails();
    }
  }, [isOpen, currentItem?.id]);

  const scanForEpisodesFromTMDB = async () => {
    setAttemptedEpisodeFetch(false);
    if (!currentItem || !details || (currentItem.media_type !== 'tv' && !currentItem.first_air_date && !details.number_of_seasons)) return;

    setLoadingEpisodes(true);
    try {
      const episodeList: Episode[] = [];
      const numSeasons = details.number_of_seasons || 1;
      console.log('Scanning TMDB for episodes:', currentItem.id, 'seasons:', numSeasons);
      const seasonPromises = [];
      for (let s = 1; s <= numSeasons; s++) {
        seasonPromises.push(getSeasonDetails(currentItem.id, s));
      }

      const seasonsData = await Promise.all(seasonPromises);
      seasonsData.forEach((seasonData) => {
        if (seasonData && seasonData.episodes) {
          seasonData.episodes.forEach((ep: any) => {
            episodeList.push({
              season: ep.season_number,
              episode: ep.episode_number,
              title: ep.name,
              path: '',
              size: 0,
              modified: new Date(ep.air_date || Date.now()),
              overview: ep.overview,
              still_path: ep.still_path,
              runtime: ep.runtime,
              tmdb_id: ep.id,
              air_date: ep.air_date
            });
          });
        }
      });

      console.log('TMDB episodes fetched:', episodeList.length);
      setEpisodes(episodeList);
      const uniqueSeasons = Array.from(new Set(episodeList.map(ep => ep.season))).sort((a, b) => a - b);
      setSelectedSeason(prev => prev ?? uniqueSeasons[0] ?? null);
    } catch (error) {
      console.error('Error fetching episodes from TMDB:', error);
    } finally {
      setLoadingEpisodes(false);
      setAttemptedEpisodeFetch(true);
    }
  };

  const hydrateEpisodesWithMetadata = async (episodesList: Episode[]) => {
    const uniqueSeasons = Array.from(new Set(episodesList.map(ep => ep.season))).sort((a, b) => a - b);
    if (!currentItem || episodesList.length === 0) {
      setEpisodes(episodesList);
      setSelectedSeason(prev => prev ?? uniqueSeasons[0] ?? null);
      return;
    }

    try {
      await libraryCache.load();
    } catch (error) {
      console.warn('Unable to load library cache for episodes:', error);
    }

    const hasTMDBMatch = currentItem.id && currentItem.id < 10000000;
    const hydrated = await Promise.all(episodesList.map(async (episode) => {
      const episodeSeriesPath = episode.seriesPath || currentItem.local_path!;
      let cached = libraryCache.getEpisode(episodeSeriesPath, episode.season, episode.episode);

      if (!cached && hasTMDBMatch) {
        try {
          const tmdbEpisode = await getEpisodeDetails(currentItem.id!, episode.season, episode.episode);
          if (tmdbEpisode) {
            const entry = {
              season: episode.season,
              episode: episode.episode,
              overview: tmdbEpisode.overview,
              runtime: tmdbEpisode.runtime ?? undefined,
              air_date: tmdbEpisode.air_date,
              tmdb_id: tmdbEpisode.id,
              still_path: tmdbEpisode.still_path,
              title: tmdbEpisode.name || episode.title,
            };
            cached = await libraryCache.setEpisode(episodeSeriesPath, episode.season, episode.episode, entry);
          }
        } catch (error) {
          console.warn('Failed to fetch TMDB episode data:', error);
        }
      }
      const rw = getRecentlyWatched();
      const episodeRW = rw.find(i => normalizePath(i.path) === normalizePath(episode.path));

      return {
        ...episode,
        title: cached?.title || episode.title,
        overview: cached?.overview || episode.overview,
        still_path: cached?.still_path ?? episode.still_path,
        local_still_path: cached?.local_still_path ?? episode.local_still_path,
        runtime: cached?.runtime ?? episode.runtime,
        tmdb_id: cached?.tmdb_id ?? episode.tmdb_id,
        air_date: cached?.air_date ?? episode.air_date,
        progress: episodeRW?.progress,
        duration: episodeRW?.duration
      } as Episode;
    }));

    setEpisodes(hydrated);
    setSelectedSeason(prev => prev ?? uniqueSeasons[0] ?? null);
  };

  // Live update listener for progress tracking
  useEffect(() => {
    const handleUpdate = () => {
      if (episodes.length > 0) {
        const rw = getRecentlyWatched();
        setEpisodes(prev => prev.map(ep => {
          const episodeRW = rw.find(i => normalizePath(i.path) === normalizePath(ep.path));
          return {
            ...ep,
            progress: episodeRW?.progress,
            duration: episodeRW?.duration
          };
        }));
      }
    };
    window.addEventListener('recently-watched-updated', handleUpdate);
    return () => window.removeEventListener('recently-watched-updated', handleUpdate);
  }, [episodes.length]);

  const scanForEpisodes = async () => {
    setAttemptedEpisodeFetch(false);
    if (!currentItem || !window.electronAPI) return;
    const paths = currentItem.local_paths || (currentItem.local_path ? [currentItem.local_path] : []);
    if (paths.length === 0) return;

    setLoadingEpisodes(true);
    try {
      const episodesList: Episode[] = [];
      for (const path of paths) {
        const seriesFiles = await window.electronAPI.scanDirectory(path);
        const seasonDirs = seriesFiles.filter(file => file.type === 'directory' && /^(season|series|s)\s*\d+$/i.test(file.name));
        seasonDirs.sort((a, b) => {
          const aNum = parseInt(a.name.match(/(\d+)/)?.[1] || '0');
          const bNum = parseInt(b.name.match(/(\d+)/)?.[1] || '0');
          return aNum - bNum;
        });

        if (seasonDirs.length > 0) {
          for (const seasonDir of seasonDirs) {
            const seasonNum = parseInt(seasonDir.name.match(/(\d+)/)?.[1] || '0');
            const seasonFiles = await window.electronAPI.scanDirectory(seasonDir.path);
            const episodeFiles = seasonFiles.filter(file => file.type === 'file' && /\.(mp4|mkv|avi|mov|wmv|flv|webm|m4v|mpg|mpeg|m2ts|ts|vob|flv|divx|xvid|av1)$/i.test(file.name));
            episodeFiles.sort((a, b) => {
              const getEpNum = (name: string) => {
                const m = name.match(/s\d+[-._ ]*e(\d+)/i) || name.match(/(\d+)x(\d+)/) || name.match(/episode\s*(\d+)/i) || name.match(/[ _]-[ _]\[?(\d+)/);
                return parseInt(m?.[1] || m?.[2] || '0');
              };
              return getEpNum(a.name) - getEpNum(b.name);
            });

            for (const epFile of episodeFiles) {
              const epNum = parseInt(epFile.name.match(/s\d+[-._ ]*e(\d+)/i)?.[1] || epFile.name.match(/(\d+)x(\d+)/)?.[2] || episodesList.filter(e => e.season === seasonNum).length + 1 + '');
              episodesList.push({
                season: seasonNum,
                episode: parseInt(epNum + ''),
                title: epFile.name.replace(/\.[^/.]+$/, "").replace(/s\d+e\d+/i, "").trim() || `Episode ${epNum}`,
                path: epFile.path,
                size: epFile.size,
                modified: epFile.modified ? new Date(epFile.modified) : new Date(),
                seriesPath: path
              });
            }
          }
        } else {
          const episodeFiles = seriesFiles.filter(file => file.type === 'file' && /\.(mp4|mkv|avi|mov|wmv|flv|webm|m4v)$/i.test(file.name));
          episodeFiles.forEach((epFile, idx) => {
            episodesList.push({
              season: 1,
              episode: idx + 1,
              title: epFile.name.replace(/\.[^/.]+$/, "").trim(),
              path: epFile.path,
              size: epFile.size,
              modified: epFile.modified ? new Date(epFile.modified) : new Date(),
              seriesPath: path
            });
          });
        }
      }
      await hydrateEpisodesWithMetadata(episodesList);
    } catch (error) {
      console.error('Error scanning for episodes:', error);
    } finally {
      setLoadingEpisodes(false);
      setAttemptedEpisodeFetch(true);
    }
  };

  useEffect(() => {
    if (currentItem && isOpen) {
      const shouldPlay = shouldAutoPlayNext || autoPlayTrailer;
      // Only attempt autoplay when online to avoid iframe load errors when offline
      setShowTrailer(isOnline ? shouldPlay : false);
      // autoplay should show trailer; leave unmuted by default
      setShouldAutoPlayNext(false); // Reset after use
      fetchDetails();
      const isTVItem = currentItem.media_type === 'tv' || currentItem.first_air_date;
      if (isTVItem && (currentItem.local_path || currentItem.local_paths)) {
        scanForEpisodes();
      }
    }
  }, [currentItem, isOpen, autoPlayTrailer, shouldAutoPlayNext, isOnline]);

  // Listen for YouTube iframe postMessage events so we can show a friendly error when a trailer
  // is blocked/unavailable (e.g. "This video is unavailable / error code ..."). The embed uses
  // enablejsapi=1 so the player will post JSON messages we can parse.
  useEffect(() => {
    if (!showTrailer || !trailer) {
      setTrailerError(null);
      return;
    }

    const handleYouTubeMessage = (ev: MessageEvent) => {
      if (!ev.data) return;
      let payload: any = ev.data;
      try {
        // YouTube sometimes posts stringified JSON
        if (typeof ev.data === 'string') payload = JSON.parse(ev.data);
      } catch (err) {
        return;
      }

      // Look for onError events from the YT player
      if (payload && payload.event === 'onError') {
        const code = payload?.data ?? payload?.info ?? 'unknown';
        console.warn('YouTube iframe error detected:', code, payload);
        setTrailerError({ code, message: `YouTube player error ${String(code)}` });
      }
    };

    window.addEventListener('message', handleYouTubeMessage);
    return () => window.removeEventListener('message', handleYouTubeMessage);
  }, [showTrailer, trailer]);

  // Keep theater mode synced with fullscreen state
  useEffect(() => {
    const onFsChange = () => {
      setIsTheaterMode(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // When running in Electron, request the trailer webview preload path so we can load the full YouTube watch page
  useEffect(() => {
    let mounted = true;
    if (showTrailer && trailer && (window as any).electronAPI?.getTrailerPreloadPath && !trailerPreloadPath) {
      (window as any).electronAPI.getTrailerPreloadPath()
        .then((p: string) => { if (mounted) setTrailerPreloadPath(p); })
        .catch((err: any) => console.warn('Failed to get trailer preload path:', err));
    }
    return () => { mounted = false; };
  }, [showTrailer, trailer, trailerPreloadPath]);

  // Attach listeners to Electron webview when present (to detect load failures / dom-ready)
  useEffect(() => {
    if (!showTrailer || !(window as any).electronAPI) return;
    const el = trailerIframeRef.current as any;
    if (!el || typeof el.addEventListener !== 'function') return;

    const onDomReady = () => setTrailerError(null);
    const onFail = (e: any) => {
      console.warn('Trailer webview failed to load:', e);
      setTrailerError({ message: 'Failed to load YouTube watch page inside the app.' } as any);
    };

    el.addEventListener('dom-ready', onDomReady);
    el.addEventListener('did-fail-load', onFail);
    return () => {
      try { el.removeEventListener('dom-ready', onDomReady); } catch (e) {}
      try { el.removeEventListener('did-fail-load', onFail); } catch (e) {}
    };
  }, [showTrailer, trailerPreloadPath]);

  useEffect(() => {
    const isTVItem = currentItem?.media_type === 'tv' || currentItem?.first_air_date;
    if (isOpen && currentItem && isTVItem && !currentItem.local_path && !currentItem.local_paths && forceFetchEpisodes && details) {
      scanForEpisodesFromTMDB();
    }
  }, [isOpen, currentItem?.id, details?.id, forceFetchEpisodes]);

  useEffect(() => {
    if (!isOpen) {
      setHistory([]);
      setCurrentItem(item);
    } else if (item && !currentItem) {
      setCurrentItem(item);
    }
  }, [isOpen, item]);

  // Update refs when state changes
  useEffect(() => {
    episodesRef.current = episodes;
  }, [episodes]);

  useEffect(() => {
    currentPlayingEpisodeRef.current = currentPlayingEpisode;
    
    // Calculate next episode for ref
    if (currentPlayingEpisode && episodes.length > 0) {
      const sorted = [...episodes].sort((a, b) => 
        a.season !== b.season ? a.season - b.season : a.episode - b.episode
      );
      const idx = sorted.findIndex(ep => ep.season === currentPlayingEpisode.season && ep.episode === currentPlayingEpisode.episode);
      if (idx !== -1 && idx < sorted.length - 1) {
        nextEpisodeRef.current = sorted[idx + 1];
        setNextEpisode(sorted[idx + 1]);
      } else {
        nextEpisodeRef.current = null;
        setNextEpisode(null);
      }
    } else {
      nextEpisodeRef.current = null;
      setNextEpisode(null);
    }
  }, [currentPlayingEpisode, episodes]);

  // Handle Countdown completion
  useEffect(() => {
    if (countdown === 0 && nextEpisode) {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      handleEpisodePlay(nextEpisode);
      setCountdown(null);
    }
  }, [countdown, nextEpisode]);

  // Listen for playback-ended to trigger autoplay
  useEffect(() => {
    if (!(window as any).electronAPI) return;

    const handleEnded = (_: any, data: any) => {
      console.log('🎬 Renderer: Playback ended:', data);
      
      const isAutoplayOn = () => {
        try {
          const saved = localStorage.getItem('cinestream_autoplay_enabled');
          return saved !== null ? JSON.parse(saved) : true;
        } catch (e) { return true; }
      };

      if (!isAutoplayOn()) return;
      
      // Prevent double triggers
      const now = Date.now();
      if (lastTriggerTime.current && (now - lastTriggerTime.current < 2500)) return;

      const curEp = currentPlayingEpisodeRef.current;
      const allEps = episodesRef.current;
      
      if (curEp && allEps.length > 0 && data.reason === 'completed') {
        const nextEp = getNextEpisode(curEp, allEps);
        
        if (nextEp) {
          console.log('🎬 Next episode found:', nextEp.title);
          lastTriggerTime.current = now;
          setNextEpisode(nextEp);
          
          setCountdown(5);
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
          
          countdownIntervalRef.current = setInterval(() => {
            setCountdown(prev => (prev !== null && prev > 0) ? prev - 1 : prev);
          }, 1000);
        }
      }
    };

    (window as any).electronAPI.on('playback-ended', handleEnded);
    return () => {
      (window as any).electronAPI.removeListener('playback-ended', handleEnded);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [onPlayEpisode]);

  // Sync currentPlayingEpisode with recently watched when modal opens
  useEffect(() => {
    if (isOpen && isTV && episodes.length > 0 && !currentPlayingEpisode) {
      const rw = getRecentlyWatched();
      // Look for the most recent episode from this specific series
      const seriesEp = rw.find(item => 
        item.type === 'episode' && 
        episodes.some(ep => normalizePath(ep.path) === normalizePath(item.path))
      );
      
      if (seriesEp) {
        const matchingEp = episodes.find(ep => normalizePath(ep.path) === normalizePath(seriesEp.path));
        if (matchingEp) {
          console.log('🎬 Syncing currentPlayingEpisode from history:', matchingEp.title);
          setCurrentPlayingEpisode(matchingEp);
        }
      }
    }
  }, [isOpen, isTV, episodes.length, currentPlayingEpisode, normalizePath]);

  const handleItemClick = (media: TMDBResult, autoPlay: boolean = false) => {
    if (currentItem) setHistory(prev => [...prev, currentItem]);
    if (autoPlay) setShouldAutoPlayNext(true);
    setCurrentItem(media);
    // Ensure we show the Overview tab when navigating to a recommended item
    setActiveTab('overview');
    if (modalContentRef.current) modalContentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBack = () => {
    if (history.length > 0) {
      const prev = history[history.length - 1];
      setHistory(h => h.slice(0, -1));
      setCurrentItem(prev);
      if (modalContentRef.current) modalContentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };



  if (!isOpen || !currentItem) return null;

  const displayTitle = currentItem.name || currentItem.title || 'Unknown Title';

  const handleEpisodePlay = async (ep: Episode) => {
    try {
      const now = Date.now();
      lastTriggerTime.current = now; // Mark manual trigger too
      setCurrentPlayingEpisode(ep);
      await onPlayEpisode?.(ep);
    } catch (err: any) {
      console.error('Episode play failed', err);
      setPlaybackError(err?.message || 'Failed to play episode');
    }
  };

  const releaseDate = currentItem.release_date || currentItem.first_air_date;
  const year = releaseDate ? new Date(releaseDate).getFullYear() : null;

  const formatRuntime = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const formatFileSize = (bytes: number) => {
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + ['B', 'KB', 'MB', 'GB', 'TB'][i];
  };

  const exitTrailer = async () => {
    setShowTrailer(false);
    setIsTheaterMode(false);
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch (err) {
      console.warn('Error exiting fullscreen:', err);
    }
  };

  const handlePlayTrailer = () => {
    if (!trailer) return;
    if (!isOnline) {
      // If offline, open external YouTube watch page instead of trying to load the iframe
      if (window.electronAPI?.openExternal) {
        window.electronAPI.openExternal(`https://www.youtube.com/watch?v=${trailer.key}`);
      }
      return;
    }

    // Show the inline iframe (do not auto-enter fullscreen)
    setShowTrailer(true);
  };

  const handlePopOutTrailer = () => {
    if (!trailer) return;
    if (!isOnline) {
      if (window.electronAPI?.openExternal) {
        window.electronAPI.openExternal(`https://www.youtube.com/watch?v=${trailer.key}`);
      }
      return;
    }

    if (trailer && window.electronAPI) {
      window.electronAPI.openTrailerWindow({
        url: `https://www.youtube.com/embed/${trailer.key}?autoplay=1&mute=0&modestbranding=1&rel=0&iv_load_policy=3`,
        title: `${displayTitle} - Trailer`
      });
      exitTrailer();
    }
  };

  const handleExternalYouTube = () => {
    if (trailer && window.electronAPI) {
      window.electronAPI.openExternal(`https://www.youtube.com/watch?v=${trailer.key}`);
      exitTrailer();
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      if (showTrailer) {
        exitTrailer();
      } else {
        onClose();
      }
    }
  };

  // Use the current page origin for the YouTube origin param and allow switching hosts when blocked
  const pageOrigin = (typeof window !== 'undefined' && window.location && window.location.origin) ? encodeURIComponent(window.location.origin) : encodeURIComponent('https://localhost');
  const trailerSrc = trailer ? `https://${trailerHost}/embed/${trailer.key}?origin=${pageOrigin}&enablejsapi=1&autoplay=1&mute=0&modestbranding=1&rel=0&iv_load_policy=3&playsinline=1` : '';

  return createPortal((
    <div className="fixed inset-0 z-[99999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6" onClick={handleBackdropClick}>
      <div ref={modalContentRef} className="w-full max-w-[1000px] h-full max-h-[92vh] overflow-y-auto overscroll-contain flex flex-col rounded-3xl border border-white/10 bg-[#111] relative shadow-2xl scrollbar-hide">

        {/* Playback error banner */}
        {playbackError && (
          <div className="absolute top-6 left-1/2 transform -translate-x-1/2 bg-red-700/90 text-white px-4 py-2 rounded-lg z-50 flex items-center gap-3 border border-red-500/30">
            <strong className="text-sm">Playback error:</strong>
            <span className="text-sm text-zinc-100 truncate max-w-[40ch]">{playbackError}</span>
            <div className="ml-3 flex gap-2">
              <button onClick={() => { try { navigator?.clipboard?.writeText(playbackError); } catch (e) {} }} className="text-xs px-2 py-1 bg-white/10 rounded">Copy</button>
              <button onClick={() => setPlaybackError(null)} className="text-xs px-2 py-1 bg-white/10 rounded">Dismiss</button>
            </div>
          </div>
        )}

        {/* Hero Section */}
        <div className={`relative transition-all duration-700 ease-in-out bg-black overflow-hidden flex-shrink-0 ${isTheaterMode ? 'h-full z-50' : 'aspect-video'
          }`}>
          {/* Autoplay Next Episode Countdown Overlay */}
          {countdown !== null && nextEpisode && (
            <div className="absolute inset-0 z-[100] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-8 animate-in fade-in duration-500">
              <div className="text-red-600 font-black tracking-widest uppercase text-sm mb-4">Up Next in {countdown}s</div>
              <div className="relative w-64 aspect-video rounded-2xl overflow-hidden mb-6 shadow-2xl border border-white/10">
                <img 
                  src={nextEpisode.local_still_path || getImageUrl(nextEpisode.still_path || null, 'w500')} 
                  className="w-full h-full object-cover opacity-60" 
                  alt="" 
                  onError={(e) => { const t = e.target as HTMLImageElement; t.src = PLACEHOLDER_BACKDROP; }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <button 
                    onClick={() => { 
                      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current); 
                      handleEpisodePlay(nextEpisode); 
                      setCountdown(null); 
                    }} 
                    className="p-4 bg-white text-black rounded-full hover:scale-110 transition-transform"
                  >
                    <Play fill="black" size={32} className="translate-x-0.5" />
                  </button>
                </div>
              </div>
              <h3 className="text-3xl font-black text-white text-center mb-2">{nextEpisode?.title || 'Next Episode'}</h3>
              <p className="text-zinc-400 font-bold mb-8 italic">
                {nextEpisode?.season !== undefined ? `S${nextEpisode.season}` : ''} 
                {nextEpisode?.episode !== undefined ? ` E${nextEpisode.episode}` : ''}
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setCountdown(null)} 
                  className="px-8 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => { 
                    try {
                      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current); 
                      handleEpisodePlay(nextEpisode); 
                      setCountdown(null); 
                    } catch (e) {
                      console.error('Failed to play next episode:', e);
                      setCountdown(null);
                    }
                  }} 
                  className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-all"
                >
                  Play Now
                </button>
              </div>
            </div>
          )}
          {showTrailer && trailer ? (
            <div className="absolute inset-0 z-10 bg-black flex items-center justify-center">
              {((window as any).electronAPI && trailerPreloadPath) ? (
                /* Use an Electron <webview> and let the preload aggressively strip YouTube page chrome so only the video/player is visible. */
                // @ts-ignore - Electron webview element
                <webview
                  ref={(el) => { trailerIframeRef.current = el as HTMLElement | null; }}
                  src={`https://www.youtube.com/watch?v=${trailer.key}`}
                  preload={trailerPreloadPath!}
                  partition="persist:youtube"
                  className="w-full h-full min-h-[360px]"
                  allowFullScreen
                  webpreferences="contextIsolation=yes"
                />
              ) : (
                <iframe
                  ref={el => { trailerIframeRef.current = el as HTMLIFrameElement | null; }}
                  src={trailerSrc}
                  className="w-full h-full min-h-[360px]"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                  allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                  frameBorder="0"
                  title="Trailer"
                  onLoad={() => setTrailerError(null)}
                />
              )}

              {/* Trailer error overlay (e.g. "This video is unavailable" / YouTube error codes) */}
              {trailerError && (
                <div className="absolute inset-0 z-30 flex items-center justify-center p-6">
                  <div className="max-w-lg bg-[#0b0b0b] border border-red-600/30 rounded-2xl p-6 text-center shadow-xl">
                    <div className="text-red-400 font-black text-2xl mb-3">This video is unavailable</div>
                    <p className="text-sm text-zinc-300 mb-4">YouTube returned an error (code: {String(trailerError.code)}). Possible causes: the video owner disallowed embedding, or the packaged app lacks EME/Widevine support (common for Error 152/153).</p>

                    {/* Offer an alternate embed host + actionable fixes for packaged builds */}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-3">
                      <button onClick={handleExternalYouTube} className="px-4 py-2 bg-white text-black rounded-lg font-bold">Open on YouTube</button>

                      <button
                        onClick={() => {
                          // Try the alternative host and reload the iframe
                          setTrailerHost(prev => prev === 'www.youtube-nocookie.com' ? 'www.youtube.com' : 'www.youtube-nocookie.com');
                          setTrailerError(null);
                          setShowTrailer(false);
                          setTimeout(() => setShowTrailer(true), 120);
                        }}
                        className="px-4 py-2 bg-white/10 text-white border border-white/10 rounded-lg"
                      >Try alternate embed</button>

                      <button onClick={() => { if (window.electronAPI?.openExternal) window.electronAPI.openExternal('https://www.electronjs.org/docs/latest/tutorial/security'); }} className="px-4 py-2 bg-white/10 text-white border border-white/10 rounded-lg">Packaging tips</button>
                    </div>

                    <div className="flex items-center justify-center gap-3">
                      <button onClick={() => { try { navigator?.clipboard?.writeText(`YouTube error ${String(trailerError.code)} for video ${trailer?.key}`); } catch (e) {} }} className="px-3 py-2 bg-white/10 text-white border border-white/10 rounded-lg">Copy</button>
                      <button onClick={() => { setTrailerError(null); exitTrailer(); }} className="px-3 py-2 bg-white/10 text-white border border-white/10 rounded-lg">Dismiss</button>
                    </div>

                    {/* Targeted advice for 152/153 */}
                    {(trailerError.code === 152 || trailerError.code === '152' || trailerError.code === 153 || trailerError.code === '153') && (
                      <div className="mt-4 text-xs text-zinc-400 text-left">
                        <strong>Packaged app note:</strong> Error 152/153 often means EME/Widevine is unavailable in the packaged build. Ensure Electron &gt;= 25, set a desktop user‑agent, enable Widevine with <code>app.commandLine.appendSwitch('enable-widevine-cdm')</code>, and include platform Widevine binaries when packaging.
                      </div>
                    )}
                  </div>
                </div>
              )}

                {/* Cinematic Floating Controls */}
                <div className="absolute top-6 left-6 flex items-center gap-2 z-[200]">
                  <button
                    onClick={() => {
                      setShowTrailer(false);
                      setIsTheaterMode(false);
                    }}
                    className="p-3 bg-black/40 hover:bg-black/80 backdrop-blur-xl rounded-full text-white transition-all border border-white/10 shadow-2xl"
                    title="Close Media"
                  >
                    <X className="h-6 w-6" />
                  </button>

                  <div className="flex items-center gap-3 ml-2">
                    <button
                      onClick={() => setIsTheaterMode(!isTheaterMode)}
                      className={`flex items-center gap-2 px-5 py-2.5 backdrop-blur-xl rounded-full text-white text-xs font-black uppercase tracking-tighter transition-all border shadow-2xl ${isTheaterMode
                        ? 'bg-red-600 border-red-600 shadow-red-900/40'
                        : 'bg-black/40 hover:bg-black/80 border-white/10'
                        }`}
                    >
                      <Maximize2 className={`h-4 w-4 transition-transform duration-500 ${isTheaterMode ? 'rotate-180 scale-110' : ''}`} />
                      {isTheaterMode ? 'Exit Cinema' : 'Cinema Mode'}
                    </button>


                    <button
                      onClick={handlePopOutTrailer}
                      className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-xl rounded-full text-white text-xs font-black uppercase tracking-tighter transition-all border border-white/10 shadow-2xl"
                    >
                      Pop-out
                    </button>
                  </div>
                </div>

                {/* Decorative Shadow Overlay for Theater Mode */}
                {isTheaterMode && (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40 z-[100] pointer-events-none" />
                    <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-black/40 z-[100] pointer-events-none" />
                  </>
                )}
            </div>
          ) : (
            <>
              <img
                src={currentItem?.local_backdrop_path || getImageUrl(currentItem?.backdrop_path || null, 'original') || PLACEHOLDER_BACKDROP}
                alt={currentItem?.title || currentItem?.name}
                className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-[2000ms] ease-out"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = PLACEHOLDER_BACKDROP;
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#111] via-[#111]/60 to-transparent" />

              {/* Overlay Action */}
              <div className="absolute inset-0 flex items-center justify-center">
                <button
                  onClick={handlePlayTrailer}
                  className="group relative flex items-center justify-center"
                >
                  <div className="absolute inset-0 bg-red-600 rounded-full blur-2xl opacity-0 group-hover:opacity-40 transition-opacity duration-500" />
                  <div className="w-20 h-20 bg-white/10 hover:bg-red-600 backdrop-blur-md rounded-full flex items-center justify-center transition-all duration-500 border border-white/20 group-hover:scale-110 group-hover:border-red-600/50 shadow-2xl">
                    <Play className="h-8 w-8 text-white fill-current translate-x-1" />
                  </div>
                  <span className="absolute -bottom-10 whitespace-nowrap text-white text-xs font-black uppercase tracking-[0.2em] opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-2 group-hover:translate-y-0">
                    Play Preview
                  </span>
                </button>
              </div>
            </>
          )}

          {!showTrailer && (
            <div className="absolute bottom-10 left-10 right-10 z-10">
              <h1 className="text-4xl md:text-6xl font-black text-white mb-6 drop-shadow-2xl">{displayTitle}</h1>
              <div className="flex items-center gap-4">
                {onPlay && currentItem && !isTV && !hideMainPlay && (
                  <button onClick={async () => {
                    try {
                      await onPlay?.(currentItem as TMDBResult);
                    } catch (err: any) {
                      console.error('Play handler threw an error:', err);
                      setPlaybackError(err?.message || 'Failed to start playback.');
                    }
                  }} className="flex items-center gap-3 px-10 py-3 bg-white text-black rounded-lg hover:bg-zinc-200 transition-all font-bold text-xl active:scale-95"><Play fill="black" /> Play</button>
                )} 

                {isTV && currentPlayingEpisode && nextEpisode && (
                  <button 
                    onClick={() => handleEpisodePlay(nextEpisode)}
                    className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all font-bold text-lg active:scale-95 border border-white/20"
                    title={`Up Next: ${nextEpisode.title}`}
                  >
                    <span className="text-sm font-black uppercase tracking-wider">Next</span>
                  </button>
                )}
                <button
                  onClick={handleToggleMyList}
                  className="group p-2.5 bg-black/40 hover:bg-black/60 border border-white/30 rounded-full text-white transition-all ring-offset-black hover:ring-2 hover:ring-white"
                >
                  {inList ? <Check className="h-6 w-6" /> : <BookmarkPlus className="h-6 w-6" />}
                </button>

                {trailer && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handlePlayTrailer}
                      className="p-2.5 border rounded-full transition-all ring-offset-black bg-black/40 hover:bg-black/60 border-white/30 text-white hover:ring-2 hover:ring-white"
                      title="Inline Trailer"
                    >
                      <Tv className="h-6 w-6" />
                    </button>
                    <button
                      onClick={handleExternalYouTube}
                      className="p-2.5 border rounded-full transition-all ring-offset-black bg-black/40 hover:bg-black/60 border-white/30 text-white hover:ring-2 hover:ring-white"
                      title="Watch on YouTube (External)"
                    >
                      <Youtube className="h-6 w-6" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Close & Back Buttons */}
          <div className="absolute top-6 right-6 flex items-center gap-3 z-20">
            {history.length > 0 && (
              <button
                onClick={handleBack}
                className="p-2 bg-[#141414]/80 hover:bg-[#141414] rounded-full text-white transition-all flex items-center gap-2 pr-4 pl-3 border border-white/10"
              >
                <ArrowLeft className="h-5 w-5" />
                <span className="text-sm font-bold">Back</span>
              </button>
            )}

            {/* Hide main close while trailer is playing to avoid accidental close */}
            {!showTrailer && (
              <button
                onClick={onClose}
                className="p-2 bg-[#141414]/80 hover:bg-[#141414] rounded-full text-white transition-all border border-white/10"
                aria-label="Close"
              >
                <X className="h-6 w-6" />
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className={`transition-all duration-700 ${isTheaterMode ? 'opacity-0 scale-95 translate-y-10' : 'opacity-100'}`}>
          <div className="px-10 py-6 border-b border-white/10">
            <div className="flex space-x-8">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-4 py-2 text-lg font-bold transition-colors relative ${
                  activeTab === 'overview'
                    ? 'text-white'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Overview
                {activeTab === 'overview' && (
                  <div className="absolute bottom-0 left-0 w-full h-0.5 bg-red-600 rounded-full" />
                )}
              </button>
              <button
                onClick={() => setActiveTab('more-like-this')}
                className={`px-4 py-2 text-lg font-bold transition-colors relative ${
                  activeTab === 'more-like-this'
                    ? 'text-white'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Recommended For You
                {activeTab === 'more-like-this' && (
                  <div className="absolute bottom-0 left-0 w-full h-0.5 bg-red-600 rounded-full" />
                )}
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="px-10 py-8">
            {activeTab === 'overview' && (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-12 mb-12">
                  <div className="space-y-8">
                    <div className="flex items-center gap-4 text-sm font-bold">
                      {(currentItem.vote_average || details?.vote_average) && <span className="text-emerald-400">{Math.round((currentItem.vote_average || details?.vote_average || 0) * 10)}% Match</span>}
                      {details?.imdb_rating && (
                        <div className="flex items-center gap-1">
                          <span className="text-yellow-400 font-black text-xs">IMDb</span>
                          <span className="text-yellow-400 font-bold">{details.imdb_rating.toFixed(1)}/10</span>
                        </div>
                      )}
                      {year && <span className="text-zinc-500">{year}</span>}
                      {(currentItem.duration || details?.runtime) && <span className="text-zinc-500">{formatRuntime(currentItem.duration || details?.runtime || 0)}</span>}
                      <span className="px-1.5 py-0.5 border border-white/30 rounded text-[10px] text-zinc-400 uppercase">4K Ultra HD</span>
                    </div>
                    <p className="text-xl text-zinc-300 leading-relaxed font-medium">{currentItem.overview || details?.overview || "No description available."}</p>
                  </div>

                  <div className="space-y-6 text-sm">
                    <div><span className="text-zinc-500 font-bold block mb-1">Starring</span><span className="text-zinc-300">{(details?.credits?.cast || currentItem.credits?.cast || []).slice(0, 5).map(c => c.name).join(', ')}</span></div>
                    <div><span className="text-zinc-500 font-bold block mb-1">Genres</span><span className="text-zinc-300">{(details?.genres || currentItem.genres || []).map((g: any) => g.name).join(', ')}</span></div>
                    
                    {/* Ratings Section */}
                    {((currentItem.vote_average || details?.vote_average) || details?.imdb_rating || (details?.imdb_id && loadingImdb)) && (
                      <div className="pt-4 border-t border-white/10">
                        <span className="text-zinc-500 font-bold block mb-2">Ratings</span>
                        <div className="space-y-2">
                          {(currentItem.vote_average || details?.vote_average) && (
                            <div className="flex items-center justify-between">
                              <span className="text-zinc-400 text-xs">TMDB</span>
                              <div className="flex items-center gap-2">
                                <div className="flex items-center">
                                  <span className="text-emerald-400 font-bold text-sm">{((currentItem.vote_average || details?.vote_average || 0) * 10).toFixed(0)}%</span>
                                </div>
                              </div>
                            </div>
                          )}
                          {(details?.imdb_rating || (details?.imdb_id && loadingImdb)) && (
                            <div className="flex items-center justify-between">
                              <span className="text-zinc-400 text-xs">IMDb</span>
                              <div className="flex items-center gap-2">
                                {loadingImdb ? (
                                  <div className="animate-spin rounded-full h-3 w-3 border border-yellow-400 border-t-transparent"></div>
                                ) : details?.imdb_rating ? (
                                  <>
                                    <span className="text-yellow-400 font-bold text-sm">{details.imdb_rating.toFixed(1)}</span>
                                    <span className="text-zinc-500 text-xs">/10</span>
                                  </>
                                ) : null}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {details?.status && <div><span className="text-zinc-500 font-bold block mb-1">Status</span><span className={`font-bold ${details.status === 'Ended' ? 'text-red-500' : 'text-emerald-500'}`}>{details.status}</span></div>}

                    {currentItem.local_path && (
                      <div className="pt-4 border-t border-white/10">
                        <span className="text-zinc-500 uppercase text-[10px] font-bold block mb-2 tracking-widest">File Info</span>
                        <div className="space-y-1 text-xs text-zinc-400 font-medium">
                          <p>Format: <span className="text-zinc-200">{(currentItem as any).videoCodec || 'H.264'}</span></p>
                          <p>Size: <span className="text-zinc-200">{currentItem.file_size ? formatFileSize(currentItem.file_size) : '–'}</span></p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* TV Episodes within Overview Tab */}
                {isTV && (loadingEpisodes || episodes.length > 0 || attemptedEpisodeFetch) && (
                  <div className="pt-12 border-t border-white/10">
                    <div className="flex items-center justify-between mb-8">
                      <h2 className="text-3xl font-black text-white uppercase tracking-wider">Episodes</h2>
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2 mr-2">
                          <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-black">Autoplay</span>
                          <button 
                            onClick={() => setAutoplayEnabled(!autoplayEnabled)}
                            className={`relative w-10 h-5 rounded-full transition-all duration-300 ${autoplayEnabled ? 'bg-red-600' : 'bg-zinc-700'}`}
                          >
                            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300 shadow-sm ${autoplayEnabled ? 'left-6' : 'left-1'}`} />
                          </button>
                        </div>
                        <select value={selectedSeason ?? ''} onChange={(e) => setSelectedSeason(Number(e.target.value))} className="bg-[#222] border border-white/10 text-white rounded-xl px-5 py-2.5 outline-none font-bold text-sm focus:ring-2 focus:ring-red-600">
                          {Array.from(new Set(episodes.map(ep => ep.season))).sort((a, b) => a - b).map(s => <option key={s} value={s}>Season {s}</option>)}
                        </select>
                      </div>
                    </div>

                    {loadingEpisodes ? (
                      <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600"></div></div>
                    ) : episodes.length > 0 ? (
                      <div className="space-y-4">
                        {episodes.filter(ep => ep.season === selectedSeason).sort((a, b) => a.episode - b.episode).map((ep) => (
                          <div 
                            key={`${ep.season}-${ep.episode}`} 
                            className={`group flex gap-8 p-6 rounded-2xl transition-all cursor-pointer border ${
                              currentPlayingEpisode?.path === ep.path 
                                ? 'bg-red-600/10 border-red-600/40' 
                                : 'hover:bg-white/5 border-transparent hover:border-white/10'
                            }`} 
                            onClick={() => handleEpisodePlay(ep)}
                          >
                            <div className="flex items-center gap-6 flex-shrink-0">
                              <span className="text-2xl font-black text-zinc-600 w-8">{ep.episode}</span>
                              <div className="relative w-40 h-24 rounded-xl overflow-hidden bg-gray-800 flex-shrink-0">
                                {ep.still_path || ep.local_still_path ? (
                                  <img 
                                    src={ep.local_still_path || getImageUrl(ep.still_path || null, 'w342')} 
                                    className="w-full h-full object-cover" 
                                    alt=""
                                    onError={(e) => { const t = e.target as HTMLImageElement; t.src = PLACEHOLDER_BACKDROP; }}
                                  />
                                ) : (
                                  <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
                                    <Tv size={24} className="text-gray-500" />
                                  </div>
                                )}
                                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                  <Play size={28} fill="white" className="text-white translate-x-0.5" />
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex-1 min-w-0 space-y-3">
                              <div className="flex items-center justify-between">
                                <h3 className="text-xl font-black text-white truncate pr-4">{ep.title}</h3>
                                <span className="text-sm text-zinc-400 font-bold flex-shrink-0">{ep.runtime ? formatRuntime(ep.runtime) : '--'}</span>
                              </div>
                              <p className="text-zinc-400 line-clamp-2 text-sm leading-relaxed">{ep.overview || "No description available."}</p>
                              
                              <div className="flex items-center justify-between pt-2">
                                <div className="flex items-center gap-4 text-xs text-zinc-500">
                                  {ep.air_date && <span>{new Date(ep.air_date).toLocaleDateString()}</span>}
                                  {ep.size && <span>{formatFileSize(ep.size)}</span>}
                                </div>
                                
                                {ep.progress !== undefined && ep.duration && (
                                  <div className="flex items-center gap-2">
                                    <div className="w-20 h-1 bg-gray-700 rounded-full overflow-hidden">
                                      <div 
                                        className="h-full bg-red-600 transition-all" 
                                        style={{ width: `${Math.min(100, (ep.progress / ep.duration) * 100)}%` }}
                                      />
                                    </div>
                                    <span className="text-[10px] text-zinc-500 font-bold">
                                      {Math.round((ep.progress / ep.duration) * 100)}%
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-12 text-center text-gray-400">No episodes found for this show.</div>
                    )}
                  </div>
                )}

              </div>
            )}

            {activeTab === 'more-like-this' && (
              <div>
                {franchiseRecommendations.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-2xl font-black text-white uppercase tracking-wider mb-4">Franchise</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-4">
                      {franchiseRecommendations.map((item) => (
                        <div
                          key={`franchise-${item.id}`}
                          onClick={() => handleItemClick(item)}
                          className="relative cursor-pointer overflow-hidden aspect-[2/3]"
                        >
                          <img src={getImageUrl(item.poster_path, 'w500')} className="w-full h-full object-cover" alt={item.displayTitle || item.title || item.name} onError={(e) => { const t = e.target as HTMLImageElement; t.src = PLACEHOLDER; }} />
                          <div className="absolute top-2 left-2 bg-black/60 text-[10px] px-2 py-1 rounded-full text-white font-black uppercase">{item.media_type === 'tv' ? 'Series' : 'Movie'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {combinedRecommendations.length > 0 ? (
                  <div className="space-y-6">
                    <h3 className="text-2xl font-black text-white uppercase tracking-wider">Recommended For You</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {combinedRecommendations.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => handleItemClick(item)}
                          className="relative cursor-pointer overflow-hidden aspect-[2/3]"
                        >
                          <img src={getImageUrl(item.poster_path, 'w500')} className="w-full h-full object-cover" alt={item.displayTitle || item.title || item.name} onError={(e) => { const t = e.target as HTMLImageElement; t.src = PLACEHOLDER; }} />
                          <div className="absolute top-2 left-2 bg-black/60 text-[10px] px-2 py-1 rounded-full text-white font-black uppercase">{item.media_type === 'tv' ? 'Series' : 'Movie'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <div className="text-6xl mb-4">🎬</div>
                    <p className="text-gray-500 font-medium text-lg mb-2">Building your personalized recommendations...</p>
                    <p className="text-gray-600 text-sm">Watch more content to get better suggestions!</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>



        {loading && !details && <div className="absolute inset-0 bg-[#111]/80 backdrop-blur-sm flex items-center justify-center z-[100]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div></div>}
      </div>
    </div>
  ), document.body);
};

export default DetailsModal;
