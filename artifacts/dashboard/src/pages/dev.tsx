import { useState, useEffect, useCallback, useRef, type KeyboardEvent } from "react";
import { useLocation } from "wouter";
import { Terminal, Shield, Megaphone, GitCommit, Trash2, Power, AlertTriangle, CheckCircle2, XCircle, Lock, Loader2, RotateCcw, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

const TOKEN_KEY = "zt_dev_token";
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type ChangelogType = "feature" | "fix" | "improvement" | "breaking";

interface ChangelogEntry {
  id: number;
  version: string;
  title: string;
  description: string;
  type: string;
  createdAt: string;
}

interface RestartInfo {
  inProgress: boolean;
  mode: "soft" | "reload" | "hard" | null;
  phase: string;
  startedAt: number | null;
  finishedAt: number | null;
  ok: boolean | null;
  error: string | null;
  log: string[];
  elapsedMs: number;
}

interface DevStatus {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  botOnline: boolean;
  guildsCount: number;
  restartInProgress?: boolean;
  restart?: RestartInfo;
  systemUptime?: number;
  ping?: number;
  botName?: string | null;
  botTag?: string | null;
}

type RestartMode = "soft" | "reload" | "hard";

async function devFetch(path: string, token: string, options?: RequestInit) {
  return fetch(`${BASE}/api/dev${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "x-dev-token": token,
      ...(options?.headers ?? {}),
    },
  });
}

const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  feature:     { label: "FEATURE",     color: "text-cyan-400 border-cyan-400/30 bg-cyan-400/10" },
  fix:         { label: "FIX",         color: "text-green-400 border-green-400/30 bg-green-400/10" },
  improvement: { label: "IMPROVEMENT", color: "text-yellow-400 border-yellow-400/30 bg-yellow-400/10" },
  breaking:    { label: "BREAKING",    color: "text-red-400 border-red-400/30 bg-red-400/10" },
};

export default function DevPanel() {
  const { toast } = useToast();
  const { user, isOwner, loading: authLoadingUser } = useAuth();
  const [, setLocation] = useLocation();

  // Only the developer (OWNER_IDS) can open the Dev Panel — no one else
  useEffect(() => {
    if (!authLoadingUser && !isOwner) {
      toast({
        title: "Acceso denegado",
        description: "El Dev Panel es exclusivo de la developer del bot.",
        variant: "destructive",
      });
      setLocation("/");
    }
  }, [authLoadingUser, isOwner, setLocation, toast]);

  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) ?? "");
  const [tokenInput, setTokenInput] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authed, setAuthed] = useState(false);

  const [status, setStatus] = useState<DevStatus | null>(null);
  const [changelogs, setChangelogs] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  // Maintenance form
  const [maintenanceMsg, setMaintenanceMsg] = useState("");
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [maintenanceNotes, setMaintenanceNotes] = useState("");
  const [maintenanceGenLoading, setMaintenanceGenLoading] = useState(false);

  // Announce form
  const [announceTitle, setAnnounceTitle] = useState("");
  const [announceMsg, setAnnounceMsg] = useState("");
  const [announceLoading, setAnnounceLoading] = useState(false);
  const [announceNotes, setAnnounceNotes] = useState("");
  const [announceGenLoading, setAnnounceGenLoading] = useState(false);

  // Restart bot
  const [restartState, setRestartState] = useState<"idle" | "confirm" | "restarting" | "done" | "failed">("idle");
  const [restartMode, setRestartMode] = useState<RestartMode>("soft");
  const [restartCountdown, setRestartCountdown] = useState(0);
  const [restartLog, setRestartLog] = useState<string[]>([]);
  const [restartPhase, setRestartPhase] = useState("idle");
  const restartTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Changelog form
  const [clVersion, setClVersion] = useState("");
  const [clTitle, setClTitle] = useState("");
  const [clDesc, setClDesc] = useState("");
  const [clType, setClType] = useState<ChangelogType>("feature");
  const [clLoading, setClLoading] = useState(false);
  const [clNotes, setClNotes] = useState("");
  const [clDiscordMsg, setClDiscordMsg] = useState("");
  const [clGenLoading, setClGenLoading] = useState(false);
  const [clBullets, setClBullets] = useState<string[]>([]);

  // Command console
  type ConsoleLine = { kind: "in" | "out" | "err" | "sys"; text: string };
  const [consoleLines, setConsoleLines] = useState<ConsoleLine[]>([
    { kind: "sys", text: "Zero Two · Dev Console  ·  escribe help" },
  ]);
  const [consoleInput, setConsoleInput] = useState("");
  const [consoleBusy, setConsoleBusy] = useState(false);
  const consoleEndRef = useRef<HTMLDivElement | null>(null);
  const consoleHistoryRef = useRef<string[]>([]);
  const consoleHistIdx = useRef(-1);

  const fetchData = useCallback(async (t: string, opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const [statusRes, logsRes] = await Promise.all([
        devFetch("/status", t),
        devFetch("/changelogs", t),
      ]);

      if (statusRes.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        setToken("");
        setAuthed(false);
        if (!opts?.silent) setLoading(false);
        return;
      }

      if (statusRes.ok) {
        const s: DevStatus = await statusRes.json();
        setStatus(s);
        // only seed message field when empty or first load
        setMaintenanceMsg((prev) =>
          prev && opts?.silent ? prev : (s.maintenanceMessage ?? prev),
        );
      }
      if (logsRes.ok) {
        setChangelogs(await logsRes.json());
      }
      setAuthed(true);
    } catch {
      // network error — mark offline so UI stays honest
      setStatus((prev) =>
        prev
          ? { ...prev, botOnline: false, guildsCount: 0, ping: -1 }
          : prev,
      );
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  // Auto-auth if token is in localStorage
  useEffect(() => {
    if (token) {
      fetchData(token);
    }
  }, [token, fetchData]);

  // Keep bot online / guilds / maintenance in sync while the panel is open
  useEffect(() => {
    if (!token || !authed) return;
    const id = window.setInterval(() => {
      void fetchData(token, { silent: true });
    }, 4000);
    return () => window.clearInterval(id);
  }, [token, authed, fetchData]);

  const handleLogin = async () => {
    if (!tokenInput.trim()) return;
    setAuthLoading(true);
    try {
      const res = await devFetch("/status", tokenInput.trim());
      if (res.ok) {
        localStorage.setItem(TOKEN_KEY, tokenInput.trim());
        setToken(tokenInput.trim());
        setTokenInput("");
        toast({ title: "Acceso concedido", description: "Bienvenido al panel de desarrollo." });
      } else {
        toast({ title: "Token inválido", description: "Verifica tu DEV_TOKEN.", variant: "destructive" });
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken("");
    setAuthed(false);
    setStatus(null);
    setChangelogs([]);
  };

  const toggleMaintenance = async () => {
    if (!status) return;
    setMaintenanceLoading(true);
    try {
      const res = await devFetch("/maintenance", token, {
        method: "POST",
        body: JSON.stringify({ enabled: !status.maintenanceMode, message: maintenanceMsg || undefined }),
      });
      if (res.ok) {
        const data = await res.json();
        setStatus((s) => s ? { ...s, maintenanceMode: data.maintenanceMode, maintenanceMessage: data.maintenanceMessage } : s);
        toast({
          title: data.maintenanceMode ? "Modo mantenimiento ACTIVADO" : "Modo mantenimiento DESACTIVADO",
        });
      }
    } finally {
      setMaintenanceLoading(false);
    }
  };

  const generateMaintenanceWithAi = async () => {
    setMaintenanceGenLoading(true);
    try {
      const res = await devFetch("/maintenance/generate", token, {
        method: "POST",
        body: JSON.stringify({
          notes: maintenanceNotes.trim() || undefined,
          useGit: true,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast({
          title: "Gemini no pudo generar",
          description: data?.error ?? `HTTP ${res.status}`,
          variant: "destructive",
        });
        return;
      }
      const draft = data?.draft;
      if (draft?.message) {
        setMaintenanceMsg(String(draft.message));
        toast({
          title: "Mensaje de mantenimiento generado",
          description: draft.shortStatus
            ? String(draft.shortStatus)
            : `Modelo: ${data.model ?? "gemini"}`,
        });
      }
    } catch (e) {
      toast({
        title: "Error de red",
        description: e instanceof Error ? e.message : "fallo",
        variant: "destructive",
      });
    } finally {
      setMaintenanceGenLoading(false);
    }
  };

  const sendAnnouncement = async () => {
    if (!announceTitle.trim() || !announceMsg.trim()) return;
    setAnnounceLoading(true);
    try {
      const res = await devFetch("/announce", token, {
        method: "POST",
        body: JSON.stringify({ title: announceTitle, message: announceMsg }),
      });
      if (res.ok) {
        const data = await res.json();
        toast({ title: `Anuncio enviado`, description: `${data.sent}/${data.total} servidores recibieron el mensaje.` });
        setAnnounceTitle("");
        setAnnounceMsg("");
        setAnnounceNotes("");
      } else {
        toast({ title: "Error al enviar", variant: "destructive" });
      }
    } finally {
      setAnnounceLoading(false);
    }
  };

  const generateAnnounceWithAi = async () => {
    setAnnounceGenLoading(true);
    try {
      const res = await devFetch("/announce/generate", token, {
        method: "POST",
        body: JSON.stringify({
          notes: announceNotes.trim() || undefined,
          useGit: true,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast({
          title: "Gemini no pudo generar",
          description: data?.error ?? `HTTP ${res.status}`,
          variant: "destructive",
        });
        return;
      }
      const draft = data?.draft;
      if (draft) {
        setAnnounceTitle(String(draft.title ?? ""));
        setAnnounceMsg(String(draft.message ?? ""));
        toast({
          title: "Broadcast generado",
          description: `Modelo: ${data.model ?? "gemini"} · ~${data.guildsCount ?? "?"} servers`,
        });
      }
    } catch (e) {
      toast({
        title: "Error de red",
        description: e instanceof Error ? e.message : "fallo",
        variant: "destructive",
      });
    } finally {
      setAnnounceGenLoading(false);
    }
  };

  const postChangelog = async () => {
    if (!clVersion.trim() || !clTitle.trim() || !clDesc.trim()) return;
    setClLoading(true);
    try {
      const res = await devFetch("/changelogs", token, {
        method: "POST",
        body: JSON.stringify({ version: clVersion, title: clTitle, description: clDesc, type: clType }),
      });
      if (res.ok) {
        const entry = await res.json();
        setChangelogs((prev) => [entry, ...prev]);
        toast({ title: "Changelog publicado" });
        setClVersion("");
        setClTitle("");
        setClDesc("");
        setClType("feature");
        setClNotes("");
        setClDiscordMsg("");
        setClBullets([]);
      }
    } finally {
      setClLoading(false);
    }
  };

  const generateChangelogWithAi = async () => {
    setClGenLoading(true);
    try {
      const res = await devFetch("/changelogs/generate", token, {
        method: "POST",
        body: JSON.stringify({
          version: clVersion.trim() || undefined,
          type: clType,
          notes: clNotes.trim() || undefined,
          since: "30 days ago",
          maxCommits: 50,
          autoPublish: false,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast({
          title: "Gemini no pudo generar",
          description: data?.error ?? `HTTP ${res.status}`,
          variant: "destructive",
        });
        return;
      }
      const draft = data?.draft;
      if (!draft) {
        toast({ title: "Respuesta vacía de Gemini", variant: "destructive" });
        return;
      }
      setClVersion(String(draft.version ?? clVersion));
      setClTitle(String(draft.title ?? ""));
      setClDesc(String(draft.description ?? ""));
      if (draft.type) setClType(draft.type as ChangelogType);
      setClBullets(
        Array.isArray(draft.summaryBullets)
          ? draft.summaryBullets.map(String)
          : [],
      );
      setClDiscordMsg(String(draft.discordMessage ?? ""));
      toast({
        title: "Changelog generado",
        description: `Modelo: ${data.model ?? "gemini"} · ${data.meta?.commitCount ?? "?"} commits`,
      });
    } catch (e) {
      toast({
        title: "Error de red",
        description: e instanceof Error ? e.message : "fallo",
        variant: "destructive",
      });
    } finally {
      setClGenLoading(false);
    }
  };

  const copyDiscordMessage = async () => {
    if (!clDiscordMsg.trim()) return;
    try {
      await navigator.clipboard.writeText(clDiscordMsg);
      toast({ title: "Mensaje Discord copiado" });
    } catch {
      toast({ title: "No se pudo copiar", variant: "destructive" });
    }
  };

  const deleteChangelog = async (id: number) => {
    const res = await devFetch(`/changelogs/${id}`, token, { method: "DELETE" });
    if (res.ok) {
      setChangelogs((prev) => prev.filter((c) => c.id !== id));
      toast({ title: "Entrada eliminada" });
    }
  };

  const handleRestartConfirm = (mode: RestartMode) => {
    setRestartMode(mode);
    setRestartState("confirm");
  };
  const handleRestartCancel = () => {
    setRestartState("idle");
    setRestartLog([]);
    setRestartPhase("idle");
  };

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [consoleLines]);

  const runConsole = async (raw?: string) => {
    const command = (raw ?? consoleInput).trim();
    if (!command || consoleBusy) return;
    setConsoleInput("");
    consoleHistoryRef.current = [
      command,
      ...consoleHistoryRef.current.filter((c) => c !== command),
    ].slice(0, 40);
    consoleHistIdx.current = -1;

    setConsoleLines((prev) => [...prev, { kind: "in", text: `$ ${command}` }]);

    if (command.toLowerCase() === "clear") {
      setConsoleLines([{ kind: "sys", text: "consola limpia" }]);
      return;
    }

    setConsoleBusy(true);
    try {
      const res = await devFetch("/console", token, {
        method: "POST",
        body: JSON.stringify({ command }),
      });
      const rawText = await res.text();
      let data: {
        ok?: boolean;
        lines?: string[];
        error?: string;
        status?: DevStatus;
      } = {};
      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch {
        data = {
          ok: false,
          lines: [
            `HTTP ${res.status} — respuesta no JSON`,
            rawText.slice(0, 200) || "(vacío)",
            res.status === 404
              ? "ℹ La ruta /api/dev/console no existe: reinicia el api-server con el build nuevo."
              : "",
          ].filter(Boolean),
        };
      }

      if (!res.ok && !data.lines?.length) {
        data.lines = [
          `HTTP ${res.status}: ${data.error ?? (res.statusText || "error")}`,
        ];
        data.ok = false;
      }

      const out: string[] = Array.isArray(data.lines)
        ? data.lines
        : [String(data.error ?? "sin salida")];
      const filtered = out.filter(
        (l: string) => l !== `$ ${command}` && l !== "__CLEAR__",
      );
      if (out.includes("__CLEAR__")) {
        setConsoleLines([{ kind: "sys", text: "consola limpia" }]);
      } else {
        setConsoleLines((prev) => [
          ...prev,
          ...filtered.map((text: string) => ({
            kind: (data.ok === false || text.startsWith("✗")
              ? "err"
              : text.startsWith("→") || text.startsWith("ℹ")
                ? "sys"
                : "out") as ConsoleLine["kind"],
            text,
          })),
        ]);
      }
      if (data.status) setStatus(data.status);

      if (command.toLowerCase().startsWith("respawn") && data.ok) {
        setConsoleLines((prev) => [
          ...prev,
          {
            kind: "sys",
            text: "proceso reiniciando… reintenta el token en ~5s",
          },
        ]);
      }
    } catch (e) {
      setConsoleLines((prev) => [
        ...prev,
        {
          kind: "err",
          text: `✗ red: ${e instanceof Error ? e.message : "error"}`,
        },
      ]);
    } finally {
      setConsoleBusy(false);
    }
  };

  const onConsoleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void runConsole();
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const hist = consoleHistoryRef.current;
      if (!hist.length) return;
      const next = Math.min(consoleHistIdx.current + 1, hist.length - 1);
      consoleHistIdx.current = next;
      setConsoleInput(hist[next] ?? "");
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const hist = consoleHistoryRef.current;
      const next = consoleHistIdx.current - 1;
      if (next < 0) {
        consoleHistIdx.current = -1;
        setConsoleInput("");
      } else {
        consoleHistIdx.current = next;
        setConsoleInput(hist[next] ?? "");
      }
    }
  };

  const handleRestart = async () => {
    setRestartState("restarting");
    setRestartPhase("starting");
    setRestartLog([`→ mode=${restartMode}`]);
    setRestartCountdown(restartMode === "hard" ? 45 : restartMode === "reload" ? 90 : 30);
    setStatus((s) =>
      s
        ? {
            ...s,
            botOnline: restartMode === "hard" ? s.botOnline : false,
            restartInProgress: true,
          }
        : s,
    );

    try {
      const res = await devFetch("/restart", token, {
        method: "POST",
        body: JSON.stringify({ mode: restartMode }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok && res.status !== 0) {
        toast({
          title: "No se pudo reiniciar",
          description: body?.error ?? `HTTP ${res.status}`,
          variant: "destructive",
        });
        setRestartState("failed");
        setRestartLog((prev) => [
          ...prev,
          `✗ ${body?.error ?? `HTTP ${res.status}`}`,
        ]);
        void fetchData(token, { silent: true });
        return;
      }
      if (body?.status?.restart?.log) {
        setRestartLog(body.status.restart.log);
        setRestartPhase(body.status.restart.phase ?? "starting");
      }
    } catch {
      // hard respawn may drop the connection
      if (restartMode === "hard") {
        setRestartLog((prev) => [
          ...prev,
          "→ proceso reiniciando (conexión interrumpida, normal)",
        ]);
      }
    }

    if (restartTimerRef.current) clearInterval(restartTimerRef.current);
    restartTimerRef.current = setInterval(async () => {
      setRestartCountdown((c) => Math.max(0, c - 1));
      try {
        const res = await devFetch("/status", token);
        if (!res.ok) return;
        const s: DevStatus = await res.json();
        setStatus(s);
        if (s.restart?.log?.length) {
          setRestartLog(s.restart.log);
        }
        if (s.restart?.phase) setRestartPhase(s.restart.phase);

        const finishedOk =
          s.botOnline &&
          !s.restartInProgress &&
          (s.restart?.ok === true || s.restart?.phase === "done" || s.restart?.phase === "idle");

        const finishedFail =
          !s.restartInProgress &&
          (s.restart?.ok === false || s.restart?.phase === "failed");

        if (finishedOk) {
          if (restartTimerRef.current) {
            clearInterval(restartTimerRef.current);
            restartTimerRef.current = null;
          }
          setRestartState("done");
          toast({
            title:
              restartMode === "hard"
                ? "Proceso reiniciado"
                : "Bot reconectado",
            description: `${s.guildsCount} servidores · ping ${s.ping ?? "—"}ms · ${s.botTag ?? s.botName ?? ""}`,
          });
          window.setTimeout(() => {
            setRestartState("idle");
            setRestartPhase("idle");
          }, 3500);
        } else if (finishedFail) {
          if (restartTimerRef.current) {
            clearInterval(restartTimerRef.current);
            restartTimerRef.current = null;
          }
          setRestartState("failed");
          toast({
            title: "Restart falló",
            description: s.restart?.error ?? "Revisa el log",
            variant: "destructive",
          });
        }
      } catch {
        // hard mode: API down briefly
        if (restartMode === "hard") {
          setRestartPhase("respawn");
        }
      }
    }, 800);

    const timeoutMs =
      restartMode === "reload" ? 120_000 : restartMode === "hard" ? 60_000 : 40_000;
    window.setTimeout(() => {
      if (restartTimerRef.current) {
        clearInterval(restartTimerRef.current);
        restartTimerRef.current = null;
      }
      setRestartState((st) => {
        if (st === "restarting") {
          void fetchData(token, { silent: true });
          return "idle";
        }
        return st;
      });
    }, timeoutMs);
  };

  const RESTART_PHASES: { id: string; label: string }[] = [
    { id: "starting", label: "Inicio" },
    { id: "rebuild", label: "Build" },
    { id: "disconnect", label: "Disconnect" },
    { id: "login", label: "Login" },
    { id: "ready", label: "Ready" },
    { id: "presence", label: "Presence" },
    { id: "respawn", label: "Respawn" },
    { id: "done", label: "Done" },
  ];

  const visiblePhases =
    restartMode === "soft"
      ? RESTART_PHASES.filter((p) =>
          ["starting", "disconnect", "login", "ready", "presence", "done"].includes(
            p.id,
          ),
        )
      : restartMode === "reload"
        ? RESTART_PHASES.filter((p) => p.id !== "respawn")
        : RESTART_PHASES.filter((p) =>
            ["starting", "rebuild", "respawn", "done"].includes(p.id),
          );

  useEffect(() => {
    return () => {
      if (restartTimerRef.current) clearInterval(restartTimerRef.current);
    };
  }, []);

  if (authLoadingUser || !isOwner) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ── Auth gate ──────────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="relative border border-primary/30 bg-card p-10 w-full max-w-md" style={{ boxShadow: "0 0 30px hsl(340 95% 60% / 0.15)" }}>
          {/* Corner brackets */}
          <span className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-primary" />
          <span className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-primary" />
          <span className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-primary" />
          <span className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-primary" />

          <div className="text-center mb-8">
            <Lock className="h-12 w-12 text-primary mx-auto mb-4" />
            <h1 className="text-2xl font-display text-primary tracking-widest">ACCESO RESTRINGIDO</h1>
            <p className="text-muted-foreground text-sm mt-2 font-mono">
              Tu sesión de Discord ha sido verificada como owner.
            </p>
            {user && (
              <p className="text-xs uppercase tracking-[0.24em] text-primary/80 mt-3 font-mono">
                @ {user.tag}
              </p>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground font-mono mb-1 block">TOKEN DE DESARROLLO</label>
              <Input
                type="password"
                autoComplete="new-password"
                placeholder="Introduce tu DEV_TOKEN aquí"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                className="font-mono bg-sidebar border-primary/30 focus-visible:ring-primary"
              />
            </div>
            <Button
              className="w-full font-display tracking-widest"
              onClick={handleLogin}
              disabled={authLoading || !tokenInput.trim()}
            >
              {authLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Terminal className="h-4 w-4 mr-2" />
              )}
              AUTENTICAR
            </Button>
            <p className="text-[11px] text-muted-foreground font-mono leading-relaxed">
              El token se guarda solo en este navegador. No lo compartas con nadie.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Dev Panel ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-display text-primary tracking-widest flex items-center gap-3">
            <Terminal className="h-8 w-8" />
            DEV_CONSOLE
          </h1>
          <p className="text-muted-foreground font-mono text-sm mt-1">
            {user ? `Owner: ${user.tag}` : "Developer panel active"} · sesión activa
          </p>
        </div>
        <div className="flex items-center gap-3">
          {status && (
            <div className={`flex items-center gap-2 border px-3 py-1.5 text-xs font-mono ${
              status.botOnline
                ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-400"
                : "border-red-500/30 bg-red-500/10 text-red-400"
            }`}>
              <span className={`h-2 w-2 rounded-full ${status.botOnline ? "bg-cyan-500 animate-pulse" : "bg-red-500"}`} />
              BOT {status.botOnline ? "ONLINE" : "OFFLINE"}
              {status.botOnline && typeof status.ping === "number" && status.ping >= 0 && (
                <span className="text-cyan-500/70">· {status.ping}ms</span>
              )}
              {status.botOnline && (
                <span className="text-cyan-500/70">· {status.guildsCount} guilds</span>
              )}
            </div>
          )}
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-foreground font-mono text-xs">
            [LOGOUT]
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Maintenance Mode */}
        <DevCard icon={Power} title="MAINTENANCE_MODE" glowColor="primary">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-mono">Estado actual</p>
                <div className={`flex items-center gap-2 mt-1 font-display text-sm tracking-widest ${
                  status?.maintenanceMode ? "text-red-400" : "text-green-400"
                }`}>
                  {status?.maintenanceMode
                    ? <><XCircle className="h-4 w-4" /> ACTIVO</>
                    : <><CheckCircle2 className="h-4 w-4" /> INACTIVO</>
                  }
                </div>
              </div>
              <div className="text-xs text-muted-foreground font-mono text-right">
                <div>{status?.guildsCount ?? 0} servers afectados</div>
              </div>
            </div>

            <div>
              <label className="text-xs font-mono text-muted-foreground block mb-1">
                Notas para Gemini (opcional)
              </label>
              <Textarea
                value={maintenanceNotes}
                onChange={(e) => setMaintenanceNotes(e.target.value)}
                placeholder="Qué se está arreglando, ETA, tono…"
                className="font-mono text-sm bg-sidebar border-border resize-none h-14"
              />
            </div>

            <Button
              variant="outline"
              className="w-full font-display tracking-widest text-sm border-primary/40 text-primary hover:bg-primary/10"
              onClick={() => void generateMaintenanceWithAi()}
              disabled={maintenanceGenLoading || maintenanceLoading}
            >
              {maintenanceGenLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              GENERAR MENSAJE CON GEMINI
            </Button>

            <div>
              <label className="text-xs font-mono text-muted-foreground block mb-1">Mensaje de mantenimiento</label>
              <Textarea
                value={maintenanceMsg}
                onChange={(e) => setMaintenanceMsg(e.target.value)}
                placeholder="ZeroTwo está en mantenimiento..."
                className="font-mono text-sm bg-sidebar border-border resize-none h-28"
              />
            </div>

            <Button
              className={`w-full font-display tracking-widest text-sm ${
                status?.maintenanceMode
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-destructive hover:bg-destructive/80 text-white"
              }`}
              onClick={toggleMaintenance}
              disabled={maintenanceLoading}
            >
              {maintenanceLoading
                ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                : <Power className="h-4 w-4 mr-2" />
              }
              {status?.maintenanceMode ? "DESACTIVAR MANTENIMIENTO" : "ACTIVAR MANTENIMIENTO"}
            </Button>

            {status?.maintenanceMode && (
              <div className="flex items-center gap-2 border border-red-500/30 bg-red-500/10 p-3 text-red-400 text-xs font-mono">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                El bot rechaza todos los comandos en este momento.
              </div>
            )}
          </div>
        </DevCard>

        {/* Announce */}
        <DevCard icon={Megaphone} title="BROADCAST_ANNOUNCE" glowColor="cyan">
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground font-mono">
              Envía un embed a todos los servidores. Gemini puede redactarlo desde git + notas.
            </p>
            <div>
              <label className="text-xs font-mono text-muted-foreground block mb-1">
                Notas para Gemini (opcional)
              </label>
              <Textarea
                value={announceNotes}
                onChange={(e) => setAnnounceNotes(e.target.value)}
                placeholder="Enfoca en tickets, logs, nueva versión…"
                className="font-mono text-sm bg-sidebar border-border resize-none h-14"
              />
            </div>
            <Button
              variant="outline"
              className="w-full font-display tracking-widest text-sm border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10"
              onClick={() => void generateAnnounceWithAi()}
              disabled={announceGenLoading || announceLoading}
            >
              {announceGenLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              GENERAR CON GEMINI
            </Button>
            <div>
              <label className="text-xs font-mono text-muted-foreground block mb-1">TÍTULO</label>
              <Input
                value={announceTitle}
                onChange={(e) => setAnnounceTitle(e.target.value)}
                placeholder="Nueva actualización disponible..."
                className="font-mono text-sm bg-sidebar border-border"
              />
            </div>
            <div>
              <label className="text-xs font-mono text-muted-foreground block mb-1">MENSAJE</label>
              <Textarea
                value={announceMsg}
                onChange={(e) => setAnnounceMsg(e.target.value)}
                placeholder="Descripción del anuncio..."
                className="font-mono text-sm bg-sidebar border-border resize-none h-28"
              />
            </div>
            <Button
              className="w-full font-display tracking-widest text-sm"
              style={{ background: "hsl(190 100% 40%)", color: "#000" }}
              onClick={sendAnnouncement}
              disabled={announceLoading || !announceTitle.trim() || !announceMsg.trim()}
            >
              {announceLoading
                ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                : <Megaphone className="h-4 w-4 mr-2" />
              }
              ENVIAR A {status?.guildsCount ?? "?"} SERVIDORES
            </Button>
          </div>
        </DevCard>
      </div>

      {/* Command console */}
      <DevCard icon={Terminal} title="DEV_CONSOLE" glowColor="cyan">
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground font-mono">
            Consola whitelist: rebuild, update (git pull), restart gateway, respawn proceso.
            No ejecuta shell libre.
          </p>

          <div className="flex flex-wrap gap-1.5">
            {(
              [
                "help",
                "status",
                "rebuild",
                "update",
                "reload",
                "deploy",
                "restart",
                "respawn",
                "clear",
              ] as const
            ).map((c) => (
              <button
                key={c}
                type="button"
                disabled={consoleBusy}
                onClick={() => void runConsole(c)}
                className="px-2 py-1 rounded-md text-[10px] font-mono border border-cyan-500/25 text-cyan-300/90 hover:bg-cyan-500/10 disabled:opacity-40"
              >
                {c}
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-border bg-[#05080f] font-mono text-[11px] sm:text-xs h-64 overflow-y-auto p-3 space-y-0.5 shadow-inner">
            {consoleLines.map((line, i) => (
              <div
                key={i}
                className={
                  line.kind === "in"
                    ? "text-cyan-300"
                    : line.kind === "err"
                      ? "text-red-400"
                      : line.kind === "sys"
                        ? "text-amber-300/90"
                        : "text-slate-300 whitespace-pre-wrap break-words"
                }
              >
                {line.text}
              </div>
            ))}
            <div ref={consoleEndRef} />
          </div>

          <div className="flex items-center gap-2">
            <ChevronRight className="h-4 w-4 text-cyan-400 flex-shrink-0" />
            <Input
              value={consoleInput}
              onChange={(e) => setConsoleInput(e.target.value)}
              onKeyDown={onConsoleKey}
              disabled={consoleBusy}
              placeholder={consoleBusy ? "ejecutando…" : "comando… (↑ historial)"}
              className="font-mono text-sm bg-sidebar border-border h-10"
              spellCheck={false}
              autoComplete="off"
            />
            <Button
              size="sm"
              className="font-mono text-xs h-10 px-4"
              disabled={consoleBusy || !consoleInput.trim()}
              onClick={() => void runConsole()}
            >
              {consoleBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "RUN"
              )}
            </Button>
          </div>
        </div>
      </DevCard>

      {/* Restart Bot */}
      <DevCard icon={RotateCcw} title="RESTART_BOT" glowColor="cyan">
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground font-mono">
            Tres modos: soft (gateway), reload (build + gateway), hard (build + respawn del proceso).
          </p>

          {/* Live status */}
          <div className="flex items-center gap-3 border border-border bg-sidebar px-4 py-3 rounded-lg">
            <span
              className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${
                restartState === "restarting"
                  ? "bg-yellow-500 animate-pulse"
                  : restartState === "done"
                    ? "bg-green-500 animate-pulse"
                    : restartState === "failed"
                      ? "bg-red-500"
                      : status?.botOnline
                        ? "bg-cyan-500 animate-pulse"
                        : "bg-red-500"
              }`}
            />
            <div className="min-w-0 flex-1">
              <div className="font-mono text-xs text-foreground">
                {restartState === "restarting"
                  ? `Reiniciando [${restartMode}] · fase: ${restartPhase} · ${restartCountdown}s`
                  : restartState === "done"
                    ? "✓ Completado"
                    : restartState === "failed"
                      ? "✗ Falló — mira el log"
                      : status?.botOnline
                        ? `Online · ${status.botTag ?? status.botName ?? "02"} · ${status.guildsCount} guilds${typeof status.ping === "number" && status.ping >= 0 ? ` · ${status.ping}ms` : ""}`
                        : status
                          ? "Offline (API sí, Discord no)"
                          : "Sin estado"}
              </div>
              {status?.restartInProgress && (
                <div className="text-[10px] font-mono text-yellow-400/80 mt-0.5">
                  server restartInProgress · {status.restart?.phase}
                </div>
              )}
            </div>
          </div>

          {restartState === "idle" && (
            <div className="grid gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => handleRestartConfirm("soft")}
                disabled={!status?.botOnline}
                className="text-left rounded-xl border border-cyan-500/30 bg-cyan-500/5 hover:bg-cyan-500/10 p-3 disabled:opacity-40 transition-colors"
              >
                <div className="font-mono text-xs text-cyan-300 font-medium">SOFT</div>
                <div className="text-[10px] font-mono text-muted-foreground mt-1 leading-snug">
                  Solo reconectar gateway Discord (~5–15s)
                </div>
              </button>
              <button
                type="button"
                onClick={() => handleRestartConfirm("reload")}
                className="text-left rounded-xl border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 p-3 transition-colors"
              >
                <div className="font-mono text-xs text-amber-300 font-medium">RELOAD</div>
                <div className="text-[10px] font-mono text-muted-foreground mt-1 leading-snug">
                  pnpm build + reconectar gateway
                </div>
              </button>
              <button
                type="button"
                onClick={() => handleRestartConfirm("hard")}
                className="text-left rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 p-3 transition-colors"
              >
                <div className="font-mono text-xs text-primary font-medium">HARD</div>
                <div className="text-[10px] font-mono text-muted-foreground mt-1 leading-snug">
                  build + respawn proceso (código nuevo)
                </div>
              </button>
            </div>
          )}

          {restartState === "confirm" && (
            <div className="space-y-3">
              <div className="flex items-start gap-2 border border-yellow-500/30 bg-yellow-500/10 p-3 text-yellow-400 text-xs font-mono rounded-lg">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium">Confirmar restart · {restartMode.toUpperCase()}</div>
                  <div className="mt-1 text-yellow-400/80">
                    {restartMode === "soft" &&
                      "El bot no responderá comandos unos segundos. La API sigue viva."}
                    {restartMode === "reload" &&
                      "Compila el api-server y reconecta Discord. Puede tardar 1–2 min."}
                    {restartMode === "hard" &&
                      "Compila y reinicia el proceso Node. La API caerá unos segundos."}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  className="font-mono text-sm border-border text-muted-foreground hover:text-foreground"
                  onClick={handleRestartCancel}
                >
                  CANCELAR
                </Button>
                <Button
                  className="font-display tracking-widest text-sm bg-cyan-600 hover:bg-cyan-700 text-black"
                  onClick={() => void handleRestart()}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  CONFIRMAR
                </Button>
              </div>
            </div>
          )}

          {(restartState === "restarting" ||
            restartState === "done" ||
            restartState === "failed") && (
            <div className="space-y-3">
              {/* Phase pipeline */}
              <div className="flex flex-wrap gap-1.5">
                {visiblePhases.map((p) => {
                  const order = visiblePhases.map((x) => x.id);
                  const curIdx = order.indexOf(restartPhase);
                  const pIdx = order.indexOf(p.id);
                  const active = p.id === restartPhase;
                  const done =
                    restartState === "done" ||
                    (curIdx >= 0 && pIdx >= 0 && pIdx < curIdx);
                  const failed = restartState === "failed" && active;
                  return (
                    <span
                      key={p.id}
                      className={`text-[10px] font-mono px-2 py-1 rounded-md border ${
                        failed
                          ? "border-red-500/40 bg-red-500/15 text-red-300"
                          : active
                            ? "border-yellow-500/40 bg-yellow-500/15 text-yellow-300"
                            : done
                              ? "border-green-500/30 bg-green-500/10 text-green-300"
                              : "border-border text-muted-foreground"
                      }`}
                    >
                      {p.label}
                    </span>
                  );
                })}
              </div>

              {restartState === "restarting" && (
                <div className="flex items-center gap-3 border border-yellow-500/30 bg-yellow-500/5 py-3 px-4 rounded-lg">
                  <Loader2 className="h-5 w-5 animate-spin text-yellow-400 flex-shrink-0" />
                  <span className="font-mono text-sm text-yellow-400">
                    {restartPhase}… {restartCountdown}s
                  </span>
                </div>
              )}

              {restartState === "done" && (
                <div className="flex items-center gap-3 border border-green-500/30 bg-green-500/5 py-3 px-4 rounded-lg">
                  <CheckCircle2 className="h-5 w-5 text-green-400" />
                  <span className="font-mono text-sm text-green-400">
                    Restart completado
                  </span>
                </div>
              )}

              {restartState === "failed" && (
                <div className="flex items-center justify-between gap-3 border border-red-500/30 bg-red-500/5 py-3 px-4 rounded-lg">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-red-400" />
                    <span className="font-mono text-sm text-red-400">Restart fallido</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="font-mono text-xs"
                    onClick={handleRestartCancel}
                  >
                    OK
                  </Button>
                </div>
              )}

              {/* Live log */}
              {restartLog.length > 0 && (
                <div className="rounded-xl border border-border bg-[#05080f] font-mono text-[10px] sm:text-[11px] max-h-36 overflow-y-auto p-2.5 space-y-0.5">
                  {restartLog.map((line, i) => (
                    <div
                      key={i}
                      className={
                        line.includes("✗")
                          ? "text-red-400"
                          : line.includes("✓")
                            ? "text-green-400"
                            : line.includes("→")
                              ? "text-amber-300/90"
                              : "text-slate-400"
                      }
                    >
                      {line}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </DevCard>

      {/* Changelog */}
      <DevCard icon={GitCommit} title="CHANGELOG_MANAGER" glowColor="primary">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* New entry form */}
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground font-mono">
              Nueva entrada — genera con Gemini (git log del bot + notes) o escribe a mano
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-mono text-muted-foreground block mb-1">VERSION</label>
                <Input
                  value={clVersion}
                  onChange={(e) => setClVersion(e.target.value)}
                  placeholder="v2.4.0 (opcional si usas Gemini)"
                  className="font-mono text-sm bg-sidebar border-border"
                />
              </div>
              <div>
                <label className="text-xs font-mono text-muted-foreground block mb-1">TYPE</label>
                <select
                  value={clType}
                  onChange={(e) => setClType(e.target.value as ChangelogType)}
                  className="w-full h-9 bg-sidebar border border-border text-foreground text-sm font-mono px-2 rounded-none"
                >
                  <option value="feature">feature</option>
                  <option value="fix">fix</option>
                  <option value="improvement">improvement</option>
                  <option value="breaking">breaking</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-mono text-muted-foreground block mb-1">
                NOTAS PARA GEMINI (opcional)
              </label>
              <Textarea
                value={clNotes}
                onChange={(e) => setClNotes(e.target.value)}
                placeholder="Contexto extra: prioriza tickets, logs, dashboard…"
                className="font-mono text-sm bg-sidebar border-border resize-none h-16"
              />
            </div>

            <Button
              variant="outline"
              className="w-full font-display tracking-widest text-sm border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10"
              onClick={() => void generateChangelogWithAi()}
              disabled={clGenLoading || clLoading}
            >
              {clGenLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              GENERAR CON GEMINI
            </Button>

            <div>
              <label className="text-xs font-mono text-muted-foreground block mb-1">TÍTULO</label>
              <Input
                value={clTitle}
                onChange={(e) => setClTitle(e.target.value)}
                placeholder="Descripción breve del cambio"
                className="font-mono text-sm bg-sidebar border-border"
              />
            </div>

            <div>
              <label className="text-xs font-mono text-muted-foreground block mb-1">DESCRIPCIÓN</label>
              <Textarea
                value={clDesc}
                onChange={(e) => setClDesc(e.target.value)}
                placeholder="Detalle completo de los cambios..."
                className="font-mono text-sm bg-sidebar border-border resize-none h-28"
              />
            </div>

            {clBullets.length > 0 && (
              <div className="rounded-lg border border-border bg-sidebar/80 p-3">
                <div className="text-[10px] font-mono text-muted-foreground mb-1.5 uppercase tracking-wider">
                  Resumen (Gemini)
                </div>
                <ul className="space-y-1">
                  {clBullets.map((b, i) => (
                    <li key={i} className="text-xs font-mono text-foreground/90">
                      • {b}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {clDiscordMsg.trim() && (
              <div className="space-y-2">
                <label className="text-xs font-mono text-muted-foreground block">
                  MENSAJE DISCORD (Gemini)
                </label>
                <Textarea
                  value={clDiscordMsg}
                  onChange={(e) => setClDiscordMsg(e.target.value)}
                  className="font-mono text-sm bg-sidebar border-border resize-none h-28"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="font-mono text-xs w-full"
                  onClick={() => void copyDiscordMessage()}
                >
                  COPIAR MENSAJE DISCORD
                </Button>
              </div>
            )}

            <Button
              className="w-full font-display tracking-widest text-sm"
              onClick={postChangelog}
              disabled={clLoading || !clVersion.trim() || !clTitle.trim() || !clDesc.trim()}
            >
              {clLoading
                ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                : <GitCommit className="h-4 w-4 mr-2" />
              }
              PUBLICAR CHANGELOG
            </Button>
          </div>

          {/* Changelog history */}
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground font-mono text-sm">Cargando...</div>
            ) : changelogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground font-mono text-sm">
                Sin entradas todavía
              </div>
            ) : (
              changelogs.map((cl) => {
                const cfg = TYPE_CONFIG[cl.type] ?? TYPE_CONFIG.feature;
                return (
                  <div key={cl.id} className="relative border border-border bg-sidebar p-4 group">
                    <span className="absolute top-0 left-0 w-3 h-3 border-t border-l border-primary" />
                    <span className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-primary" />

                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-display text-primary text-xs tracking-wider">{cl.version}</span>
                        <span className={`text-xs border px-1.5 py-0.5 font-mono ${cfg.color}`}>{cfg.label}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive/50 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                        onClick={() => deleteChangelog(cl.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>

                    <p className="text-sm font-medium text-foreground mb-1">{cl.title}</p>
                    <p className="text-xs text-muted-foreground font-mono leading-relaxed">{cl.description}</p>
                    <p className="text-xs text-muted-foreground/50 font-mono mt-2">
                      {format(new Date(cl.createdAt), "MMM d yyyy HH:mm")}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </DevCard>

      {/* System Info */}
      {status && (
        <DevCard icon={Shield} title="SYSTEM_INFO" glowColor="cyan">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "owner", value: user?.tag ?? "owner" },
              { label: "bot_name", value: status.botName ?? "—" },
              { label: "guilds_monitored", value: String(status.guildsCount) },
              { label: "websocket_ping", value: typeof status.ping === "number" && status.ping >= 0 ? `${status.ping}ms` : "—" },
              { label: "maintenance_mode", value: status.maintenanceMode ? "true" : "false" },
              { label: "bot_status", value: status.botOnline ? "online" : "offline" },
              {
                label: "api_uptime",
                value:
                  typeof status.systemUptime === "number"
                    ? `${Math.floor(status.systemUptime / 60)}m ${Math.floor(status.systemUptime % 60)}s`
                    : "—",
              },
            ].map(({ label, value }) => (
              <div key={label} className="border border-border bg-sidebar p-3">
                <p className="text-xs text-muted-foreground font-mono mb-1">{label}</p>
                <p className="text-sm font-mono text-foreground break-all">{value}</p>
              </div>
            ))}
          </div>
        </DevCard>
      )}
    </div>
  );
}

function DevCard({
  icon: Icon,
  title,
  glowColor,
  children,
}: {
  icon: React.ElementType;
  title: string;
  glowColor: "primary" | "cyan";
  children: React.ReactNode;
}) {
  const glow = glowColor === "primary"
    ? "border-primary/30"
    : "border-cyan-500/30";
  const titleColor = glowColor === "primary" ? "text-primary" : "text-cyan-400";

  return (
    <div className={`relative border ${glow} bg-card p-6`}>
      <span className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary" />
      <span className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary" />

      <div className={`flex items-center gap-2 font-display text-sm tracking-widest mb-5 ${titleColor}`}>
        <Icon className="h-4 w-4" />
        {title}
      </div>

      {children}
    </div>
  );
}
