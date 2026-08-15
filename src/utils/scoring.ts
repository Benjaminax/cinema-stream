import { TMDBResult } from '../types/media';

export interface ScoringWeights {
  genreOverlapWeight: number;
  popularityWeight: number;
  recencyWeight: number;
  seedAffinityWeight: number;
}

export interface ScoredCandidate {
  candidate: TMDBResult & { __sources?: string[] };
  score: number;
  breakdown: {
    genreOverlap: number;
    popularity: number;
    recency: number;
    seedAffinity: number;
  };
}

// Compute ratio of shared genre ids using Jaccard (shared / union)
export function genreOverlapRatio(seedGenres: number[] = [], candidateGenres: number[] = []): number {
  if (!seedGenres || seedGenres.length === 0 || !candidateGenres || candidateGenres.length === 0) return 0;
  const seedSet = new Set(seedGenres);
  const candSet = new Set(candidateGenres);
  const shared = candidateGenres.filter(g => seedSet.has(g)).length;
  const unionSize = new Set([...seedSet, ...candSet]).size;
  return unionSize > 0 ? shared / unionSize : 0;
}

// Genre pollutants (do not allow these unless the seed explicitly contains them)
const GENRE_EXCLUSIVE_IDS = new Set<number>([16]); // 16 = Animation (add other ids if needed)

export function isGenreDominated(seedGenres: number[] = [], candidateGenres: number[] = [], threshold = 0.25): boolean {
  const seedSet = new Set(seedGenres);
  // Reject candidate immediately if it contains an exclusive genre not present in the seed
  for (const g of candidateGenres || []) {
    if (GENRE_EXCLUSIVE_IDS.has(g) && !seedSet.has(g)) return false;
  }
  return genreOverlapRatio(seedGenres, candidateGenres) >= threshold;
}

// Era proximity: 1.0 when same year, linearly decrease to 0 at windowYears
export function eraProximityScore(seedYear?: number, candidateYear?: number, windowYears = 22): number {
  if (!seedYear || !candidateYear) return 0;
  const diff = Math.abs(seedYear - candidateYear);
  if (diff >= windowYears) return 0;
  return Math.max(0, 1 - (diff / windowYears));
}

export function normalizePopularity(popularity?: number): number {
  if (!popularity || popularity <= 0) return 0;
  // TMDB popularity is unbounded; use a soft normalization
  return Math.min(popularity / 100, 1);
}

export function scoreCandidate(seed: { genres?: number[]; year?: number; affinity?: number }, candidate: TMDBResult, weights?: Partial<ScoringWeights>): ScoredCandidate {
  const w: ScoringWeights = {
    genreOverlapWeight: 0.5,
    popularityWeight: 0.25,
    recencyWeight: 0.15,
    seedAffinityWeight: 0.1,
    ...(weights || {})
  };

  const genreOverlap = genreOverlapRatio(seed.genres || [], candidate.genre_ids || []);
  const popularity = normalizePopularity(candidate.popularity);
  const recency = eraProximityScore(seed.year, parseYear(candidate.release_date || candidate.first_air_date), 22);
  // TODO: wire a real user affinity signal (rating, watch recency). For now this is a placeholder.
  const seedAffinity = seed.affinity || 1; // default affinity

  const score = (genreOverlap * w.genreOverlapWeight * 100)
    + (popularity * w.popularityWeight * 100)
    + (recency * w.recencyWeight * 100)
    + (seedAffinity * w.seedAffinityWeight * 100);

  return {
    candidate: candidate as TMDBResult & { __sources?: string[] },
    score,
    breakdown: {
      genreOverlap,
      popularity,
      recency,
      seedAffinity
    }
  };
}

export function parseYear(dateStr?: string | null): number | undefined {
  if (!dateStr) return undefined;
  const y = parseInt((dateStr || '').slice(0, 4));
  return Number.isNaN(y) ? undefined : y;
}

// Aggregate scores: sum scores and merge sources
export function aggregateCandidateScores(scored: ScoredCandidate[]): Array<ScoredCandidate> {
  const map = new Map<number, ScoredCandidate>();
  for (const s of scored) {
    const id = s.candidate.id;
    const existing = map.get(id);
    if (!existing) {
      map.set(id, { ...s, candidate: { ...s.candidate, __sources: Array.from(new Set(s.candidate.__sources || [])) } });
    } else {
      existing.score += s.score;
      existing.breakdown.genreOverlap = Math.max(existing.breakdown.genreOverlap, s.breakdown.genreOverlap);
      existing.breakdown.popularity = Math.max(existing.breakdown.popularity, s.breakdown.popularity);
      existing.breakdown.recency = Math.max(existing.breakdown.recency, s.breakdown.recency);
      existing.breakdown.seedAffinity = Math.max(existing.breakdown.seedAffinity, s.breakdown.seedAffinity);
      existing.candidate.__sources = Array.from(new Set([...(existing.candidate.__sources || []), ...(s.candidate.__sources || [])]));
    }
  }
  return Array.from(map.values()).sort((a, b) => b.score - a.score);
}

export interface FilterOptions {
  requireSameType?: boolean;
  mediaType?: 'movie' | 'tv';
  requireGenreDominated?: boolean;
  genreThreshold?: number;
  eraWindowYears?: number;
  seedYear?: number;
  requireSameLanguage?: boolean;
  seedLanguage?: string;
}

export function filterCandidates(candidates: (TMDBResult & { __sources?: string[] })[], seed: { genres?: number[] }, options?: FilterOptions): (TMDBResult & { __sources?: string[] })[] {
  const opts = { requireSameType: true, mediaType: undefined, requireGenreDominated: true, genreThreshold: 0.25, eraWindowYears: 25, seedYear: undefined, requireSameLanguage: false, seedLanguage: undefined, ...options };
  return candidates.filter(c => {
    // If requireSameType is set and mediaType provided, reject when candidate's media_type is missing or different
    if (opts.requireSameType && opts.mediaType && c.media_type !== opts.mediaType) return false;
    if (opts.requireGenreDominated && seed.genres && seed.genres.length > 0) {
      if (!isGenreDominated(seed.genres, c.genre_ids || [], opts.genreThreshold)) return false;
    }
    if (opts.seedYear) {
      const candYear = parseYear(c.release_date || c.first_air_date);
      if (candYear && Math.abs(candYear - opts.seedYear) > opts.eraWindowYears) return false;
    }
    // Language gating: when requested, require candidate original_language match the seed language (if available)
    if (opts.requireSameLanguage && opts.seedLanguage) {
      const candLang = (c as any).original_language;
      if (candLang && candLang !== opts.seedLanguage) return false;
    }
    return true;
  });
}
