export type RecentlyWatchedItem = {
  id: string | number;
  title: string;
  type: 'movie' | 'tv' | 'episode' | 'other';
  path: string; // local_path or file_path
  at: number; // timestamp
  season?: number; // optional for episodes
  episode?: number; // optional for episodes
  poster_path?: string; // optional local poster path
  backdrop_path?: string; // optional local backdrop path
  still_path?: string; // optional local episode still path
  progress?: number; // in seconds
  duration?: number; // in seconds
};

const STORAGE_KEY = 'recentlyWatched';
const MAX_ITEMS = 50;

/**
 * Normalizes a file path for consistent comparison.
 */
export const normalizePath = (p: string): string => {
  if (!p) return p;
  // Replace forward slashes with backward slashes for Windows-style consistency
  let normalized = p.replace(/\//g, '\\');
  // Remove trailing slashes
  normalized = normalized.replace(/\\$/, '');
  // Force lowercase drive letter for Windows
  if (/^[a-zA-Z]:/.test(normalized)) {
    normalized = normalized[0].toLowerCase() + normalized.slice(1);
  }
  return normalized;
};

export const getRecentlyWatched = (): RecentlyWatchedItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentlyWatchedItem[];
    // Ensure all paths in history are normalized
    if (Array.isArray(parsed)) {
      return parsed
        .map(item => ({ ...item, path: normalizePath(item.path) }))
        .sort((a, b) => b.at - a.at);
    }
    return [];
  } catch (err) {
    console.error('Error reading recently watched:', err);
    localStorage.removeItem(STORAGE_KEY);
    return [];
  }
};

export const addRecentlyWatched = (item: Omit<RecentlyWatchedItem, 'at'>) => {
  try {
    const normalizedPath = normalizePath(item.path);
    const current = getRecentlyWatched();
    const existing = current.find(i => i.path === normalizedPath);
    const filtered = current.filter(i => i.path !== normalizedPath);

    // Merge existing metadata if not provided in the new item
    const newItem: RecentlyWatchedItem = {
      ...existing, // Start with existing data (to preserve posters etc)
      ...item,     // Overwrite with new data
      path: normalizedPath,
      at: Date.now() // Always update the timestamp
    };

    // If existing had posters/backdrops but the new item doesn't, restore them
    if (existing?.poster_path && !item.poster_path) newItem.poster_path = existing.poster_path;
    if (existing?.backdrop_path && !item.backdrop_path) newItem.backdrop_path = existing.backdrop_path;
    if (existing?.still_path && !item.still_path) newItem.still_path = existing.still_path;

    const updated = [newItem, ...filtered].slice(0, MAX_ITEMS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    // notify listeners
    try {
      window.dispatchEvent(new CustomEvent('recently-watched-updated'));
    } catch (e) {
      // ignore
    }
  } catch (err) {
    console.error('Error adding recently watched:', err);
  }
};

export const clearRecentlyWatched = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    try {
      window.dispatchEvent(new CustomEvent('recently-watched-updated'));
    } catch (e) {
      // Ignore errors from event dispatch
    }
  } catch (err) {
    console.error('Error clearing recently watched:', err);
  }
};

export const removeRecentlyWatched = (pathOrId: string | number) => {
  try {
    const list = getRecentlyWatched();
    const normalizedTarget = typeof pathOrId === 'string' ? normalizePath(pathOrId) : pathOrId;
    const filtered = list.filter(i => i.path !== normalizedTarget && i.id !== pathOrId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    try { window.dispatchEvent(new CustomEvent('recently-watched-updated')); } catch (e) {
      // Ignore errors from event dispatch
    }
  } catch (err) {
    console.error('Error removing recently watched item:', err);
  }
};

export const updateRecentlyWatchedProgress = (path: string, progress: number, duration?: number) => {
  try {
    const normalizedPath = normalizePath(path);
    const list = getRecentlyWatched();
    const index = list.findIndex(i => i.path === normalizedPath);

    if (index !== -1) {
      // Create updated item with new progress and timestamp
      const item = { ...list[index] };
      item.progress = progress;
      if (duration) item.duration = duration;
      item.at = Date.now(); // Update timestamp to move to front

      // Remove from old position and insert at front
      const filtered = list.filter(i => i.path !== normalizedPath);
      const updated = [item, ...filtered];

      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      try { window.dispatchEvent(new CustomEvent('recently-watched-updated')); } catch (e) { }
    }
  } catch (err) {
    console.error('Error updating progress:', err);
  }
};

/**
 * Finds the most recently watched item within a parent path (directory).
 * Used to resume a series from the last watched episode.
 */
export const getResumeItemByParent = (parentPath: string): RecentlyWatchedItem | undefined => {
  const history = getRecentlyWatched();

  // Normalize parent path for matching
  const normalizedParent = normalizePath(parentPath);

  const matches = history
    .filter(item => {
      // Must be a child of the parent path
      const itemPath = normalizePath(item.path);
      const pPath = normalizedParent;
      return itemPath.startsWith(pPath + '\\') && itemPath !== pPath;
    })
    .sort((a, b) => b.at - a.at);

  return matches[0];
};
