import { useEffect, useCallback } from 'react';

const SCROLL_STORAGE_KEY = 'results_scroll_position';

export const useScrollPosition = (key: string = SCROLL_STORAGE_KEY) => {
  // Save current scroll position
  const saveScrollPosition = useCallback(() => {
    const scrollY = window.scrollY;
    sessionStorage.setItem(key, scrollY.toString());
  }, [key]);

  // Restore saved scroll position
  const restoreScrollPosition = useCallback(() => {
    const savedPosition = sessionStorage.getItem(key);
    if (savedPosition) {
      const position = parseInt(savedPosition, 10);
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        window.scrollTo(0, position);
      });
    }
  }, [key]);

  // Clear saved position
  const clearScrollPosition = useCallback(() => {
    sessionStorage.removeItem(key);
  }, [key]);

  return {
    saveScrollPosition,
    restoreScrollPosition,
    clearScrollPosition,
  };
};

export default useScrollPosition;
