import {
  useEffect,
  useState,
  useContext,
  createContext,
  useCallback,
} from 'react';

export type ThemeMode = 'light' | 'dark';

const storageName = 'themeMode';
const attributeName = 'data-theme-mode';
// name of css property indicating mode
const themeProperty = '--default-theme';

interface ThemeContextType {
  setThemeMode: (theme: ThemeMode | null) => void;
  toggleThemeMode: () => void;
  themeMode: ThemeMode;
}

const ThemeContext = createContext<ThemeContextType>({
  toggleThemeMode: () => void 0,
  setThemeMode: () => void 0,
  themeMode: getTheme(),
});

const storedMode = localStorage.getItem(storageName) as ThemeMode | null;
if (storedMode) {
  document.documentElement.setAttribute(attributeName, storedMode);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [savedTheme, setSavedTheme] = useState(
    localStorage.getItem(storageName) as ThemeMode | null
  );
  const themeMode = savedTheme ?? getDefaultBrowserTheme();

  const toggleThemeMode = useCallback(
    function () {
      setSavedTheme(themeMode === 'dark' ? 'light' : 'dark');
    },
    [themeMode]
  );

  useEffect(() => {
    window.addEventListener('storage', onStorageChange, false);
    return () => window.removeEventListener('storage', onStorageChange, false);

    function onStorageChange() {
      setSavedTheme(localStorage.getItem(storageName) as ThemeMode | null);
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
      value={{ themeMode, setThemeMode: setSavedTheme, toggleThemeMode }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeMode() {
  return useContext(ThemeContext);
}

export function getTheme(): ThemeMode {
  return (
    (localStorage.getItem(storageName) as ThemeMode | null) ??
    getDefaultBrowserTheme()
  );
}

export function getDefaultBrowserTheme(): ThemeMode {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(themeProperty)
    .trim() as ThemeMode;
}
