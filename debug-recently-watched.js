// Debug script to check recently watched data in localStorage
const recentlyWatched = localStorage.getItem('recentlyWatched');
console.log('Recently Watched Raw Data:', recentlyWatched);

if (recentlyWatched) {
    const parsed = JSON.parse(recentlyWatched);
    console.log('Recently Watched Parsed:', parsed);

    // Check each item for poster_path
    parsed.forEach((item, index) => {
        console.log(`Item ${index}:`, {
            title: item.title,
            poster_path: item.poster_path,
            hasPoster: !!item.poster_path
        });
    });
}

// To clear old data without poster_path:
// localStorage.removeItem('recentlyWatched');
