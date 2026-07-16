import { useState } from "react";
import { Settings, Bell, Palette, Shield, Globe, Save, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

const STORAGE_KEY = "zt_dashboard_settings";

interface DashboardSettings {
  refreshInterval: number;
  notifyOnWarn: boolean;
  notifyOnMaintenance: boolean;
  compactMode: boolean;
  showGuildIds: boolean;
  language: string;
}

const DEFAULTS: DashboardSettings = {
  refreshInterval: 30,
  notifyOnWarn: true,
  notifyOnMaintenance: true,
  compactMode: false,
  showGuildIds: false,
  language: "es",
};

function loadSettings(): DashboardSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

function saveSettings(s: DashboardSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

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
          <p className="text-xs text-muted-foreground font-mono mt-0.5">{description}</p>
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
    <div className="relative border border-border bg-card p-5 sm:p-6">
      <span className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary" />
      <span className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary" />
      <div className="flex items-center gap-2 font-display text-sm tracking-widest text-primary mb-4">
        <Icon className="h-4 w-4" />
        {title}
      </div>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<DashboardSettings>(loadSettings);
  const [dirty, setDirty] = useState(false);

  const update = <K extends keyof DashboardSettings>(key: K, value: DashboardSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = () => {
    saveSettings(settings);
    setDirty(false);
    toast({ title: "Ajustes guardados", description: "Los cambios se aplicarán al recargar." });
  };

  const handleReset = () => {
    setSettings({ ...DEFAULTS });
    saveSettings({ ...DEFAULTS });
    setDirty(false);
    toast({ title: "Ajustes restablecidos", description: "Se han restaurado los valores predeterminados." });
  };

  return (
    <div className="space-y-6 sm:space-y-8 max-w-2xl">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-primary font-display flex items-center gap-2 glow-text">
            <Settings className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            SETTINGS
          </h1>
          <p className="text-muted-foreground mt-1 font-mono-custom text-sm">
            Preferencias del dashboard. Los cambios se guardan localmente.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 font-mono text-xs border-border text-muted-foreground hover:text-foreground"
            onClick={handleReset}
          >
            <RotateCcw className="h-3 w-3" />
            RESET
          </Button>
          <Button
            size="sm"
            className="gap-2 font-display tracking-widest text-xs"
            onClick={handleSave}
            disabled={!dirty}
          >
            <Save className="h-3 w-3" />
            GUARDAR
          </Button>
        </div>
      </div>

      {dirty && (
        <div className="flex items-center gap-2 border border-yellow-500/30 bg-yellow-500/10 px-4 py-2.5 text-yellow-400 text-xs font-mono">
          <span className="h-1.5 w-1.5 rounded-full bg-yellow-400 animate-pulse" />
          Tienes cambios sin guardar.
        </div>
      )}

      {/* Notifications */}
      <SectionCard icon={Bell} title="NOTIFICATIONS">
        <SettingRow
          label="Alertas de advertencias"
          description="Notifica cuando se emite una nueva advertencia"
        >
          <Switch
            checked={settings.notifyOnWarn}
            onCheckedChange={(v) => update("notifyOnWarn", v)}
          />
        </SettingRow>
        <SettingRow
          label="Alertas de mantenimiento"
          description="Notifica cuando el bot entra en modo mantenimiento"
        >
          <Switch
            checked={settings.notifyOnMaintenance}
            onCheckedChange={(v) => update("notifyOnMaintenance", v)}
          />
        </SettingRow>
      </SectionCard>

      {/* Display */}
      <SectionCard icon={Palette} title="DISPLAY">
        <SettingRow
          label="Modo compacto"
          description="Reduce el espaciado de las tarjetas y tablas"
        >
          <Switch
            checked={settings.compactMode}
            onCheckedChange={(v) => update("compactMode", v)}
          />
        </SettingRow>
        <SettingRow
          label="Mostrar IDs de servidor"
          description="Muestra el ID numérico junto al nombre del servidor"
        >
          <Switch
            checked={settings.showGuildIds}
            onCheckedChange={(v) => update("showGuildIds", v)}
          />
        </SettingRow>
      </SectionCard>

      {/* Data */}
      <SectionCard icon={Globe} title="DATA">
        <SettingRow
          label="Intervalo de refresco"
          description="Frecuencia de actualización automática (segundos)"
        >
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={10}
              max={300}
              value={settings.refreshInterval}
              onChange={(e) => update("refreshInterval", Number(e.target.value))}
              className="w-20 h-8 text-center font-mono text-sm bg-sidebar border-border"
            />
            <span className="text-xs text-muted-foreground font-mono">s</span>
          </div>
        </SettingRow>
      </SectionCard>

      {/* Session */}
      <SectionCard icon={Shield} title="SESSION">
        <SettingRow
          label="Token Dev guardado"
          description="El token DEV se almacena localmente en tu navegador"
        >
          <Button
            variant="outline"
            size="sm"
            className="font-mono text-xs border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => {
              localStorage.removeItem("zt_dev_token");
              toast({ title: "Token eliminado", description: "Deberás autenticarte de nuevo en el Dev Panel." });
            }}
          >
            LIMPIAR
          </Button>
        </SettingRow>
        <SettingRow
          label="Todos los ajustes locales"
          description="Elimina todos los datos guardados en este navegador"
        >
          <Button
            variant="outline"
            size="sm"
            className="font-mono text-xs border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => {
              localStorage.clear();
              setSettings({ ...DEFAULTS });
              setDirty(false);
              toast({ title: "Datos locales eliminados", description: "El dashboard ha sido restablecido." });
            }}
          >
            PURGAR
          </Button>
        </SettingRow>
      </SectionCard>

      {/* Build info */}
      <div className="text-xs font-mono text-muted-foreground/40 space-y-0.5">
        <p>ZeroTwo Dashboard · build {new Date().getFullYear()}</p>
        <p>Los ajustes se almacenan en localStorage y no se sincronizan con el servidor.</p>
      </div>
    </div>
  );
}
