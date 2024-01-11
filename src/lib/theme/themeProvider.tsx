import { useEffect, useState, createContext, useCallback } from 'react';

export type ThemeMode = 'light' | 'dark';
export type SavedThemeMode = ThemeMode | null;

const storageName = 'themeMode';
const attributeName = 'data-theme-mode';
// name of css property indicating mode
const themeProperty = '--default-theme';

interface ThemeContextType {
  setThemeMode: (theme: SavedThemeMode) => void;
  toggleThemeMode: () => void;
  themeMode: ThemeMode;
}

export const ThemeContext = createContext<ThemeContextType>({
  toggleThemeMode: () => void 0,
  setThemeMode: () => void 0,
  themeMode: getTheme(),
});

const storedMode = getSavedTheme();
if (storedMode) {
  document.documentElement.setAttribute(attributeName, storedMode);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [defaultTheme, setDefaultTheme] = useState(getDefaultBrowserTheme);
  const [savedTheme, setSavedTheme] = useState(getSavedTheme);
  const themeMode = savedTheme ?? defaultTheme;

  const toggleThemeMode = useCallback(
    function () {
      setSavedTheme(themeMode === 'dark' ? 'light' : 'dark');
    },
    [themeMode]
  );

  // local storage change (if the theme was changed from another tab)
  useEffect(() => {
    window.addEventListener('storage', onStorageChange, false);
    return () => window.removeEventListener('storage', onStorageChange, false);

    function onStorageChange() {
      setSavedTheme(getSavedTheme());
    }
  }, []);

  // preference change (if the browser settings were changed)
  useEffect(() => {
    const mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (mediaQuery) {
      mediaQuery.addEventListener('change', onPreferenceChange, false);
      return () =>
        mediaQuery.removeEventListener('change', onPreferenceChange, false);
    }
    function onPreferenceChange() {
      setDefaultTheme(getDefaultBrowserTheme());
    }
  }, []);

  // When the mode gets updated then update the document attribute
  useEffect(() => {
    if (savedTheme) {
      document.documentElement.setAttribute(attributeName, savedTheme);
    } else {
      document.documentElement.removeAttribute(attributeName);
    }
  }, [savedTheme]);

  // When the mode gets updated then update the persisted preference
  useEffect(() => {
    if (savedTheme) {
      if (localStorage.getItem(storageName) !== savedTheme) {
        localStorage.setItem(storageName, savedTheme);
      }
    } else {
      if (localStorage.getItem(storageName)) {
        localStorage.removeItem(storageName);
      }
    }
  }, [savedTheme]);

  return (
    <ThemeContext.Provider
      value={{
        themeMode: 'dark',
        setThemeMode: setSavedTheme,
        toggleThemeMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

function getSavedTheme(): SavedThemeMode {
  return 'dark' || (localStorage.getItem(storageName) as SavedThemeMode);
}

function getTheme(): ThemeMode {
  return getSavedTheme() ?? getDefaultBrowserTheme();
}

function getDefaultBrowserTheme(): ThemeMode {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(themeProperty)
    .trim() as ThemeMode;
}
