import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type UserRole = "owner" | "admin" | "viewer";

export interface AuthUser {
  id: string;
  username: string;
  globalName: string | null;
  discriminator: string;
  avatarUrl: string | null;
  tag: string;
  role: UserRole;
  isOwner: boolean;
}

export interface AuthSession {
  expiresAt: string;
  expiresInMs: number;
}

export interface BotPreview {
  botName: string | null;
  botTag: string | null;
  botAvatar: string | null;
  online: boolean;
  ping: number;
  guildCount: number;
  version: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  session: AuthSession | null;
  loading: boolean;
  oauthConfigured: boolean;
  botPreview: BotPreview | null;
  refresh: () => Promise<void>;
  login: () => void;
  logout: () => Promise<void>;
  isOwner: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function fetchMe(): Promise<{
  user: AuthUser;
  session: AuthSession;
} | null> {
  try {
    const res = await fetch(`${BASE}/api/auth/me`, {
      credentials: "include",
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.authenticated || !data.user) return null;
    return {
      user: {
        ...data.user,
        role: data.user.role ?? "admin",
        isOwner: Boolean(data.user.isOwner ?? data.user.role === "owner"),
      } as AuthUser,
      session: data.session ?? {
        expiresAt: new Date(Date.now() + 7 * 864e5).toISOString(),
        expiresInMs: 7 * 864e5,
      },
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [oauthConfigured, setOauthConfigured] = useState(true);
  const [botPreview, setBotPreview] = useState<BotPreview | null>(null);

  const refresh = useCallback(async () => {
    const me = await fetchMe();
    setUser(me?.user ?? null);
    setSession(me?.session ?? null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const statusRes = await fetch(`${BASE}/api/auth/status`, {
          credentials: "include",
        });
        if (statusRes.ok) {
          const s = await statusRes.json();
          if (!cancelled) {
            setOauthConfigured(Boolean(s.oauthConfigured));
            if (s.bot) setBotPreview(s.bot as BotPreview);
          }
        }
      } catch {
        /* ignore */
      }

      const me = await fetchMe();
      if (!cancelled) {
        setUser(me?.user ?? null);
        setSession(me?.session ?? null);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(() => {
    // Same-origin by default (works with Vite proxy + Dev Tunnels).
    // Optional override: VITE_API_URL=https://your-api-tunnel
    const envApi = (import.meta as { env?: Record<string, string> }).env
      ?.VITE_API_URL;
    const origin = envApi?.replace(/\/+$/, "") || BASE || "";
    window.location.href = `${origin}/api/auth/discord`;
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(`${BASE}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } finally {
      setUser(null);
      setSession(null);
      window.location.href = `${BASE}/login`;
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      session,
      loading,
      oauthConfigured,
      botPreview,
      refresh,
      login,
      logout,
      isOwner: Boolean(user?.isOwner),
    }),
    [user, session, loading, oauthConfigured, botPreview, refresh, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
