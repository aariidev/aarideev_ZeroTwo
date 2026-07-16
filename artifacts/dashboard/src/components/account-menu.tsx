import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { Crown, LogOut, Settings, Shield, User } from "lucide-react";

function formatExpires(ms: number): string {
  if (ms <= 0) return "expirada";
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  if (d > 0) return `${d}d ${h}h`;
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  return `${Math.max(1, m)}m`;
}

export function AccountMenu() {
  const { user, session, logout, isOwner } = useAuth();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, ready: false });

  const updatePos = () => {
    const btn = btnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const menuW = 240;
    const menuH = menuRef.current?.offsetHeight ?? 220;
    const pad = 8;

    // Prefer open to the right of the avatar; clamp to viewport
    let left = r.right + 10;
    let top = r.bottom - menuH;

    if (left + menuW > window.innerWidth - pad) {
      left = Math.max(pad, r.left - menuW - 10);
    }
    if (top < pad) top = pad;
    if (top + menuH > window.innerHeight - pad) {
      top = Math.max(pad, window.innerHeight - menuH - pad);
    }

    setPos({ top, left, ready: true });
  };

  useLayoutEffect(() => {
    if (!open) {
      setPos((p) => ({ ...p, ready: false }));
      return;
    }
    updatePos();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onReposition = () => updatePos();

    // delay doc listener so the opening click doesn't close immediately
    const tid = window.setTimeout(() => {
      document.addEventListener("mousedown", onDoc);
    }, 0);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);

    return () => {
      window.clearTimeout(tid);
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open]);

  if (!user) return null;

  const display = user.globalName || user.username;
  const roleLabel = isOwner ? "Owner" : user.role === "admin" ? "Admin" : "Viewer";

  const menu = open
    ? createPortal(
        <div
          ref={menuRef}
          role="menu"
          className="fixed z-[200] w-60 border border-[#ff2d6b]/30 bg-[#0a0f1a] shadow-[0_12px_48px_rgba(0,0,0,0.65),0_0_24px_rgba(255,45,107,0.12)] p-3 rounded-xl"
          style={{
            top: pos.top,
            left: pos.left,
            opacity: pos.ready ? 1 : 0,
            pointerEvents: pos.ready ? "auto" : "none",
          }}
        >
          <div className="flex items-center gap-2.5 mb-3 pb-3 border-b border-white/10">
            <div className="w-10 h-10 rounded-full overflow-hidden border border-white/10 flex-shrink-0 bg-black/40">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User className="w-4 h-4 text-slate-400" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{display}</p>
              <p className="text-[10px] font-mono text-slate-500 truncate">
                @{user.username}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono mb-3">
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border ${
                isOwner
                  ? "text-[#f5c518] border-[#f5c518]/30 bg-[#f5c518]/10"
                  : "text-[#00f5d4] border-[#00f5d4]/25 bg-[#00f5d4]/10"
              }`}
            >
              {isOwner ? (
                <Crown className="w-2.5 h-2.5" />
              ) : (
                <Shield className="w-2.5 h-2.5" />
              )}
              {roleLabel}
            </span>
            {session && (
              <span className="text-slate-500">
                {formatExpires(session.expiresInMs)}
              </span>
            )}
          </div>

          <div className="space-y-0.5">
            <Link
              href="/account"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-2.5 py-2 text-xs font-mono text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              <User className="w-3.5 h-3.5 text-slate-500" />
              Mi cuenta
            </Link>
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-2.5 py-2 text-xs font-mono text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              <Settings className="w-3.5 h-3.5 text-slate-500" />
              Ajustes del dashboard
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                void logout();
              }}
              className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-mono text-red-300/90 hover:text-red-200 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Cerrar sesión
            </button>
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={`relative flex items-center justify-center w-10 h-10 rounded-full border overflow-hidden bg-black/40 transition-colors ${
          open
            ? "border-[#ff2d6b]/60 ring-2 ring-[#ff2d6b]/20"
            : "border-white/10 hover:border-[#ff2d6b]/40"
        }`}
        title={display}
      >
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.tag}
            className="w-full h-full object-cover"
            draggable={false}
          />
        ) : (
          <span className="text-[10px] font-mono text-slate-300">
            {user.username.slice(0, 2).toUpperCase()}
          </span>
        )}
        {isOwner && (
          <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#f5c518] border border-[#03050a] flex items-center justify-center pointer-events-none">
            <Crown className="w-2 h-2 text-black" />
          </span>
        )}
      </button>
      {menu}
    </>
  );
}
