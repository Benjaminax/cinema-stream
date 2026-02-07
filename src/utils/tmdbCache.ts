// Simple in-memory cache for TMDB API and images
class TMDBCache {
  private cache = new Map<string, any>();
  private imageCache = new Map<string, string>();

  get(key: string): any {
    return this.cache.get(key);
  }

  set(key: string, value: any): void {
    this.cache.set(key, value);
  }

  async getImage(path: string, size: string): Promise<string | null> {
    const key = `${path}_${size}`;
    return this.imageCache.get(key) || null;
  }

  async downloadAndCacheImage(url: string, path: string, size: string): Promise<void> {
    // Dummy implementation - in real app, download and save to file
    const key = `${path}_${size}`;
    this.imageCache.set(key, url);
  }
}

export const tmdbCache = new TMDBCache();