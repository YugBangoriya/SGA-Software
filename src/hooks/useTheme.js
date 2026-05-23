/**
 * useTheme.js
 * Reads the current theme from Phase 1's implementation.
 * Phase 1 is expected to toggle the 'dark' class on <html>.
 * This hook returns { isDark } and a toggle function.
 */

import { useState, useEffect } from 'react';

const useTheme = () => {
  const [isDark, setIsDark] = useState(
    () => document.documentElement.classList.contains('dark')
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, []);

  return { isDark };
};

export default useTheme;

// Alias export — some components import { useDarkMode } instead of default useTheme
export const useDarkMode = () => {
  const theme = useTheme();
  return theme;
};