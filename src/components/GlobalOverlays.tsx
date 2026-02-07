import React, { useEffect, useState } from 'react';
import DuplicateScanner from './DuplicateScanner';

const GlobalOverlays: React.FC = () => {
  const [showSortToast, setShowSortToast] = useState(false);
  const [showDuplicateScanner, setShowDuplicateScanner] = useState(false);

  useEffect(() => {
    const showToast = () => {
      setShowSortToast(true);
      setTimeout(() => setShowSortToast(false), 3000);
    };
    const openDuplicateScanner = () => setShowDuplicateScanner(true);
    const closeDuplicateScanner = () => setShowDuplicateScanner(false);

    window.addEventListener('cinestream-show-sort-toast', showToast);
    window.addEventListener('cinestream-open-duplicate-scanner', openDuplicateScanner);
    window.addEventListener('cinestream-close-duplicate-scanner', closeDuplicateScanner);

    return () => {
      window.removeEventListener('cinestream-show-sort-toast', showToast);
      window.removeEventListener('cinestream-open-duplicate-scanner', openDuplicateScanner);
      window.removeEventListener('cinestream-close-duplicate-scanner', closeDuplicateScanner);
    };
  }, []);

  return (
    <>
      {showSortToast && (
        <div className="fixed bottom-6 right-6 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg z-[150]">
          Files organized ✓
        </div>
      )}

      {showDuplicateScanner && (
        <div className="fixed inset-0 flex items-start justify-center z-[200] p-6">
          <div className="bg-black/90 rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] overflow-auto">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="font-bold">Duplicate Scanner</h3>
              <button
                className="text-white/80 hover:text-white"
                onClick={() => window.dispatchEvent(new CustomEvent('cinestream-close-duplicate-scanner'))}
              >
                Close
              </button>
            </div>
            <div className="p-4">
              <DuplicateScanner onClose={() => window.dispatchEvent(new CustomEvent('cinestream-close-duplicate-scanner'))} />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GlobalOverlays;
