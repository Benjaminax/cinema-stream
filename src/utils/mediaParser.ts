export interface ParsedMediaInfo {
  title: string;
  year?: number;
  season?: number;
  episode?: number;
  type: 'movie' | 'series';
  rating?: string; // MPAA rating like PG-13, R, PG, G
  duration?: number; // Duration in minutes
  resolution?: string; // 1080p, 720p, 4K, etc.
  videoCodec?: string; // x264, x265, HEVC, etc.
  audioCodec?: string; // AAC, AC3, DTS, etc.
  source?: string; // BluRay, WEBRip, HDRip, etc.
  fileSize?: string; // Human readable file size
}

export function parseMediaFilename(filename: string): ParsedMediaInfo {
  // Remove file extension
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');

  // Metadata extraction (resolution, codec, etc.)
  const metadata = {
    rating: extractRating(nameWithoutExt),
    duration: extractDuration(nameWithoutExt),
    resolution: extractResolution(nameWithoutExt),
    videoCodec: extractVideoCodec(nameWithoutExt),
    audioCodec: extractAudioCodec(nameWithoutExt),
    source: extractSource(nameWithoutExt)
  };

  // --- SERIES PARSING STRATEGIES ---

  // 1. Standard SxxExx pattern (most reliable)
  // Supports: Title S01E01, Title.S01E01, Title_S01E01, etc.
  // We prioritize this to avoid false positives from year-like numbers in titles
  const hiddenSeriesRegex = /(.+?)[ ._-]+S(\d{1,2})[ ._-]*E(\d{1,2})/i;
  const standardMatch = nameWithoutExt.match(hiddenSeriesRegex);

  if (standardMatch) {
    const titleRaw = standardMatch[1];
    const season = parseInt(standardMatch[2]);
    const episode = parseInt(standardMatch[3]);

    return {
      title: cleanMediaTitle(titleRaw),
      season,
      episode,
      type: 'series',
      ...metadata
    };
  }

  // 2. Bracketed Series info [S01E01] or [1x01] anywhere
  const bracketedSeriesRegex = /\[S(\d{1,2})[-.]?E(\d{1,2})\]|\[(\d{1,2})x(\d{1,2})\]/i;
  const bracketedMatch = nameWithoutExt.match(bracketedSeriesRegex);

  if (bracketedMatch) {
    const season = parseInt(bracketedMatch[1] || bracketedMatch[3]);
    const episode = parseInt(bracketedMatch[2] || bracketedMatch[4]);

    // Remove the match from the name to find the title
    const titlePart = nameWithoutExt.replace(bracketedMatch[0], '');

    return {
      title: cleanMediaTitle(titlePart),
      season,
      episode,
      type: 'series',
      ...metadata
    };
  }

  // 3. Anime/Fansub style: [Group] Title - 01 [Resolution] OR Title - [001]
  const animeRegex = /^(?:\[.*?\][ _]?)?(.+?)[ _]-[ _]\[?(\d{2,4})\]?/i;
  const animeMatch = nameWithoutExt.match(animeRegex);

  if (animeMatch) {
    const possibleNum = parseInt(animeMatch[2]);
    if (possibleNum < 2000) {
      return {
        title: cleanMediaTitle(animeMatch[1]),
        season: 1,
        episode: possibleNum,
        type: 'series',
        ...metadata
      };
    }
  }

  // 4. "Season X Episode Y" or "Sea X Ep Y" pattern
  const verboseSeriesRegex = /(.+?)[ ._-]+(?:Season|Sea|S|Series|T|Book|Vol)[ ._-]?(\d{1,2})[ ._-]+(?:Episode|Ep|E|Chap|Part)[ ._-]?(\d{1,3})/i;
  const verboseMatch = nameWithoutExt.match(verboseSeriesRegex);

  if (verboseMatch) {
    return {
      title: cleanMediaTitle(verboseMatch[1]),
      season: parseInt(verboseMatch[2]),
      episode: parseInt(verboseMatch[3]),
      type: 'series',
      ...metadata
    };
  }

  // 5. Multi-part / Absolute Absolute Numbering Part 2
  // Supports Filename.01.1080p
  const numericSuffixRegex = /(.+?)[ ._-](\d{2,3})(?:[ ._-](?:1080p|720p|4k|x264|x265|bluray|webrip)|$)/i;
  const numericSuffixMatch = nameWithoutExt.match(numericSuffixRegex);

  if (numericSuffixMatch) {
    const epNum = parseInt(numericSuffixMatch[2]);
    if (epNum < 1000) {
      return {
        title: cleanMediaTitle(numericSuffixMatch[1]),
        season: 1,
        episode: epNum,
        type: 'series',
        ...metadata
      };
    }
  }

  // --- MOVIE PARSING STRATEGIES ---

  // 1. Standard Movie: Title (Year) or Title.Year
  // We explicitly look for a year at the end or followed by quality info
  // This prevents "2012 (2009)" from being parsed as title "2012" year 2009 correctly

  // Regex explains: 
  // ^(.+?) -> Lazy capture title
  // [ ._(]+ -> Separator (space, dot, underscore, or open paren)
  // (\d{4}) -> Year
  // [ ._)]* -> Optional separator/close paren after year
  // (?:...)? -> Optional quality/release info follows
  const movieYearRegex = /^(.+?)[ ._(]+(\d{4})[ ._)]*(?:[ ._]|$)(.*)/;
  const movieMatch = nameWithoutExt.match(movieYearRegex);

  if (movieMatch) {
    const rawTitle = movieMatch[1];
    const year = parseInt(movieMatch[2]);
    // We can check movieMatch[3] for quality info if needed in the future

    // Sanity check: valid year range
    if (year >= 1900 && year <= 2100) {
      return {
        title: cleanMediaTitle(rawTitle),
        year,
        type: 'movie',
        ...metadata
      };
    }
  }

  // 2. Fallback: No Series pattern, No Year pattern found.
  // Treat as simple movie title
  return {
    title: cleanMediaTitle(nameWithoutExt),
    type: 'movie',
    ...metadata
  };
}

