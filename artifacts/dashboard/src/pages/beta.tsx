/**
 * Pestaña Beta — panel del programa de testers.
 */
import { useState } from "react";
import {
  FlaskConical,
  Sparkles,
  Bug,
  Lightbulb,
  MessageSquare,
  Shield,
  Lock,
  Loader2,
  CheckCircle2,
  Users,
  Plus,
  Trash2,
  RefreshCw,
  Crown,
} from "lucide-react";
import { PageHeader } from "@/components/dash/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  useBetaTesterStatus,
  useBetaFeatures,
  useBetaManageList,
  useBetaFeedbackList,
  submitBetaFeedback,
  manageBetaTester,
  useInvalidateBeta,
} from "@/lib/useBetaTester";

type TabId = "info" | "features" | "feedback" | "manage";

const TABS: { id: TabId; label: string; icon: React.ElementType; ownerOnly?: boolean }[] = [
  { id: "info", label: "Info", icon: Sparkles },
  { id: "features", label: "Features", icon: FlaskConical },
  { id: "feedback", label: "Feedback", icon: MessageSquare },
  { id: "manage", label: "Gestionar", icon: Users, ownerOnly: true },
];

export default function BetaPage() {
  const { isOwner } = useAuth();
  const { toast } = useToast();
  const invalidate = useInvalidateBeta();
  const { data: status, isLoading: statusLoading, isError } = useBetaTesterStatus();
  const { data: featuresData, isLoading: featuresLoading } = useBetaFeatures();
  const [tab, setTab] = useState<TabId>("info");

  const isBeta = Boolean(status?.isBetaTester);
  const showManage = isOwner || Boolean(status?.isOwner);

  const tabs = TABS.filter((t) => !t.ownerOnly || showManage);

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center py-24 gap-3 text-slate-400 font-mono text-sm">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
        Cargando laboratorio beta…
      </div>
    );
  }

  if (isError || !status) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center space-y-3">
        <Lock className="w-10 h-10 text-primary mx-auto opacity-80" />
        <p className="text-slate-300 font-mono text-sm">
          No se pudo cargar el estado beta. ¿Sesión activa?
        </p>
        <Button variant="outline" size="sm" onClick={() => invalidate()}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 max-w-4xl">
      <PageHeader
        icon={FlaskConical}
        title="Beta Lab"
        description="Features experimentales, feedback y acceso de testers · Zero Two"
        actions={
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-full border",
                isBeta
                  ? "text-[#00f5d4] border-[#00f5d4]/30 bg-[#00f5d4]/10"
                  : "text-slate-400 border-white/10 bg-white/5",
              )}
            >
              {isBeta ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  ACCESO BETA
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  SIN ACCESO
                </>
              )}
            </span>
            {status.isOwner && (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2.5 py-1 rounded-full border text-[#f5c518] border-[#f5c518]/30 bg-[#f5c518]/10">
                <Crown className="w-3.5 h-3.5" />
                OWNER
              </span>
            )}
          </div>
        }
      />

      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-[#ff2d6b]/10 via-[#0a0f1a] to-[#9d4edd]/10 p-5 sm:p-6">
        <div className="relative z-10 space-y-2">
          <p className="text-xs font-mono tracking-widest text-primary uppercase">
            Programa de beta testers
          </p>
          <h2 className="text-lg sm:text-xl font-semibold text-white">
            {isBeta
              ? "Bienvenida al laboratorio, Darling 🧪"
              : "Aún no estás en la lista beta"}
          </h2>
          <p className="text-sm text-slate-400 max-w-xl font-mono">
            {isBeta
              ? "Prueba features nuevas, reporta bugs y ayuda a pulir Zero Two antes del release público."
              : "Pídele a la dev que te añada con /beta manage o desde esta pestaña (owners). Mientras, puedes leer el programa."}
          </p>
          <div className="flex flex-wrap gap-3 pt-2 text-[11px] font-mono text-slate-500">
            <span>v{status.version}</span>
            <span>·</span>
            <span>{status.testerCount} tester(s)</span>
            <span>·</span>
            <span>{status.features.betaFeaturesEnabled.length} features on</span>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-white/[0.06] pb-px">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-2 text-xs font-mono rounded-t-lg transition-colors",
                active
                  ? "text-primary bg-primary/10 border border-b-0 border-primary/25"
                  : "text-slate-500 hover:text-slate-200 hover:bg-white/5",
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "info" && <InfoTab isBeta={isBeta} status={status} />}
      {tab === "features" && (
        <FeaturesTab
          isBeta={isBeta}
          loading={featuresLoading}
          features={featuresData?.features ?? status.featureList}
        />
      )}
      {tab === "feedback" && (
        <FeedbackTab
          isBeta={isBeta}
          isOwner={showManage}
          toast={toast}
          onSubmitted={() => invalidate()}
        />
      )}
      {tab === "manage" && showManage && (
        <ManageTab toast={toast} onChanged={() => invalidate()} />
      )}
    </div>
  );
}

