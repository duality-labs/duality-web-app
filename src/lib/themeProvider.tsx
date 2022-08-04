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
const themeProperty = '--theme';

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
  const [themeMode, setThemeMode] = useState(
    localStorage.getItem(storageName) as ThemeMode | null
  );
  const safeTheme = themeMode ?? getCSSTheme();

  const toggleThemeMode = useCallback(
    function () {
      setThemeMode(safeTheme === 'dark' ? 'light' : 'dark');
    },
    [safeTheme]
  );

  useEffect(() => {
    window.addEventListener('storage', onStorageChange, false);
    return () => window.removeEventListener('storage', onStorageChange, false);

    function onStorageChange() {
      setThemeMode(localStorage.getItem(storageName) as ThemeMode | null);
    }
  }, []);

  // When the mode gets updated then update the document attribute
  useEffect(() => {
    if (themeMode) {
      document.documentElement.setAttribute(attributeName, themeMode);
    } else {
      document.documentElement.removeAttribute(attributeName);
    }
  }, [themeMode]);

  // When the mode gets updated then update the persisted preference
  useEffect(() => {
    if (themeMode) {
      if (localStorage.getItem(storageName) !== themeMode) {
        localStorage.setItem(storageName, themeMode);
      }
    } else {
      if (localStorage.getItem(storageName)) {
        localStorage.removeItem(storageName);
      }
    }
  }, [themeMode]);

  return (
    <ThemeContext.Provider
      value={{ themeMode: safeTheme, setThemeMode, toggleThemeMode }}
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
    (localStorage.getItem(storageName) as ThemeMode | null) ?? getCSSTheme()
  );
}

export function getCSSTheme(): ThemeMode {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(themeProperty)
    .trim() as ThemeMode;
}
