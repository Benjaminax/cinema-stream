import React, { useEffect, useState } from 'react';
import { BookmarkPlus, Sparkles } from 'lucide-react';
import { getMyList } from '../utils/myList';
import { TMDBResult } from '../types/media';
import MediaCard from '../components/media/MediaCard';
import DetailsModal from '../components/media/DetailsModal';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import NoInternetConnection from '../components/offline/NoInternetConnection';

const MyList: React.FC = () => {
    const [list, setList] = useState<TMDBResult[]>([]);
    const [selectedItem, setSelectedItem] = useState<TMDBResult | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { isOnline, retry } = useNetworkStatus();

    useEffect(() => {
        const load = () => setList(getMyList());
        load();
        window.addEventListener('my-list-updated', load);
        return () => window.removeEventListener('my-list-updated', load);
    }, []);

    const handlePlay = (item: TMDBResult) => {
        if (window.electronAPI?.openFile && item.local_path) {
            window.electronAPI.openFile(item.local_path);
        } else {
            console.log('Play item:', item.title || item.name);
            setSelectedItem(item);
            setIsModalOpen(true);
        }
    };

    // Show offline page if not connected
    if (!isOnline) {
        return <NoInternetConnection onRetry={retry} />;
    }

    return (
        <div className="min-h-screen bg-[#050505] text-white relative overflow-hidden">
            {/* Ambient Background Glows */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-red-900/15 rounded-full blur-[120px]" />
                <div className="absolute bottom-0 right-1/4 w-[600px] h-[400px] bg-purple-900/10 rounded-full blur-[100px]" />
            </div>

            <div className="relative z-10 p-6 md:p-10">
                {/* Header */}
                <div className="flex items-center justify-between mb-10 animate-in fade-in slide-in-from-top-4 duration-700">
                    <div className="flex items-center gap-5">
                        <div className="relative">
                            <div className="absolute inset-0 bg-red-600/30 rounded-2xl blur-xl"></div>
                            <div className="relative w-16 h-16 bg-gradient-to-br from-red-600 to-red-900 rounded-2xl flex items-center justify-center shadow-2xl shadow-red-900/40">
                                <BookmarkPlus className="h-8 w-8 text-white" />
                            </div>
                        </div>
                        <div>
                            <h1 className="text-5xl font-bold text-white tracking-tight bg-gradient-to-r from-white to-gray-300 bg-clip-text">
                                My List
                            </h1>
                            <p className="text-gray-400 mt-2 text-lg flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block"></span>
                                Your personal collection - {list.length} {list.length === 1 ? 'title' : 'titles'}
                            </p>
                        </div>
                    </div>
                </div>

                {list.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-32 animate-in fade-in zoom-in duration-500">
                        <div className="relative mb-8">
                            <div className="absolute inset-0 bg-red-600/20 rounded-full blur-3xl"></div>
                            <div className="relative w-32 h-32 bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/10">
                                <BookmarkPlus className="h-14 w-14 text-gray-600" />
                            </div>
                        </div>
                        <h3 className="text-3xl font-bold text-white mb-3">Your Collection Awaits</h3>
                        <p className="text-gray-400 text-lg text-center max-w-md leading-relaxed mb-6">
                            Start building your personal library by adding movies and shows you love
                        </p>
                        <div className="flex items-center gap-2 text-sm text-gray-500 bg-white/5 px-4 py-2 rounded-full border border-white/5">
                            <Sparkles className="h-4 w-4 text-red-500" />
                            <span>Click the bookmark icon on any title to add it here</span>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 animate-in fade-in slide-in-from-bottom-8 duration-700">
                        {list.map((item, index) => (
                            <div
                                key={item.id}
                                className="animate-in fade-in zoom-in duration-500"
                                style={{ animationDelay: `${index * 30}ms` }}
                            >
                                <MediaCard
                                    item={item}
                                    onClick={(item) => {
                                        setSelectedItem(item);
                                        setIsModalOpen(true);
                                    }}
                                    onPlay={handlePlay}
                                />
                            </div>
                        ))}
                    </div>
                )}

                <DetailsModal
                    item={selectedItem}
                    isOpen={isModalOpen}
                    onClose={() => {
                        setSelectedItem(null);
                        setIsModalOpen(false);
                    }}
                    onPlay={handlePlay}
                />
            </div>
        </div>
    );
};

export default MyList;