function InfoTab({
  isBeta,
  status,
}: {
  isBeta: boolean;
  status: NonNullable<ReturnType<typeof useBetaTesterStatus>["data"]>;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card title="Beneficios" icon={Sparkles}>
        <ul className="space-y-2 text-sm text-slate-300 font-mono">
          <li className="flex gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            Acceso durante mantenimiento del bot
          </li>
          <li className="flex gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            Sin cooldowns de comandos
          </li>
          <li className="flex gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            Features experimentales y /beta
          </li>
          <li className="flex gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            Canal de feedback prioritario
          </li>
        </ul>
      </Card>

      <Card title="Tu estado" icon={Shield}>
        <div className="space-y-3 text-sm font-mono">
          <Row
            label="Acceso beta"
            value={isBeta ? "Activo ✅" : "No · solicita a la dev"}
          />
          <Row label="Discord ID" value={status.userId} mono />
          <Row
            label="Comandos útiles"
            value="/beta info · /beta features · /presence"
          />
        </div>
      </Card>

      <Card title="Cómo unirse" icon={Users} className="sm:col-span-2">
        <p className="text-sm text-slate-400 font-mono leading-relaxed">
          La dueña del bot te añade con{" "}
          <code className="text-primary">/beta manage action:Añadir</code> o desde
          la pestaña <strong className="text-slate-200">Gestionar</strong> de este
          panel. También puede poner tu ID en{" "}
          <code className="text-primary">BETA_TESTER_IDS</code> del{" "}
          <code className="text-slate-300">.env</code>.
        </p>
      </Card>
    </div>
  );
}

