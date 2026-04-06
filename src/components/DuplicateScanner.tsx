import React, { useState, useEffect, useRef } from 'react';
import { X, Trash2, AlertTriangle, CheckCircle, Loader } from 'lucide-react';
import '../types/electron';

interface DuplicateGroup {
  files: Array<{
    path: string;
    size: number;
    name: string;
    season?: number | null;
    episode?: number | null;
    isSeries?: boolean;
    modified?: number;
    hash?: string | null;
    verified?: boolean;
  }>;
  keepFile: string;
  confidence?: 'high' | 'medium' | 'low';
  reason?: string;
  verifying?: boolean;
}

interface DuplicateScannerProps {
  onClose: () => void;
}

const DuplicateScanner: React.FC<DuplicateScannerProps> = ({ onClose }) => {
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });
  const abortControllerRef = useRef<AbortController | null>(null);

  // Media file extensions to scan for
  const MEDIA_EXTENSIONS = [
    '.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', 
    '.webm', '.m4v', '.mpg', '.mpeg', '.ts', '.m2ts'
  ];

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const normalizeFileName = (name: string): string => {
    // Remove extension
    const baseName = name.replace(/\.[^/.]+$/, '').toLowerCase();
    
    // Remove common quality/resolution tags and special characters
    const tagsToRemove = [
      // Resolutions
      '720p', '1080p', '2160p', '4k', 'uhd', 'hd',
      // Codecs
      'x264', 'x265', 'h264', 'h265', 'hevc', 'avc',
      // Sources
      'bluray', 'brrip', 'webdl', 'web-dl', 'webrip', 'web-rip',
      'dvdrip', 'bdrip', 'hdtv', 'pdtv',
      // Audio
      'dts', 'ac3', 'aac', 'dd5.1', 'dts-hd',
      // Groups/releases
      'yify', 'rarbg', 'ettv', 'amzn', 'nf',
      // Misc
      'remux', 'repack', 'proper', 'extended', 'unrated', 'directors.cut',
      'dual.audio', 'multi', 'subs'
    ];
    
    let cleaned = baseName;
    
    // Remove year in parentheses (e.g., (2023), [2023])
    cleaned = cleaned.replace(/[([]\d{4}[)\]]/g, '');
    
    // Preserve bracketed season/episode like [S01-E16] by moving them to the main string
    const bracketSE = cleaned.match(/\[?s?\d{1,2}[-_.\s]*e\d{1,2}\]?/i);
    if (bracketSE) {
      // keep it (we'll standardize later)
      // remove the bracketed portion from cleaned so it isn't stripped by the generic bracket removal
      cleaned = cleaned.replace(bracketSE[0], ` ${bracketSE[0]} `);
    }

    // Remove brackets and their contents (we already preserved SxxExx where applicable)
    cleaned = cleaned.replace(/\[.*?\]/g, '');
    
    // Remove parentheses and their contents (but keep season/episode info)
    cleaned = cleaned.replace(/\([^sSeE0-9].*?\)/g, '');
    
    // Remove backup/copy indicators
    const backupIndicators = [
      'copy', 'backup', 'duplicate', 'bak', 'temp', 'tmp',
      'old', 'original', 'archive', 'archived', 'saved'
    ];
    
    // Remove backup indicators with surrounding text
    backupIndicators.forEach(indicator => {
      // Remove patterns like " - copy", " (copy)", " copy", etc.
      const patterns = [
        new RegExp(`\\s*-\\s*${indicator}\\b`, 'gi'),
        new RegExp(`\\s*\\(${indicator}\\)\\s*`, 'gi'),
        new RegExp(`\\s*${indicator}\\b`, 'gi')
      ];
      patterns.forEach(pattern => {
        cleaned = cleaned.replace(pattern, '');
      });
    });
    
    // Remove common separators and replace with spaces
    cleaned = cleaned.replace(/[._+\-]/g, ' ');
    
    // Remove quality tags
    tagsToRemove.forEach(tag => {
      const regex = new RegExp(`\\b${tag}\\b`, 'gi');
      cleaned = cleaned.replace(regex, '');
    });
    
    // Remove extra spaces and trim
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    // For series, find and standardize S01E01 pattern (accept hyphens, dots, underscores, spaces)
    const seasonEpisodeMatch = cleaned.match(/(s\d{1,2}[-_.\s]*e\d{1,2})/i);
    if (seasonEpisodeMatch) {
      const raw = seasonEpisodeMatch[1];
      const parts = raw.replace(/[-_.\s]/g, '').match(/s(\d{1,2})e(\d{1,2})/i);
      if (parts) {
        const s = parts[1].padStart(2, '0');
        const e = parts[2].padStart(2, '0');
        cleaned = cleaned.replace(/(.*?)(s\d{1,2}[-_.\s]*e\d{1,2})(.*)/i, `$1 s${s}e${e}`).trim();
      }
    }
    
    return cleaned;
  };

  // Levenshtein distance for fuzzy filename matching
  const levenshtein = (a: string, b: string) => {
    const alen = a.length, blen = b.length;
    if (alen === 0) return blen;
    if (blen === 0) return alen;
    const dp: number[][] = Array.from({ length: alen + 1 }, () => Array(blen + 1).fill(0));
    for (let i = 0; i <= alen; i++) dp[i][0] = i;
    for (let j = 0; j <= blen; j++) dp[0][j] = j;
    for (let i = 1; i <= alen; i++) {
      for (let j = 1; j <= blen; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      }
    }
    return dp[alen][blen];
  };

  const stringSimilarity = (a: string, b: string) => {
    if (!a || !b) return 0;
    const dist = levenshtein(a, b);
    return 1 - (dist / Math.max(a.length, b.length));
  };

  const parseEpisodeInfo = (fileName: string): { season: number | null, episode: number | null, isSeries: boolean } => {
    const baseName = fileName.replace(/\.[^/.]+$/, '').toLowerCase();

    // Robust patterns that handle S01E01, S01-E01, [S01-E01], 1x01, Season 1 Episode 1, [001], etc.
    const patterns: RegExp[] = [
      /s\s*0*(\d{1,2})\s*[-_.\s]*?e\s*0*(\d{1,2})/i,               // S01E01, S01-E01, S01.E01, [S01-E01]
      /season\s*0*(\d{1,2}).{0,6}?episode\s*0*(\d{1,2})/i,          // Season 1 Episode 1
      /(\d{1,2})x(\d{1,2})/,                                         // 1x01
      /\[0*(\d{1,3})\]/,                                            // [001] -> treat as episode number (season 1)
      /episode\s*0*(\d{1,3})/i                                       // Episode 1 (assume season 1)
    ];

    for (const pattern of patterns) {
      const match = baseName.match(pattern);
      if (match) {
        // Bracket-only or single-number episode patterns -> assume season 1
        if (pattern === patterns[3] || pattern === patterns[4]) {
          return { season: 1, episode: parseInt(match[1]), isSeries: true };
        }

        // Patterns with two capture groups: season & episode
        if (match.length >= 3 && match[1] !== undefined && match[2] !== undefined) {
          return { season: parseInt(match[1]), episode: parseInt(match[2]), isSeries: true };
        }
      }
    }

    return { season: null, episode: null, isSeries: false };
  };

  const isBackupFile = (fileName: string): boolean => {
    const baseName = fileName.replace(/\.[^/.]+$/, '').toLowerCase();
    
    // Check for common backup/copy indicators
    const backupIndicators = [
      'copy', 'backup', 'duplicate', 'bak', 'temp', 'tmp',
      'old', 'original', 'archive', 'archived', 'saved',
      '(copy)', '(backup)', '(duplicate)', '(bak)', '(temp)', '(tmp)',
      '(old)', '(original)', '(archive)', '(archived)', '(saved)',
      ' - copy', ' - backup', ' - duplicate', ' - bak', ' - temp', ' - tmp',
      ' - old', ' - original', ' - archive', ' - archived', ' - saved'
    ];
    
    return backupIndicators.some(indicator => baseName.includes(indicator));
  };

  const scanForDuplicates = async () => {
    if (isScanning) return;

    console.log('🔄 Starting duplicate scan...');
    setIsScanning(true);
    setScanProgress({ current: 0, total: 0 });
    setDuplicates([]);
    setScanComplete(false);
    
    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();

    try {
      // Get settings from localStorage
      const savedSettings = localStorage.getItem('cinestream-settings');
      if (!savedSettings) {
        alert('Please configure your folders in Settings first');
        onClose();
        return;
      }

      const settings = JSON.parse(savedSettings);
      const moviesFolder = settings.moviesFolder || '';
      const seriesFolder = settings.seriesFolder || '';

      if (!moviesFolder && !seriesFolder) {
        alert('Please configure your Movies and Series folders in Settings first');
        onClose();
        return;
      }

      const duplicateGroups: DuplicateGroup[] = [];
      const allFiles: Array<{
        path: string, 
        size: number, 
        name: string, 
        normalized: string,
        season: number | null,
        episode: number | null,
        isSeries: boolean
      }> = [];
      
      // Collect all files first
      const folders = [];
      if (moviesFolder) folders.push({ path: moviesFolder, type: 'movies' });
      if (seriesFolder) folders.push({ path: seriesFolder, type: 'series' });

      let totalFiles = 0;
      let processedFiles = 0;

      // First, count total files
      for (const folder of folders) {
        const count = await countFilesRecursive(folder.path, MEDIA_EXTENSIONS);
        totalFiles += count;
      }
      
      setScanProgress({ current: 0, total: totalFiles });

      // Then collect all files with a global set to avoid duplicates
      const filePathsSeen = new Set<string>();
      
      for (const folder of folders) {
        await collectFilesRecursive(folder.path, MEDIA_EXTENSIONS, allFiles, {
          onProgress: () => {
            processedFiles++;
            setScanProgress({ current: processedFiles, total: totalFiles });
          },
          filePathsSeen
        });
      }

      // Group by normalized name & size first, then perform a fuzzy-merge pass to catch near-matches
      const groupedByNameAndSize = new Map<string, typeof allFiles>();
      
      for (const file of allFiles) {
        if (abortControllerRef.current.signal.aborted) break;
        
        // Create a key that includes episode information for series
        const sizeInMB = Math.round(file.size / (1024 * 1024));
        let key: string;
        
        if (file.isSeries && file.season !== null && file.episode !== null) {
          // For series: include season and episode in the key
          key = `${file.normalized}::S${file.season.toString().padStart(2, '0')}E${file.episode.toString().padStart(2, '0')}::${sizeInMB}`;
        } else {
          // For movies or files without episode info: use original logic
          key = `${file.normalized}::${sizeInMB}`;
        }
        
        if (!groupedByNameAndSize.has(key)) {
          groupedByNameAndSize.set(key, []);
        }
        
        // Check if this exact file path is already in the group
        const existingFile = groupedByNameAndSize.get(key)!.find(f => f.path === file.path);
        if (!existingFile) {
          groupedByNameAndSize.get(key)!.push(file);
        }
      }

      // Fuzzy merge similar groups (catch slight filename variations, container differences, etc.)
      const groupsArr = Array.from(groupedByNameAndSize.entries()).map(([key, files]) => ({ key, files, merged: false }));

      for (let i = 0; i < groupsArr.length; i++) {
        if (groupsArr[i].merged) continue;
        for (let j = i + 1; j < groupsArr.length; j++) {
          if (groupsArr[j].merged) continue;
          const a = groupsArr[i];
          const b = groupsArr[j];

          const aNorm = a.files[0].normalized;
          const bNorm = b.files[0].normalized;
          const nameSim = stringSimilarity(aNorm, bNorm);

          const aIsSeries = !!(a.files[0].isSeries && a.files[0].season !== null && a.files[0].episode !== null);
          const bIsSeries = !!(b.files[0].isSeries && b.files[0].season !== null && b.files[0].episode !== null);

          let shouldMerge = false;

          if (aIsSeries || bIsSeries) {
            // Merge only if both look like the same episode (season/episode match)
            const aSE = `${a.files[0].season || ''}x${a.files[0].episode || ''}`;
            const bSE = `${b.files[0].season || ''}x${b.files[0].episode || ''}`;
            if (aSE === bSE && nameSim >= 0.6) shouldMerge = true;
          } else {
            // Movie heuristics: high name similarity OR inclusion + small size diff
            const sizeA = a.files[0].size || 0;
            const sizeB = b.files[0].size || 0;
            const sizePct = Math.abs(sizeA - sizeB) / Math.max(1, Math.max(sizeA, sizeB));

            if (nameSim >= 0.86 && sizePct <= 0.06) shouldMerge = true; // very likely same
            if (aNorm.includes(bNorm) || bNorm.includes(aNorm)) {
              if (sizePct <= 0.15) shouldMerge = true; // allow larger container differences
            }
          }

          if (shouldMerge) {
            a.files.push(...b.files);
            groupsArr[j].merged = true;
          }
        }
      }

      // Rebuild grouped map from merged groups
      const mergedGroups: Array<typeof allFiles> = groupsArr.filter(g => !g.merged).map(g => g.files);

      console.log(`📊 Total unique file groups after fuzzy merge: ${mergedGroups.length}`);

      // Identify duplicates within each merged group
      for (const files of mergedGroups) {
        if (abortControllerRef.current.signal.aborted) break;
        
        if (files.length > 1) {
          // Separate backup files from original files
          const originalFiles = files.filter(file => !isBackupFile(file.name));
          const backupFiles = files.filter(file => isBackupFile(file.name));
          
          // Only consider original files as potential duplicates (include backup if needed)
          const filesToCheck = originalFiles.length > 1 ? originalFiles : 
                              (originalFiles.length === 1 && backupFiles.length > 0 ? [originalFiles[0], ...backupFiles] : files);
          
          if (filesToCheck.length > 1) {
            console.log(`✅ Found duplicate group candidate: ${files[0].normalized} (${filesToCheck.length} files)`);
            
            // Get file stats for more accurate comparison
            const filesWithStats = await Promise.all(
              filesToCheck.map(async (file) => {
                try {
                  const fileStats = await window.electronAPI!.getFileStats(file.path);
                  return {
                    ...file,
                    modified: fileStats?.mtimeMs || 0,
                    created: fileStats?.birthtimeMs || 0,
                    hash: null,
                    verified: false
                  };
                } catch {
                  return { ...file, modified: 0, created: 0, hash: null, verified: false };
                }
              })
            );

            // Sort by file size (largest first), then by modification date (newest first)
            filesWithStats.sort((a, b) => {
              if (b.size !== a.size) return b.size - a.size;
              return (b.modified || 0) - (a.modified || 0);
            });

            // Keep the best quality file (largest size, newest)
            const keepFile = filesWithStats[0].path;

            // Compute name similarity score to gauge confidence
            const nameSims = filesWithStats.map(f => stringSimilarity(f.normalized, filesWithStats[0].normalized));
            const avgNameSim = nameSims.reduce((s, n) => s + n, 0) / nameSims.length;
            const sizeStdDev = Math.sqrt(filesWithStats.reduce((acc, f) => acc + Math.pow(f.size - filesWithStats.reduce((s, x) => s + x.size, 0) / filesWithStats.length, 2), 0) / filesWithStats.length);

            let confidence: DuplicateGroup['confidence'] = 'low';
            if (avgNameSim >= 0.95 && sizeStdDev / (filesWithStats[0].size || 1) < 0.03) confidence = 'high';
            else if (avgNameSim >= 0.85) confidence = 'medium';

            duplicateGroups.push({
              files: filesWithStats,
              keepFile,
              confidence,
              reason: confidence === 'high' ? 'Names and sizes match closely' : (confidence === 'medium' ? 'Fuzzy name match; verify recommended' : 'Low confidence — verify before removing')
            });
          }
        }
      }

      console.log(`🎯 Found ${duplicateGroups.length} duplicate groups`);

      // Sort duplicates by total size (largest potential savings first)
      duplicateGroups.sort((a, b) => {
        const sizeA = a.files.reduce((sum, file, idx) => 
          idx === 0 ? sum : sum + file.size, 0);
        const sizeB = b.files.reduce((sum, file, idx) => 
          idx === 0 ? sum : sum + file.size, 0);
        return sizeB - sizeA;
      });

      setDuplicates(duplicateGroups);
      setScanComplete(true);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Scan cancelled by user');
      } else {
        console.error('Error scanning for duplicates:', error);
        alert('Error scanning for duplicates: ' + (error instanceof Error ? error.message : String(error)));
      }
    } finally {
      setIsScanning(false);
      abortControllerRef.current = null;
    }
  };

  const countFilesRecursive = async (folderPath: string, extensions: string[]): Promise<number> => {
    let count = 0;
    
    const countRecursive = async (currentPath: string) => {
      try {
        const items = await window.electronAPI!.scanDirectory(currentPath);
        for (const item of items) {
          if (abortControllerRef.current?.signal.aborted) return;
          
          if (item.type === 'file') {
            const ext = item.name.toLowerCase().substring(item.name.lastIndexOf('.'));
            if (extensions.includes(ext)) {
              count++;
            }
          } else if (item.type === 'directory') {
            await countRecursive(item.path);
          }
        }
      } catch (error) {
        console.warn(`Could not scan directory ${currentPath}:`, error);
      }
    };
    
    await countRecursive(folderPath);
    return count;
  };

  const collectFilesRecursive = async (
    folderPath: string, 
    extensions: string[], 
    allFiles: Array<{
      path: string, 
      size: number, 
      name: string, 
      normalized: string,
      season: number | null,
      episode: number | null,
      isSeries: boolean
    }>,
    options?: { 
      onProgress?: () => void;
      filePathsSeen?: Set<string>;
    }
  ) => {
    const collect = async (currentPath: string) => {
      try {
        const items = await window.electronAPI!.scanDirectory(currentPath);
        for (const item of items) {
          if (abortControllerRef.current?.signal.aborted) return;
          
          if (item.type === 'file') {
            const ext = item.name.toLowerCase().substring(item.name.lastIndexOf('.'));
            if (extensions.includes(ext)) {
              // Check if we've already seen this exact file path
              const normalizedPath = item.path.replace(/\\/g, '/').toLowerCase();
              if (options?.filePathsSeen?.has(normalizedPath)) {
                console.log(`⚠️ Skipping already seen file: ${item.path}`);
                continue;
              }
              
              options?.filePathsSeen?.add(normalizedPath);
              
              const episodeInfo = parseEpisodeInfo(item.name);
              
              allFiles.push({
                path: item.path,
                size: item.size || 0,
                name: item.name,
                normalized: normalizeFileName(item.name),
                season: episodeInfo.season,
                episode: episodeInfo.episode,
                isSeries: episodeInfo.isSeries
              });
              options?.onProgress?.();
            }
          } else if (item.type === 'directory') {
            await collect(item.path);
          }
        }
      } catch (error) {
        console.warn(`Could not scan directory ${currentPath}:`, error);
      }
    };
    
    await collect(folderPath);
  };

  const removeAllDuplicates = async () => {
    if (duplicates.length === 0) return;

    const total = getTotalDuplicates();
    if (!confirm(`Move ${total} duplicate file(s) to recycle bin? You can restore them from the recycle bin if needed.`)) {
      return;
    }

    setIsRemoving(true);
    let movedCount = 0;
    let failedCount = 0;

    try {
      for (const group of duplicates) {
        for (const file of group.files) {
          if (file.path !== group.keepFile) {
            try {
              const res = await window.electronAPI!.moveToTrash(file.path);
              if (res && res.success) {
                movedCount++;
                if (res.warning) {
                  console.warn('File moved with warning:', file.path, res.warning);
                }
              } else {
                failedCount++;
                console.error('Failed to move to trash:', file.path, res?.error);
              }
            } catch (error) {
              failedCount++;
              console.error('Error moving file to trash:', file.path, error);
            }
          }
        }
      }

      if (failedCount > 0) {
        alert(`Moved ${movedCount} files to recycle bin. Failed to move ${failedCount} files.`);
      } else {
        alert(`Successfully moved ${movedCount} duplicate files to recycle bin.`);
      }
      
      // Clear the duplicates list since all duplicates have been removed
      setDuplicates([]);
    } catch (error) {
      console.error('Error removing duplicates:', error);
      alert('Error removing duplicates: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsRemoving(false);
    }
  };

  const cancelScan = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsScanning(false);
    }
  };

  const getTotalDuplicates = () => {
    return duplicates.reduce((total, group) => total + (group.files.length - 1), 0);
  };

  const getTotalSizeSaved = () => {
    return duplicates.reduce((total, group) => {
      const duplicateSize = group.files
        .filter(file => file.path !== group.keepFile)
        .reduce((sum, file) => sum + file.size, 0);
      return total + duplicateSize;
    }, 0);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatProgressPercentage = () => {
    if (scanProgress.total === 0) return '0%';
    const percentage = Math.round((scanProgress.current / scanProgress.total) * 100);
    return `${percentage}%`;
  };

  // Quick test function to check what's happening
  const debugFiles = () => {
    console.log("=== DEBUGGING DUPLICATES ===");
    duplicates.forEach((group, groupIndex) => {
      console.log(`Group ${groupIndex + 1}: ${normalizeFileName(group.files[0].name)}`);
      group.files.forEach((file, fileIndex) => {
        console.log(`  File ${fileIndex + 1}: ${file.name} - ${formatFileSize(file.size)} - ${file.path}`);
      });
    });
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
      <div className="bg-gray-900 rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden border border-gray-700 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700 bg-gray-800/50">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center shadow-lg">
              <AlertTriangle className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Duplicate File Scanner</h1>
              <p className="text-gray-400 text-sm mt-1">Find and clean up duplicate media files</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-400 hover:text-white" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto scrollbar-custom">
          <div className="p-6">
            {!scanComplete && !isScanning ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-20 h-20 bg-blue-600/20 rounded-full flex items-center justify-center mb-6">
                  <AlertTriangle className="h-10 w-10 text-blue-500" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-3">Ready to Scan</h2>
                <p className="text-gray-400 text-center max-w-md text-lg mb-8">
                  Click the button below to scan your Movies and Series folders for duplicate files.
                </p>
                <button
                  onClick={scanForDuplicates}
                  className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors flex items-center gap-3"
                >
                  <AlertTriangle className="h-5 w-5" />
                  Start Duplicate Scan
                </button>
              </div>
            ) : isScanning ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-16 h-16 bg-red-600/20 rounded-full flex items-center justify-center mb-6">
                  <Loader className="h-8 w-8 animate-spin text-red-500" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Scanning Your Library</h3>
                <p className="text-gray-400 text-center max-w-md">
                  Scanning files... {scanProgress.current} of {scanProgress.total} files processed
                </p>
                <div className="mt-6 w-full max-w-xs">
                  <div className="flex justify-between text-sm text-gray-400 mb-2">
                    <span>Progress</span>
                    <span>{formatProgressPercentage()}</span>
                  </div>
                  <div className="bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-red-600 h-2 rounded-full transition-all duration-300"
                      style={{ 
                        width: scanProgress.total > 0 
                          ? `${(scanProgress.current / scanProgress.total) * 100}%` 
                          : '0%' 
                      }}
                    ></div>
                  </div>
                </div>
                <button
                  onClick={cancelScan}
                  className="mt-6 px-6 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
                >
                  Cancel Scan
                </button>
              </div>
            ) : scanComplete && duplicates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-20 h-20 bg-green-600/20 rounded-full flex items-center justify-center mb-6">
                  <CheckCircle className="h-10 w-10 text-green-500" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-3">All Clean!</h2>
                <p className="text-gray-400 text-center max-w-md text-lg mb-8">
                  No duplicate files were found in your media library. Your collection is already optimized!
                </p>
                <button
                  onClick={scanForDuplicates}
                  className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors flex items-center gap-3"
                >
                  <AlertTriangle className="h-5 w-5" />
                  Scan Again
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Summary Stats */}
                <div className="bg-gradient-to-r from-gray-800 to-gray-700 rounded-xl p-6 border border-gray-600">
                  <h3 className="text-lg font-semibold text-white mb-4">Scan Results</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-red-400 mb-1">{duplicates.length}</div>
                      <div className="text-sm text-gray-400 uppercase tracking-wide">Duplicate Groups</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-orange-400 mb-1">{getTotalDuplicates()}</div>
                      <div className="text-sm text-gray-400 uppercase tracking-wide">Files to Remove</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-green-400 mb-1">{formatFileSize(getTotalSizeSaved())}</div>
                      <div className="text-sm text-gray-400 uppercase tracking-wide">Space to Save</div>
                    </div>
                  </div>
                </div>

                {/* Debug button */}
                <div className="flex justify-end">
                  <button
                    onClick={debugFiles}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg"
                  >
                    Debug Console
                  </button>
                </div>
                
                {/* Duplicate Groups */}
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-white">Duplicate Files Found</h3>
                  <div className="space-y-4 pr-2">
                      {duplicates.map((group, groupIndex) => (
                        <div key={groupIndex} className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                          <div className="p-4 border-b border-gray-700 bg-gray-800/50">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                              <h4 className="text-white font-semibold">Group {groupIndex + 1}: {normalizeFileName(group.files[0].name) || 'Unnamed'}</h4>

                              {/* Confidence badge */}
                              {group.confidence === 'high' && <div className="text-xs bg-emerald-600 text-white px-2 py-1 rounded-full">Confirmed</div>}
                              {group.confidence === 'medium' && <div className="text-xs bg-yellow-600 text-white px-2 py-1 rounded-full">Potential</div>}
                              {(!group.confidence || group.confidence === 'low') && <div className="text-xs bg-gray-600 text-white px-2 py-1 rounded-full">Unverified</div>}

                              {/* Verify (hash) button */}
                              <div className="ml-auto flex items-center gap-2">
                                <button
                                  onClick={async () => {
                                    if (!window.electronAPI?.computeFileHash) {
                                      alert('Hash verification not available in this build.');
                                      return;
                                    }
                                    // mark verifying
                                    setDuplicates(prev => prev.map((g, idx) => idx === groupIndex ? { ...g, verifying: true } : g));
                                    try {
                                      const hashes = await Promise.all(group.files.map(async (file) => {
                                        try {
                                          const res = await window.electronAPI!.computeFileHash(file.path, { mode: 'quick' });
                                          return res.hash || null;
                                        } catch (err) {
                                          return null;
                                        }
                                      }));

                                      setDuplicates(prev => prev.map((g, idx) => {
                                        if (idx !== groupIndex) return g;
                                        const updatedFiles = g.files.map((f, i) => ({ ...f, hash: hashes[i] }));
                                        const uniqueHashes = Array.from(new Set(hashes.filter(Boolean)));
                                        let newConfidence: DuplicateGroup['confidence'] = g.confidence || 'low';
                                        if (uniqueHashes.length === 1 && uniqueHashes[0]) newConfidence = 'high';
                                        else if (uniqueHashes.length <= 2) newConfidence = 'medium';
                                        else newConfidence = 'low';
                                        return { ...g, files: updatedFiles, confidence: newConfidence, verifying: false };
                                      }));
                                    } finally {
                                      setDuplicates(prev => prev.map((g, idx) => idx === groupIndex ? { ...g, verifying: false } : g));
                                    }
                                  }}
                                  className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg"
                                  disabled={group.verifying}
                                >
                                  {group.verifying ? 'Verifying…' : 'Verify (hash)'}
                                </button>
                              </div>
                            </div>

                            <div className="text-sm text-gray-400">
                              {group.files.length} files • {formatFileSize(group.files[0].size)} each
                            </div>
                            </div>
                          </div>

                          <div className="divide-y divide-gray-700">
                            {group.files.map((file, fileIndex) => (
                              <div
                                key={fileIndex}
                                className={`p-4 ${
                                  file.path === group.keepFile
                                    ? 'bg-green-900/20 border-l-4 border-green-500'
                                    : 'bg-gray-800/50 hover:bg-gray-700/50'
                                }`}
                              >
                                <div className="flex items-center gap-4">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                    file.path === group.keepFile
                                      ? 'bg-green-600'
                                      : 'bg-red-600'
                                  }`}>
                                    {file.path === group.keepFile ? (
                                      <CheckCircle className="h-4 w-4 text-white" />
                                    ) : (
                                      <Trash2 className="h-4 w-4 text-white" />
                                    )}
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    <div className="text-white font-medium truncate">
                                      {file.name}
                                    </div>
                                    <div className="text-gray-400 text-sm truncate">
                                      {file.path}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-4">
                                    <div className="text-gray-400 text-sm font-mono">
                                      {formatFileSize(file.size)}
                                    </div>

                                    {file.path === group.keepFile ? (
                                      <div className="px-3 py-1 bg-green-600/20 text-green-400 rounded-full text-sm font-medium">
                                        Keep (Best Quality)
                                      </div>
                                    ) : (
                                      <button
                                        onClick={async () => {
                                          if (!confirm(`Move "${file.name}" to recycle bin?`)) return;
                                          setIsRemoving(true);
                                          try {
                                            const res = await window.electronAPI!.moveToTrash(file.path);
                                            if (res && res.success) {
                                              if (res.warning) {
                                                alert(`File moved successfully, but: ${res.warning}`);
                                              }
                                              
                                              // Update duplicates list by removing the moved file
                                              setDuplicates(prevDuplicates => {
                                                return prevDuplicates
                                                  .map(group => {
                                                    // Remove the file from this group
                                                    const updatedFiles = group.files.filter(f => f.path !== file.path);
                                                    
                                                    // If only one file left, remove the entire group
                                                    if (updatedFiles.length <= 1) {
                                                      return null;
                                                    }
                                                    
                                                    // If the keepFile was removed, choose a new one (largest size, newest)
                                                    let newKeepFile = group.keepFile;
                                                    if (group.keepFile === file.path) {
                                                      const sortedFiles = [...updatedFiles].sort((a, b) => {
                                                        if (b.size !== a.size) return b.size - a.size;
                                                        return (b.modified || 0) - (a.modified || 0);
                                                      });
                                                      newKeepFile = sortedFiles[0].path;
                                                    }
                                                    
                                                    return {
                                                      ...group,
                                                      files: updatedFiles,
                                                      keepFile: newKeepFile
                                                    };
                                                  })
                                                  .filter(group => group !== null) as typeof prevDuplicates;
                                              });
                                              
                                            } else {
                                              alert(`Failed to move file to Trash: ${res?.error || 'Unknown error'}`);
                                            }
                                          } catch (e) {
                                            console.error('Move to Trash failed', e);
                                            alert('Failed to move file');
                                          } finally {
                                            setIsRemoving(false);
                                          }
                                        }}
                                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
                                        disabled={isRemoving}
                                      >
                                        Move to Trash
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        {scanComplete && duplicates.length > 0 && (
          <div className="border-t border-gray-700 p-6 bg-gray-800/50">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-400 max-w-lg">
                <strong>Note:</strong> The best quality file (largest size, newest modification) in each group will be kept automatically.
              </div>
              <div className="flex gap-3">
                <button
                  onClick={scanForDuplicates}
                  disabled={isRemoving}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium flex items-center gap-2"
                >
                  <AlertTriangle className="h-4 w-4" />
                  Rescan
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors font-medium"
                >
                  Close
                </button>
                <button
                  onClick={removeAllDuplicates}
                  disabled={isRemoving}
                  className="px-6 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium flex items-center gap-2"
                >
                  {isRemoving ? (
                    <>
                      <Loader className="h-4 w-4 animate-spin" />
                      Removing...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      Move All to Recycle Bin
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DuplicateScanner;