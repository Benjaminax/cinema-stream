import { TMDBResult, Episode } from '../types/media';

export interface StreamInfo {
  url: string;
  title: string;
  fallbackSearchUrl: string;
}

/**
 * Returns direct streaming URL or fallback search for movies and TV episodes.
 * Uses the same logic as the THEORA Android client (VidSrc embeds with YFlix fallback).
 */
export function getStreamInfo(item: TMDBResult | Episode, parentMedia?: TMDBResult | null): StreamInfo {
  const isEpisode = 'season' in item && 'episode' in item;

  if (isEpisode) {
    const seriesId = (item as any).seriesId || (item as any).show_id || parentMedia?.id;
    const season = (item as any).season || 1;
    const episode = (item as any).episode || 1;
    const seriesTitle = (item as any).seriesTitle || parentMedia?.name || parentMedia?.title || (item as any).title || 'Series';
    const title = `${seriesTitle} - S${season} E${episode}`;
    const searchUrl = `https://yflix.to/browser?keyword=${seriesTitle.trim().replace(/\s+/g, '+')}`;

    // Direct embed streaming URL matching the mobile APK
    const directUrl = seriesId
      ? `https://vidsrc.to/embed/tv/${seriesId}/${season}/${episode}`
      : searchUrl;

    return {
      url: directUrl,
      title,
      fallbackSearchUrl: searchUrl
    };
  }

  const tmdbItem = item as TMDBResult;
  const isTV = tmdbItem.media_type === 'tv' || !!tmdbItem.first_air_date;
  const title = tmdbItem.title || tmdbItem.name || 'Unknown Title';
  const searchUrl = `https://yflix.to/browser?keyword=${title.trim().replace(/\s+/g, '+')}`;

  if (isTV) {
    // TV show without specific episode — default to S1 E1 direct stream
    return {
      url: `https://vidsrc.to/embed/tv/${tmdbItem.id}/1/1`,
      title: `${title} - S1 E1`,
      fallbackSearchUrl: searchUrl
    };
  }

  // Movie direct embed stream
  return {
    url: `https://vidsrc.to/embed/movie/${tmdbItem.id}`,
    title,
    fallbackSearchUrl: searchUrl
  };
}

/**
 * Launches the online streaming window in Electron (or browser if not in Electron)
 */
export function playOnlineStream(item: TMDBResult | Episode, parentMedia?: TMDBResult | null) {
  const { url, title } = getStreamInfo(item, parentMedia);
  console.log('🎬 Launching online stream:', title, url);

  if (window.electronAPI?.openStreamWindow) {
    window.electronAPI.openStreamWindow(url, title);
  } else if (window.electronAPI?.openYFlixWindow) {
    window.electronAPI.openYFlixWindow(url, title);
  } else if (window.electronAPI?.openExternal) {
    window.electronAPI.openExternal(url);
  } else {
    window.open(url, '_blank');
  }
}