function FeaturesTab({
  isBeta,
  loading,
  features,
}: {
  isBeta: boolean;
  loading: boolean;
  features: Array<{
    id: string;
    name: string;
    description: string;
    enabled: boolean;
    locked?: boolean;
  }>;
}) {
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!isBeta && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-xs font-mono text-amber-200/90">
          Ves el catálogo en modo lectura. Activa el acceso beta para el detalle
          completo y las features desbloqueadas.
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {features.map((f) => (
          <div
            key={f.id}
            className={cn(
              "rounded-xl border p-4 transition-colors",
              f.locked || !isBeta
                ? "border-white/[0.06] bg-white/[0.02] opacity-80"
                : "border-primary/20 bg-primary/5",
            )}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="text-sm font-semibold text-white">{f.name}</h3>
              {f.enabled ? (
                <span className="text-[10px] font-mono text-[#00f5d4] border border-[#00f5d4]/25 rounded px-1.5 py-0.5">
                  ON
                </span>
              ) : (
                <span className="text-[10px] font-mono text-slate-500 border border-white/10 rounded px-1.5 py-0.5">
                  SOON
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 font-mono leading-relaxed">
              {f.description}
            </p>
            <p className="text-[10px] text-slate-600 font-mono mt-2">id: {f.id}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function FeedbackTab({
  isBeta,
  isOwner,
  toast,
  onSubmitted,
}: {
  isBeta: boolean;
  isOwner: boolean;
  toast: ReturnType<typeof useToast>["toast"];
  onSubmitted: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"bug" | "feature" | "suggestion" | "general">(
    "bug",
  );
  const [submitting, setSubmitting] = useState(false);
  const { data: inbox, refetch } = useBetaFeedbackList(isOwner);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isBeta) return;
    setSubmitting(true);
    try {
      await submitBetaFeedback(title, description, type);
      toast({ title: "Feedback enviado", description: "Gracias, Darling 💜" });
      setTitle("");
      setDescription("");
      onSubmitted();
      void refetch();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "No se pudo enviar",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isBeta) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-[#0a0f1a]/90 p-8 text-center space-y-3">
        <Lock className="w-8 h-8 text-slate-500 mx-auto" />
        <p className="text-sm text-slate-400 font-mono">
          El formulario de feedback es exclusivo de beta testers.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <form
        onSubmit={onSubmit}
        className="lg:col-span-3 space-y-4 rounded-2xl border border-white/[0.06] bg-[#0a0f1a]/90 p-5"
      >
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: "bug", label: "Bug", icon: Bug },
              { id: "feature", label: "Feature", icon: Sparkles },
              { id: "suggestion", label: "Idea", icon: Lightbulb },
              { id: "general", label: "General", icon: MessageSquare },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setType(t.id)}
              className={cn(
                "inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1.5 rounded-lg border transition-colors",
                type === t.id
                  ? "border-primary/40 bg-primary/15 text-primary"
                  : "border-white/10 text-slate-500 hover:text-slate-200",
              )}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-mono text-slate-500">Título</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej. /play se queda en buffering"
            maxLength={120}
            required
            className="font-mono text-sm bg-black/30"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-mono text-slate-500">
            Descripción
          </label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Pasos, resultado esperado vs obtenido, guild, hora…"
            maxLength={4000}
            required
            rows={6}
            className="font-mono text-sm bg-black/30 resize-y min-h-[120px]"
          />
        </div>

        <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <MessageSquare className="w-4 h-4 mr-2" />
          )}
          Enviar feedback
        </Button>
      </form>

      {isOwner && (
        <div className="lg:col-span-2 space-y-3">
          <h3 className="text-xs font-mono tracking-widest text-primary uppercase">
            Inbox owner ({inbox?.count ?? 0})
          </h3>
          <div className="space-y-2 max-h-[420px] overflow-y-auto sakura-scrollbar pr-1">
            {(inbox?.items ?? []).length === 0 && (
              <p className="text-xs text-slate-600 font-mono py-6 text-center">
                Sin feedback todavía
              </p>
            )}
            {(inbox?.items ?? []).map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono text-primary uppercase">
                    {item.type}
                  </span>
                  <span className="text-[10px] font-mono text-slate-600">
                    {new Date(item.submittedAt).toLocaleString("es-ES", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                </div>
                <p className="text-sm text-slate-200 font-medium">{item.title}</p>
                <p className="text-xs text-slate-500 font-mono line-clamp-3">
                  {item.description}
                </p>
                <p className="text-[10px] text-slate-600 font-mono">
                  {item.username ? `@${item.username}` : item.userId}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ManageTab({
  toast,
  onChanged,
}: {
  toast: ReturnType<typeof useToast>["toast"];
  onChanged: () => void;
}) {
  const { data, isLoading, refetch } = useBetaManageList(true);
  const [userId, setUserId] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (action: "add" | "remove", idOverride?: string) => {
    const id = (idOverride ?? userId).trim();
    if (!/^\d{5,25}$/.test(id)) {
      toast({
        title: "ID inválido",
        description: "Pega un Discord snowflake numérico",
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    try {
      await manageBetaTester(action, id);
      toast({
        title: action === "add" ? "Añadido" : "Eliminado",
        description: `Usuario ${id}`,
      });
      setUserId("");
      void refetch();
      onChanged();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Falló la operación",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-white/[0.06] bg-[#0a0f1a]/90 p-5 space-y-4">
        <p className="text-xs text-slate-500 font-mono">
          Añade o quita beta testers. Se guarda en{" "}
          <code className="text-primary">data/beta-testers.json</code> (y se une a{" "}
          <code className="text-primary">BETA_TESTER_IDS</code>).
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="Discord User ID"
            className="font-mono text-sm bg-black/30 flex-1"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              disabled={busy}
              onClick={() => void run("add")}
              size="sm"
            >
              <Plus className="w-4 h-4 mr-1" />
              Añadir
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void run("remove")}
              size="sm"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Quitar
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.06] bg-[#0a0f1a]/90 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-mono tracking-widest text-primary uppercase">
            Lista ({data?.count ?? 0})
          </h3>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void refetch()}
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
        {isLoading && (
          <Loader2 className="w-5 h-5 animate-spin text-primary mx-auto my-6" />
        )}
        <ul className="space-y-1.5 font-mono text-xs">
          {(data?.betatesters ?? []).map((id) => (
            <li
              key={id}
              className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.04] px-3 py-2 text-slate-300"
            >
              <span className="truncate">{id}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-slate-500 hover:text-red-400"
                disabled={busy}
                onClick={() => void run("remove", id)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </li>
          ))}
          {!isLoading && (data?.betatesters?.length ?? 0) === 0 && (
            <li className="text-slate-600 text-center py-6">Lista vacía</li>
          )}
        </ul>
      </div>
    </div>
  );
}

function Card({
  title,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/[0.06] bg-[#0a0f1a]/90 p-5",
        className,
      )}
    >
      <div className="flex items-center gap-2 text-primary font-mono text-xs tracking-widest uppercase mb-4">
        <Icon className="w-4 h-4" />
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-white/[0.04] pb-2 last:border-0">
      <span className="text-[10px] text-slate-600 uppercase tracking-wider">
        {label}
      </span>
      <span className={cn("text-slate-200 break-all", mono && "text-[11px]")}>
        {value}
      </span>
    </div>
  );
}
