import {
  Settings,
  Bell,
  Palette,
  Globe,
  Save,
  RotateCcw,
  Shield,
  Check,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/dash/page-header";
import {
  THEMES,
  useThemeSettings,
  type ThemeId,
} from "@/lib/theme";
import { cn } from "@/lib/utils";

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-border/50 last:border-0">
      <div className="min-w-0">
        <p className="text-sm text-foreground font-mono">{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground font-mono mt-0.5">
            {description}
          </p>
        )}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative rounded-2xl border border-border bg-card p-5 sm:p-6">
      <span className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary rounded-tl-2xl" />
      <span className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary rounded-br-2xl" />
      <div className="flex items-center gap-2 font-display text-sm tracking-widest text-primary mb-4">
        <Icon className="h-4 w-4" />
        {title}
      </div>
      {children}
    </div>
  );
}

function ThemePicker({
  value,
  onChange,
}: {
  value: ThemeId;
  onChange: (id: ThemeId) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {THEMES.map((t) => {
        const active = value === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={cn(
              "relative text-left rounded-2xl border p-3.5 transition-all duration-200 group",
              active
                ? "border-primary bg-primary/10 shadow-[0_0_24px_hsl(var(--primary)/0.15)]"
                : "border-border bg-black/20 hover:border-primary/40 hover:bg-black/30",
            )}
          >
            {active && (
              <span className="absolute top-2.5 right-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="h-3 w-3" />
              </span>
            )}
            <div className="flex items-center gap-2 mb-2.5">
              {t.swatches.map((c, i) => (
                <span
                  key={i}
                  className="h-6 w-6 rounded-full border border-white/10 shadow-inner"
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              {t.id === "cyberpunk" && (
                <Sparkles className="h-3.5 w-3.5 text-primary" />
              )}
              {t.name}
            </p>
            <p className="text-[11px] text-muted-foreground font-mono mt-1 leading-snug">
              {t.description}
            </p>
          </button>
        );
      })}
    </div>
  );
}

export default function SettingsPage() {
  const { toast } = useToast();
  const { settings, setTheme, updateSettings, save, reset, dirty } =
    useThemeSettings();

  const handleSave = () => {
    save();
    toast({
      title: "Ajustes guardados",
      description: `Tema «${THEMES.find((t) => t.id === settings.theme)?.name ?? settings.theme}» activo.`,
    });
  };

  const handleReset = () => {
    reset();
    toast({
      title: "Ajustes restablecidos",
      description: "Tema Cyberpunk y valores por defecto.",
    });
  };

  return (
    <div className="space-y-6 sm:space-y-8 max-w-2xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          icon={Settings}
          title="Ajustes del dashboard"
          description="Temas visuales y preferencias. La cuenta Discord está en «Mi cuenta»."
        />
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 font-mono text-xs border-border text-muted-foreground hover:text-foreground rounded-xl"
            onClick={handleReset}
          >
            <RotateCcw className="h-3 w-3" />
            RESET
          </Button>
          <Button
            size="sm"
            className="gap-2 font-display tracking-widest text-xs rounded-xl"
            onClick={handleSave}
            disabled={!dirty}
          >
            <Save className="h-3 w-3" />
            GUARDAR
          </Button>
        </div>
      </div>

      {dirty && (
        <div className="flex items-center gap-2 border border-yellow-500/30 bg-yellow-500/10 px-4 py-2.5 text-yellow-400 text-xs font-mono rounded-xl">
          <span className="h-1.5 w-1.5 rounded-full bg-yellow-400 animate-pulse" />
          Cambios sin guardar — el tema ya se previsualiza en vivo.
        </div>
      )}

      {/* Theme */}
      <SectionCard icon={Palette} title="TEMA VISUAL">
        <p className="text-xs text-muted-foreground font-mono mb-4">
          Elige un pack de colores. Se aplica al instante; pulsa Guardar para
          recordarlo.
        </p>
        <ThemePicker value={settings.theme} onChange={setTheme} />
      </SectionCard>

      {/* Display */}
      <SectionCard icon={Sparkles} title="INTERFAZ">
        <SettingRow
          label="Modo compacto"
          description="Menos padding en tarjetas y paneles"
        >
          <Switch
            checked={settings.compactMode}
            onCheckedChange={(v) => updateSettings({ compactMode: v })}
          />
        </SettingRow>
        <SettingRow
          label="Mostrar IDs de servidor"
          description="Muestra el snowflake junto al nombre"
        >
          <Switch
            checked={settings.showGuildIds}
            onCheckedChange={(v) => updateSettings({ showGuildIds: v })}
          />
        </SettingRow>
        <SettingRow
          label="Reducir movimiento"
          description="Desactiva animaciones decorativas"
        >
          <Switch
            checked={settings.reducedMotion}
            onCheckedChange={(v) => updateSettings({ reducedMotion: v })}
          />
        </SettingRow>
      </SectionCard>

      {/* Notifications */}
      <SectionCard icon={Bell} title="NOTIFICACIONES">
        <SettingRow
          label="Alertas de advertencias"
          description="Cuando se emite un warn (futuro / toast local)"
        >
          <Switch
            checked={settings.notifyOnWarn}
            onCheckedChange={(v) => updateSettings({ notifyOnWarn: v })}
          />
        </SettingRow>
        <SettingRow
          label="Alertas de mantenimiento"
          description="Cuando el bot entra en mantenimiento"
        >
          <Switch
            checked={settings.notifyOnMaintenance}
            onCheckedChange={(v) => updateSettings({ notifyOnMaintenance: v })}
          />
        </SettingRow>
      </SectionCard>

      {/* Data */}
      <SectionCard icon={Globe} title="DATOS">
        <SettingRow
          label="Intervalo de refresco"
          description="Actualización automática de stats (segundos)"
        >
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={10}
              max={300}
              value={settings.refreshInterval}
              onChange={(e) =>
                updateSettings({
                  refreshInterval: Math.min(
                    300,
                    Math.max(10, Number(e.target.value) || 30),
                  ),
                })
              }
              className="w-20 h-8 text-center font-mono text-sm bg-sidebar border-border rounded-lg"
            />
            <span className="text-xs text-muted-foreground font-mono">s</span>
          </div>
        </SettingRow>
        <SettingRow
          label="Idioma de la UI"
          description="Textos del dashboard (parcial)"
        >
          <select
            value={settings.language}
            onChange={(e) => updateSettings({ language: e.target.value })}
            className="h-8 rounded-lg border border-border bg-sidebar px-2 text-xs font-mono text-foreground"
          >
            <option value="es">Español</option>
            <option value="en">English</option>
          </select>
        </SettingRow>
      </SectionCard>

      {/* Session local */}
      <SectionCard icon={Shield} title="DATOS LOCALES">
        <SettingRow
          label="Token Dev guardado"
          description="Limpia el DEV_TOKEN del navegador"
        >
          <Button
            variant="outline"
            size="sm"
            className="font-mono text-xs border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive rounded-lg"
            onClick={() => {
              localStorage.removeItem("zt_dev_token");
              toast({
                title: "Token eliminado",
                description: "Vuelve a autenticarte en el Dev Panel.",
              });
            }}
          >
            LIMPIAR
          </Button>
        </SettingRow>
        <SettingRow
          label="Restablecer todo"
          description="Tema, preferencias y tokens locales"
        >
          <Button
            variant="outline"
            size="sm"
            className="font-mono text-xs border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive rounded-lg"
            onClick={() => {
              localStorage.removeItem("zt_dev_token");
              handleReset();
            }}
          >
            PURGAR
          </Button>
        </SettingRow>
      </SectionCard>

      <div className="text-xs font-mono text-muted-foreground/50 space-y-0.5">
        <p>ZeroTwo Dashboard · temas locales (localStorage)</p>
        <p>
          Tema activo:{" "}
          <span className="text-primary">
            {THEMES.find((t) => t.id === settings.theme)?.name}
          </span>
        </p>
      </div>
    </div>
  );
}
