import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ThemeId =
  | "cyberpunk"
  | "sakura"
  | "phantom"
  | "midnight"
  | "matrix";

export interface ThemeMeta {
  id: ThemeId;
  name: string;
  description: string;
  /** Preview swatches */
  swatches: [string, string, string];
}

export const THEMES: ThemeMeta[] = [
  {
    id: "cyberpunk",
    name: "Cyberpunk",
    description: "Rosa neón + cian. Estilo Zero Two clásico.",
    swatches: ["#ff2d6b", "#00f5d4", "#050810"],
  },
  {
    id: "sakura",
    name: "Sakura",
    description: "Pétalos suaves, plum y rosa pastel.",
    swatches: ["#ff6b9d", "#f9a8d4", "#140a12"],
  },
  {
    id: "phantom",
    name: "Phantom",
    description: "Violeta y azul eléctrico nocturno.",
    swatches: ["#c084fc", "#38bdf8", "#07060f"],
  },
  {
    id: "midnight",
    name: "Midnight",
    description: "Azul pro limpio y sobrio.",
    swatches: ["#60a5fa", "#22d3ee", "#060a12"],
  },
  {
    id: "matrix",
    name: "Matrix",
    description: "Terminal verde. Solo código y señales.",
    swatches: ["#4ade80", "#86efac", "#030805"],
  },
];

const STORAGE_KEY = "zt_dashboard_settings";

export interface DashboardSettings {
  theme: ThemeId;
  refreshInterval: number;
  notifyOnWarn: boolean;
  notifyOnMaintenance: boolean;
  compactMode: boolean;
  showGuildIds: boolean;
  language: string;
  reducedMotion: boolean;
}

export const DEFAULT_SETTINGS: DashboardSettings = {
  theme: "cyberpunk",
  refreshInterval: 30,
  notifyOnWarn: true,
  notifyOnMaintenance: true,
  compactMode: false,
  showGuildIds: false,
  language: "es",
  reducedMotion: false,
};

function isThemeId(v: unknown): v is ThemeId {
  return (
    typeof v === "string" &&
    THEMES.some((t) => t.id === v)
  );
}

export function loadSettings(): DashboardSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<DashboardSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      theme: isThemeId(parsed.theme) ? parsed.theme : DEFAULT_SETTINGS.theme,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: DashboardSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

function applyDomTheme(theme: ThemeId, compact: boolean, reducedMotion: boolean) {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.setAttribute("data-compact", compact ? "true" : "false");
  root.classList.add("dark");
  if (reducedMotion) {
    root.setAttribute("data-reduced-motion", "true");
  } else {
    root.removeAttribute("data-reduced-motion");
  }
}

interface ThemeContextValue {
  settings: DashboardSettings;
  theme: ThemeId;
  setTheme: (id: ThemeId) => void;
  updateSettings: (patch: Partial<DashboardSettings>) => void;
  save: () => void;
  reset: () => void;
  dirty: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<DashboardSettings>(() => {
    if (typeof window === "undefined") return DEFAULT_SETTINGS;
    return loadSettings();
  });
  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    JSON.stringify(loadSettings()),
  );

  // Apply on mount + whenever theme/compact changes (live preview)
  useEffect(() => {
    applyDomTheme(
      settings.theme,
      settings.compactMode,
      settings.reducedMotion,
    );
  }, [settings.theme, settings.compactMode, settings.reducedMotion]);

  const dirty = useMemo(
    () => JSON.stringify(settings) !== savedSnapshot,
    [settings, savedSnapshot],
  );

  const setTheme = useCallback((id: ThemeId) => {
    setSettings((s) => ({ ...s, theme: id }));
  }, []);

  const updateSettings = useCallback((patch: Partial<DashboardSettings>) => {
    setSettings((s) => ({ ...s, ...patch }));
  }, []);

  const save = useCallback(() => {
    saveSettings(settings);
    setSavedSnapshot(JSON.stringify(settings));
  }, [settings]);

  const reset = useCallback(() => {
    const next = { ...DEFAULT_SETTINGS };
    setSettings(next);
    saveSettings(next);
    setSavedSnapshot(JSON.stringify(next));
    applyDomTheme(next.theme, next.compactMode, next.reducedMotion);
  }, []);

  const value = useMemo(
    () => ({
      settings,
      theme: settings.theme,
      setTheme,
      updateSettings,
      save,
      reset,
      dirty,
    }),
    [settings, setTheme, updateSettings, save, reset, dirty],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useThemeSettings(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useThemeSettings must be used within ThemeProvider");
  }
  return ctx;
}

/** Safe hook for places that might render before provider (shouldn't) */
export function useThemeId(): ThemeId {
  try {
    return useThemeSettings().theme;
  } catch {
    return "cyberpunk";
  }
}
