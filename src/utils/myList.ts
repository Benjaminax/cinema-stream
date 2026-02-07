import { TMDBResult } from '../types/media';

const STORAGE_KEY = 'my-cinema-list';

export const getMyList = (): TMDBResult[] => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? JSON.parse(saved) : [];
    } catch (error) {
        console.error('Error loading my list:', error);
        return [];
    }
};

export const addToMyList = (item: TMDBResult) => {
    try {
        const list = getMyList();
        if (!list.find(i => i.id === item.id)) {
            const updated = [item, ...list];
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            window.dispatchEvent(new CustomEvent('my-list-updated'));
        }
    } catch (error) {
        console.error('Error adding to my list:', error);
    }
};

export const removeFromMyList = (id: number) => {
    try {
        const list = getMyList();
        const updated = list.filter(item => item.id !== id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent('my-list-updated'));
    } catch (error) {
        console.error('Error removing from my list:', error);
    }
};

export const isInMyList = (id: number): boolean => {
    const list = getMyList();
    return list.some(item => item.id === id);
};