export function cleanMediaTitle(title: string): string {
  if (!title) return '';

  // Replace dots, underscores, and multiple spaces with single spaces
  title = title.replace(/[._]/g, ' ').replace(/\s+/g, ' ').trim();

  // Remove quality indicators and release info
  const qualityTerms = [
    '2160p', '4k', 'uhd', '1080p', '1080i', 'fhd', '720p', '480p', '540p', 'sd',
    '8k', 'bluray', 'bdrip', 'brrip', 'web-dl', 'webrip', 'web', 'hdtv', 'dvdrip', 'dvd', 'cam', 'ts',
    'x264', 'x265', 'h264', 'h265', 'hevc', 'avc', 'vp9', 'av1', 'vc-1',
    'aac', 'ac3', 'dts-hd', 'dts-x', 'dts', 'truehd', 'atmos', 'flac', 'opus',
    'extended', 'unrated', 'remastered', 'directors cut', 'dual-audio', 'dual', 'multi',
    'nf', 'amzn', 'dsnp', 'hmax', 'hulu', 'atvp', 'cr', 'amazon', 'netflix', 'disney',
    'remux', 'proper', 'repack', 'internal', 'vostfr', 'sub', 'dub'
  ];

  const qualityRegex = new RegExp(`\\b(${qualityTerms.join('|')})\\b`, 'gi');
  title = title.replace(qualityRegex, '');

  // Remove content in square brackets [] and leading/trailing non-alphanumeric chars
  title = title.replace(/\[.*?\]/g, '')
    .trim()
    .replace(/[._]/g, ' ')
    .replace(/^[\s\-_.]+/, '')
    .replace(/[\s\-_.]+$/, '');

  // Collapse spaces and trim
  return title.replace(/\s+/g, ' ').trim();
}

// Reuse existing extract functions... (We need to keep these for the exports to work if used elsewhere)
// OR simpler: Implementation above calls them, so we need to define them below.

function extractRating(filename: string): string | undefined {
  const patterns = [/\b(R|PG-13|PG|G|NC-17|TV-MA|TV-14|TV-PG|TV-G|TV-Y7|TV-Y)\b/gi, /\b(Not\s*Rated|Unrated|NR)\b/gi];
  for (const p of patterns) { const m = filename.match(p); if (m) return m[0].toUpperCase(); }
  return undefined;
}

function extractDuration(filename: string): number | undefined {
  const hm = filename.match(/(\d{1,2})h\s*(\d{1,2})m?/i);
  if (hm) return parseInt(hm[1]) * 60 + parseInt(hm[2]);
  const m = filename.match(/(\d{1,3})\s*min/i) || filename.match(/(\d{1,3})\s*m\b/i);
  if (m) return parseInt(m[1]);
  return undefined;
}

function extractResolution(filename: string): string | undefined {
  const res = filename.match(/\b(2160p|4K|UHD|1080p|FHD|1080i|720p|HD|540p|480p|SD)\b/i) ||
    filename.match(/(\d{3,4})x(\d{3,4})/i);
  return res ? res[0].toUpperCase() : undefined;
}

function extractVideoCodec(filename: string): string | undefined {
  const c = filename.match(/\b(x265|HEVC|H\.265|x264|H\.264|AVC|VP9|AV1|VC-1|HVC1|MPEG-4)\b/i);
  return c ? c[0].toUpperCase() : undefined;
}

function extractAudioCodec(filename: string): string | undefined {
  const c = filename.match(/\b(DTS-HD|DTS-X|DTS|TRUEHD|ATMOS|DD\+|DD5\.1|AC3|AAC|FLAC|OPUS|MP3)\b/i);
  return c ? c[0].toUpperCase() : undefined;
}

function extractSource(filename: string): string | undefined {
  const s = filename.match(/\b(REMUX|BLURAY|BDRIP|BRRIP|WEB-DL|WEBRIP|WEB|HDTV|SATRIP|DVDRIP|DVD|CAM|TS)\b/i);
  return s ? s[0].toUpperCase() : undefined;
}

export function extractSeriesInfo(filename: string): { seriesName: string; seasonNum: number; episodeNum: number; year?: number } | null {
  const parsed = parseMediaFilename(filename);
  if (parsed.type === 'series' && parsed.season && parsed.episode) {
    return {
      seriesName: parsed.title,
      seasonNum: parsed.season,
      episodeNum: parsed.episode,
      year: parsed.year
    };
  }
  return null;
}

export function extractMovieTitle(filename: string): string {
  return parseMediaFilename(filename).title;
}
