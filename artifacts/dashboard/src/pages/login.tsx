import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Loader2, Radio, Shield } from "lucide-react";

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

const ERRORS: Record<string, string> = {
  missing_code: "Discord no devolvió un código de autorización.",
  invalid_state:
    "Sesión OAuth inválida o cookie bloqueada. Prueba otra vez (o desactiva bloqueo de cookies de terceros).",
  token_exchange:
    "Discord rechazó el intercambio de token (revisa Redirect URI en el Developer Portal y CLIENT_SECRET).",
  user_fetch: "No se pudo obtener tu perfil de Discord.",
  not_allowed:
    "Tu cuenta no está en la lista de acceso (DASHBOARD_ALLOWED_IDS). Pide al owner que te añada o vacíe la lista.",
  discord: "Discord canceló o rechazó la autorización.",
  server: "Error interno del servidor durante el login.",
};

export default function LoginPage() {
  const { user, loading, oauthConfigured, login, botPreview } = useAuth();
  const [, setLocation] = useLocation();
  const [redirecting, setRedirecting] = useState(false);

  const params =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : null;
  const errorKey = params?.get("error") ?? "";
  const errorDetail = params?.get("detail") ?? "";
  const errorMsg = errorKey
    ? `${ERRORS[errorKey] ?? "Error de autenticación."}${
        errorDetail ? ` (${errorDetail})` : ""
      }`
    : "";

  useEffect(() => {
    if (!loading && user) setLocation("/");
  }, [loading, user, setLocation]);

  const handleLogin = () => {
    setRedirecting(true);
    login();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-[#050810]">
        <Loader2 className="w-8 h-8 text-[#ff2d6b] animate-spin" />
        <p className="text-[10px] font-mono text-slate-500 tracking-widest">
          CARGANDO SISTEMA…
        </p>
      </div>
    );
  }

  const botName = botPreview?.botName ?? "Zero Two";
  const botAvatar = botPreview?.botAvatar;
  const botOnline = botPreview?.online ?? false;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050810] relative overflow-hidden px-4">
      <div className="cp-vignette" aria-hidden />
      <div className="cp-scanlines" aria-hidden />
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% 20%, rgba(255,45,107,0.12), transparent 60%)",
        }}
        aria-hidden
      />

      <div className="relative z-10 w-full max-w-md">
        <div className="relative border border-[#ff2d6b]/30 bg-[#0a0f1a]/95 p-8 sm:p-10 shadow-[0_0_48px_rgba(255,45,107,0.14)] backdrop-blur-sm">
          <span className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-[#ff2d6b]" />
          <span className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-[#ff2d6b]" />
          <span className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-[#ff2d6b]" />
          <span className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-[#ff2d6b]" />

          <div className="text-center mb-8">
            {/* Bot avatar */}
            <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-[#ff2d6b] to-[#00f5d4] p-[2px] mb-4 shadow-[0_0_28px_rgba(255,45,107,0.4)] relative">
              <div className="w-full h-full rounded-full bg-[#050810] overflow-hidden flex items-center justify-center">
                {botAvatar ? (
                  <img
                    src={botAvatar}
                    alt={botName}
                    className="w-full h-full object-cover"
                    draggable={false}
                  />
                ) : (
                  <Shield className="w-8 h-8 text-[#ff2d6b]" />
                )}
              </div>
              <span
                className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#0a0f1a] ${
                  botOnline
                    ? "bg-[#00f5d4] shadow-[0_0_10px_#00f5d4]"
                    : "bg-zinc-500"
                }`}
              />
            </div>

            <h1 className="text-2xl font-display tracking-widest text-[#ff2d6b] glow-text">
              {botName.toUpperCase()}
            </h1>
            <p className="text-slate-400 text-sm mt-2 font-mono">
              Dashboard de control · acceso seguro
            </p>

            {/* Live bot status chip */}
            <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-black/40 text-[10px] font-mono">
              <Radio
                className={`w-3 h-3 ${botOnline ? "text-[#00f5d4]" : "text-slate-500"}`}
              />
              <span className={botOnline ? "text-[#00f5d4]" : "text-slate-500"}>
                {botOnline
                  ? `Online · ${botPreview?.guildCount ?? 0} servidores`
                  : "Bot offline"}
              </span>
              {botOnline && typeof botPreview?.ping === "number" && botPreview.ping >= 0 && (
                <span className="text-slate-600">· {botPreview.ping}ms</span>
              )}
            </div>
          </div>

          {errorMsg && (
            <div className="mb-4 border border-red-500/30 bg-red-500/10 text-red-300 text-xs font-mono p-3">
              {errorMsg}
            </div>
          )}

          {!oauthConfigured ? (
            <div className="border border-yellow-500/30 bg-yellow-500/10 text-yellow-200 text-xs font-mono p-4 space-y-2">
              <p className="font-bold">OAuth no configurado</p>
              <p>
                Falta <code className="text-[#00f5d4]">CLIENT_SECRET</code> en el
                entorno del servidor.
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleLogin}
              disabled={redirecting}
              className="w-full flex items-center justify-center gap-3 py-3.5 px-4 font-display tracking-widest text-sm
                bg-[#5865F2] hover:bg-[#4752C4] disabled:opacity-70 disabled:cursor-wait text-white transition-colors
                shadow-[0_0_24px_rgba(88,101,242,0.35)]"
            >
              {redirecting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  REDIRIGIENDO A DISCORD…
                </>
              ) : (
                <>
                  <DiscordIcon className="w-5 h-5" />
                  CONTINUAR CON DISCORD
                </>
              )}
            </button>
          )}

          <p className="text-[10px] text-slate-600 font-mono text-center mt-6 leading-relaxed">
            Scopes: identidad + lista de servidores (para configurar los tuyos).
            <br />
            <span className="text-slate-500">
              Cualquier cuenta de Discord puede iniciar sesión.
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
