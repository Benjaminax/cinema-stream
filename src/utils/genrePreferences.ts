// Genre Preferences Storage
// Persists user's genre preferences based on their local media library
// Preferences are accumulated over time, so even if media is deleted, the app remembers what they like

export interface GenrePreference {
    id: number;
    name: string;
    count: number;       // How many times this genre appeared in their library
    lastSeen: number;    // Timestamp when this genre was last seen
}

const STORAGE_KEY = 'genrePreferences';

// Get all stored genre preferences
export function getGenrePreferences(): GenrePreference[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as GenrePreference[];
        return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
        console.error('Error reading genre preferences:', err);
        return [];
    }
}

// Get top genre preferences sorted by count
export function getTopGenrePreferences(limit: number = 5): GenrePreference[] {
    const prefs = getGenrePreferences();
    return prefs
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
}

// Get genre IDs for filtering
export function getPreferredGenreIds(limit: number = 5): number[] {
    return getTopGenrePreferences(limit).map(p => p.id);
}

// Get genre names for display
export function getPreferredGenreNames(limit: number = 5): string[] {
    return getTopGenrePreferences(limit).map(p => p.name);
}

// Update preferences with genres from current library
// This accumulates preferences rather than replacing them
export function updateGenrePreferences(genreIds: number[], genreMap: Record<number, string>): void {
    try {
        const current = getGenrePreferences();
        const now = Date.now();

        // Create a map for quick lookup
        const prefsMap = new Map<number, GenrePreference>();
        current.forEach(p => prefsMap.set(p.id, p));

        // Update with new genres
        genreIds.forEach(id => {
            const existing = prefsMap.get(id);
            if (existing) {
                // Increment count for existing genre
                existing.count += 1;
                existing.lastSeen = now;
            } else {
                // Add new genre
                const name = genreMap[id] || `Genre ${id}`;
                prefsMap.set(id, {
                    id,
                    name,
                    count: 1,
                    lastSeen: now
                });
            }
        });

        // Convert back to array and save
        const updated = Array.from(prefsMap.values());
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

        // Notify listeners
        try {
            window.dispatchEvent(new CustomEvent('genre-preferences-updated'));
        } catch (e) {
            // ignore
        }
    } catch (err) {
        console.error('Error updating genre preferences:', err);
    }
}

// Clear all genre preferences
export function clearGenrePreferences(): void {
    try {
        localStorage.removeItem(STORAGE_KEY);
        try {
            window.dispatchEvent(new CustomEvent('genre-preferences-updated'));
        } catch (e) {
            // Ignore errors from event dispatch
        }
    } catch (err) {
        console.error('Error clearing genre preferences:', err);
    }
}

// Check if preferences exist
export function hasGenrePreferences(): boolean {
    const prefs = getGenrePreferences();
    return prefs.length > 0;
}

// Genre name mapping (for movies and TV)
export const GENRE_NAME_MAP: Record<number, string> = {
    // Movie genres
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
    878: 'Science Fiction',
    10770: 'TV Movie',
    53: 'Thriller',
    10752: 'War',
    37: 'Western',
    // TV genres
    10759: 'Action & Adventure',
    10762: 'Kids',
    10763: 'News',
    10764: 'Reality',
    10765: 'Sci-Fi & Fantasy',
    10766: 'Soap',
    10767: 'Talk',
    10768: 'War & Politics'
};
