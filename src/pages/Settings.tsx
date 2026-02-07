import React, { useState, useEffect } from 'react';
import {
  FolderOpen,
  Settings as SettingsIcon,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  FileVideo,
  Tv,
  Download,
  Trash2,
  Plus,
  RefreshCw,
  Zap,
  HardDrive
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

interface SortProgress {
  current: number;
  total: number;
  status: string;
}

interface SortResults {
  moved: number;
  skipped: number;
  errors: string[];
}

const Settings: React.FC = () => {
  const [downloadsFolders, setDownloadsFolders] = useState<string[]>(['']);
  const [moviesFolder, setMoviesFolder] = useState<string>('');
  const [seriesFolder, setSeriesFolder] = useState<string>('');
  const [mediaExtensions] = useState<string[]>(['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v']);
  const [isSorting, setIsSorting] = useState(false);
  const [sortProgress, setSortProgress] = useState<SortProgress | null>(null);
  const [sortResults, setSortResults] = useState<SortResults | null>(null);

  useEffect(() => {
    loadSettings();
    initializeDefaultPaths();

    const handleProgress = (_event: any, progress: SortProgress) => {
      setSortProgress(progress);
    };

    if (window.electronAPI) {
      window.electronAPI.on('sorting-progress', handleProgress);
    }

    return () => {
      if (window.electronAPI) {
        window.electronAPI.removeListener('sorting-progress', handleProgress);
      }
    };
  }, []);

  const loadSettings = () => {
    try {
      const savedSettings = localStorage.getItem('cinestream-settings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        if (settings.downloadsFolders) setDownloadsFolders(settings.downloadsFolders);
        if (settings.moviesFolder) setMoviesFolder(settings.moviesFolder);
        if (settings.seriesFolder) setSeriesFolder(settings.seriesFolder);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveSettings = () => {
    try {
      const settings = {
        downloadsFolders,
        moviesFolder,
        seriesFolder
      };
      localStorage.setItem('cinestream-settings', JSON.stringify(settings));
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  useEffect(() => {
    saveSettings();
  }, [downloadsFolders, moviesFolder, seriesFolder]);

  const initializeDefaultPaths = async () => {
    try {
      if (!window.electronAPI) return;

      const videosPath = await window.electronAPI.getVideosPath();
      const downloadsInfo = await window.electronAPI.getDownloadsPath();

      setMoviesFolder(prev => prev || `${videosPath}\\Movies`);
      setSeriesFolder(prev => prev || `${videosPath}\\Series`);

      setDownloadsFolders(prev => {
        if (prev.length > 0 && prev[0] !== '') return prev;
        const defaultFolders = [];
        if (downloadsInfo.downloads) defaultFolders.push(downloadsInfo.downloads);
        if (downloadsInfo.telegram) defaultFolders.push(downloadsInfo.telegram);
        return defaultFolders.length > 0 ? defaultFolders : [''];
      });
    } catch (error) {
      console.error('Error initializing paths:', error);
    }
  };

  const handleAddDownloadsFolder = () => {
    setDownloadsFolders([...downloadsFolders, '']);
  };

  const handleRemoveDownloadsFolder = (index: number) => {
    setDownloadsFolders(downloadsFolders.filter((_, i) => i !== index));
  };

  const handleDownloadsFolderChange = (index: number, value: string) => {
    const updated = [...downloadsFolders];
    updated[index] = value;
    setDownloadsFolders(updated);
  };

  const handleBrowseFolder = async (type: 'downloads' | 'movies' | 'series', index?: number) => {
    if (!window.electronAPI) return;

    try {
      const selectedFolder = await window.electronAPI.selectFolder();
      if (selectedFolder) {
        if (type === 'downloads' && index !== undefined) {
          const updated = [...downloadsFolders];
          updated[index] = selectedFolder;
          setDownloadsFolders(updated);
        } else if (type === 'movies') {
          setMoviesFolder(selectedFolder);
        } else if (type === 'series') {
          setSeriesFolder(selectedFolder);
        }
      }
    } catch (error) {
      console.error('Error selecting folder:', error);
    }
  };

  const handleSortFiles = async () => {
    if (!window.electronAPI) return;

    setIsSorting(true);
    setSortProgress(null);
    setSortResults(null);

    try {
      const options = {
        downloadsFolders: downloadsFolders.filter(f => f.trim() !== ''),
        moviesFolder: moviesFolder.trim(),
        seriesFolder: seriesFolder.trim(),
        mediaExtensions
      };

      const results = await window.electronAPI.sortFiles(options);

      const filteredErrors = (results?.errors || []).filter((msg: string) => {
        return !/ENOENT.*rename/i.test(msg);
      });

      setSortResults({
        ...results,
        errors: filteredErrors,
      });
    } catch (error) {
      console.error('Error sorting files:', error);
      setSortResults({ moved: 0, skipped: 0, errors: [error instanceof Error ? error.message : String(error)] });
    } finally {
      setIsSorting(false);
      setSortProgress(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-12 overflow-x-hidden relative">
      {/* Reduced ambient glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[400px] h-[400px] bg-red-900/8 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-blue-900/5 rounded-full blur-[100px]" />
      </div>

      <div className="relative max-w-4xl mx-auto px-6 py-8">
        {/* Compact Header */}
        <div className="mb-8 relative">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-br from-red-600 to-red-900 rounded-xl flex items-center justify-center shadow-lg shadow-red-900/30">
              <SettingsIcon className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white">Settings</h1>
          </div>
          <p className="text-gray-400 text-sm ml-13">Configure library locations and automation</p>
        </div>

        <div className="space-y-6">
          {/* Library Locations - Compact */}
          <section>
            <h2 className="text-base font-semibold mb-3 flex items-center gap-2 text-white">
              <div className="p-1.5 bg-white/5 rounded-lg">
                <HardDrive className="h-4 w-4 text-red-500" />
              </div>
              Library Locations
            </h2>

            <div className="bg-[#121212]/60 backdrop-blur-xl border border-white/5 rounded-2xl p-5 space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-300">Movies Library</label>
                  <div className="flex gap-2">
                    <Input
                      value={moviesFolder}
                      onChange={(e) => setMoviesFolder(e.target.value)}
                      placeholder="Select movies folder..."
                      icon={<FileVideo className="h-3.5 w-3.5" />}
                      readOnly
                      onClick={() => handleBrowseFolder('movies')}
                      className="bg-black/40 border-white/10 focus:border-red-500/50 rounded-lg text-sm py-2 cursor-pointer hover:bg-black/60 transition-colors"
                    />
                    <Button
                      variant="secondary"
                      onClick={(e) => { e.stopPropagation(); handleBrowseFolder('movies'); }}
                      className="bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg px-3 py-2 text-xs"
                    >
                      Browse
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-300">Series Library</label>
                  <div className="flex gap-2">
                    <Input
                      value={seriesFolder}
                      onChange={(e) => setSeriesFolder(e.target.value)}
                      placeholder="Select series folder..."
                      icon={<Tv className="h-3.5 w-3.5" />}
                      readOnly
                      onClick={() => handleBrowseFolder('series')}
                      className="bg-black/40 border-white/10 focus:border-red-500/50 rounded-lg text-sm py-2 cursor-pointer hover:bg-black/60 transition-colors"
                    />
                    <Button
                      variant="secondary"
                      onClick={(e) => { e.stopPropagation(); handleBrowseFolder('series'); }}
                      className="bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg px-3 py-2 text-xs"
                    >
                      Browse
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Source Folders - Compact */}
          <section>
            <h2 className="text-base font-semibold mb-3 flex items-center gap-2 text-white">
              <div className="p-1.5 bg-white/5 rounded-lg">
                <Download className="h-4 w-4 text-red-500" />
              </div>
              Source Folders
            </h2>

            <div className="bg-[#121212]/60 backdrop-blur-xl border border-white/5 rounded-2xl p-5 space-y-3">
              <div className="space-y-2">
                {downloadsFolders.map((folder, index) => (
                  <div key={index} className="flex gap-2 group/row">
                    <Input
                      value={folder}
                      onChange={(e) => handleDownloadsFolderChange(index, e.target.value)}
                      placeholder="e.g. Downloads folder path"
                      icon={<FolderOpen className="h-3.5 w-3.5" />}
                      className="flex-1 bg-black/40 border-white/10 focus:border-red-500/50 rounded-lg text-sm py-2"
                      rightElement={
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleBrowseFolder('downloads', index)}
                          className="bg-white/5 hover:bg-white/10 border border-white/5 rounded-md text-xs mr-1 py-1"
                        >
                          Browse
                        </Button>
                      }
                    />
                    {downloadsFolders.length > 1 && (
                      <Button
                        variant="danger"
                        onClick={() => handleRemoveDownloadsFolder(index)}
                        className="px-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 opacity-0 group-hover/row:opacity-100 transition-all"
                        aria-label="Remove folder"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <Button
                variant="secondary"
                onClick={handleAddDownloadsFolder}
                className="w-full border-dashed border border-white/10 bg-transparent hover:bg-white/5 text-gray-400 hover:text-white rounded-lg py-2.5 text-sm"
              >
                <div className="flex items-center gap-2">
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Another Source</span>
                </div>
              </Button>
            </div>
          </section>

          {/* Automation - Compact */}
          <section>
            <h2 className="text-base font-semibold mb-3 flex items-center gap-2 text-white">
              <div className="p-1.5 bg-white/5 rounded-lg">
                <Zap className="h-4 w-4 text-red-500" />
              </div>
              Automation
            </h2>

            <div className="bg-[#121212]/60 backdrop-blur-xl border border-white/5 rounded-2xl p-5">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-4">
                <div className="flex-1">
                  <h3 className="text-base font-bold text-white mb-1">Organize Library</h3>
                  <p className="text-gray-400 text-xs leading-relaxed">
                    Scans source folders and organizes media into your library
                  </p>
                </div>
                <Button
                  onClick={handleSortFiles}
                  isLoading={isSorting}
                  disabled={isSorting || !moviesFolder || !seriesFolder}
                  className="w-full md:w-auto bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white border-0 shadow-lg shadow-red-900/40 rounded-lg py-2.5 px-6 font-semibold text-sm"
                >
                  {isSorting ? 'Processing...' : 'Start Organization'}
                </Button>
              </div>

              {/* Progress */}
              {sortProgress && (
                <div className="mt-4 p-4 bg-black/40 rounded-xl border border-white/5">
                  <div className="flex justify-between text-xs mb-2 font-medium">
                    <span className="text-gray-300 flex items-center gap-1.5">
                      <RefreshCw className="h-3 w-3 animate-spin text-red-500" />
                      {sortProgress.status}
                    </span>
                    <span className="text-white font-mono">
                      {Math.round((sortProgress.current / sortProgress.total) * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-800/50 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-red-600 to-red-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${(sortProgress.current / sortProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Results */}
              {sortResults && (
                <div className={`mt-4 p-4 rounded-xl border ${sortResults.errors.length > 0
                  ? 'bg-red-500/5 border-red-500/20'
                  : 'bg-green-500/5 border-green-500/20'
                  }`}>
                  <div className="flex items-start gap-3">
                    {sortResults.errors.length > 0 ? (
                      <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <h4 className={`font-bold text-sm mb-2 ${sortResults.errors.length > 0 ? 'text-red-500' : 'text-green-500'}`}>
                        {sortResults.errors.length > 0 ? 'Completed with Issues' : 'Success'}
                      </h4>
                      <div className="flex gap-6 text-xs text-gray-300 mb-2">
                        <div className="flex flex-col">
                          <span className="text-gray-500 text-[10px] uppercase">Moved</span>
                          <span className="text-lg font-bold text-white">{sortResults.moved}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-gray-500 text-[10px] uppercase">Skipped</span>
                          <span className="text-lg font-bold text-white">{sortResults.skipped}</span>
                        </div>
                      </div>
                      {sortResults.errors.length > 0 && (
                        <div className="mt-3 bg-black/20 rounded-lg p-3">
                          <p className="text-[10px] font-semibold text-red-400 mb-1 uppercase">Errors</p>
                          <div className="text-xs text-red-300/80 space-y-0.5 font-mono">
                            {sortResults.errors.slice(0, 2).map((err, i) => (
                              <div key={i} className="truncate">• {err}</div>
                            ))}
                            {sortResults.errors.length > 2 && (
                              <div className="text-[10px] opacity-70">+{sortResults.errors.length - 2} more</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Maintenance - Compact */}
          <section>
            <h2 className="text-base font-semibold mb-3 flex items-center gap-2 text-white">
              <div className="p-1.5 bg-white/5 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </div>
              Maintenance
            </h2>

            <div className="bg-[#121212]/60 backdrop-blur-xl border border-white/5 rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-white mb-0.5">Duplicate Scanner</h3>
                <p className="text-gray-400 text-xs">Find and remove duplicate media files</p>
              </div>
              <Button
                variant="secondary"
                onClick={() => window.dispatchEvent(new CustomEvent('cinestream-open-duplicate-scanner'))}
                className="bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg px-5 py-2 text-sm"
              >
                Open Scanner
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Settings;
