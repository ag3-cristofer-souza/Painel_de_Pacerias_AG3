import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { alertsApi, type AlertSettings } from "@/api/partners";
import { usePanel } from "@/features/auth/AuthProvider";
import { Button } from "@/ui/button";
import { ErrorText } from "@/ui/feedback";
import { Field } from "@/ui/field";
import { PageHeader } from "@/ui/page";

interface Draft {
  limits: Record<string, string>;
  disabled: Set<string>;
}

const toDraft = (s: AlertSettings): Draft => ({
  limits: Object.fromEntries(s.limits.map((l) => [l.key, String(l.value)])),
  disabled: new Set(s.kinds.filter((k) => !k.enabled).map((k) => k.kind)),
});

/** Limites dos alertas para todos os clientes do parceiro (6c). Quem não é dono ou admin só vê. */
export function ConfigurarAlertasPage() {
  const panel = usePanel();
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["alert-settings"], queryFn: alertsApi.settings });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (query.data && draft === null) setDraft(toDraft(query.data));
  }, [query.data, draft]);

  const mutation = useMutation({
    mutationFn: (d: Draft) =>
      alertsApi.saveSettings({
        limits: Object.fromEntries(Object.entries(d.limits).map(([k, v]) => [k, Number(v)])),
        disabled: [...d.disabled].sort(),
      }),
    onSuccess: (data) => {
      client.setQueryData(["alert-settings"], data);
      setDraft(toDraft(data));
      setSaved(true);
    },
  });

  if (query.isPending || draft === null) {
    if (query.isError) return <ErrorText>{query.error.message}</ErrorText>;
    return (
      <div className="surface flex justify-center p-10" role="status">
        <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
        <span className="sr-only">Carregando limites</span>
      </div>
    );
  }

  const settings = query.data as AlertSettings;
  const editable = settings.editable;
  const enabled = (kind: string) => !draft.disabled.has(kind);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSaved(false);
    mutation.mutate(draft);
  };

  const setLimit = (key: string, value: string) => {
    setSaved(false);
    setDraft((d) => (d ? { ...d, limits: { ...d.limits, [key]: value } } : d));
  };

  const toggle = (kind: string) => {
    setSaved(false);
    setDraft((d) => {
      if (!d) return d;
      const disabled = new Set(d.disabled);
      if (disabled.has(kind)) disabled.delete(kind);
      else disabled.add(kind);
      return { ...d, disabled };
    });
  };

  return (
    <>
      <Link
        to="/alertas"
        className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Alertas
      </Link>
      <PageHeader title="Configurar alertas">
        {panel.kind === "ag3"
          ? "Os clientes diretos usam estes limites padrão. Cada parceiro ajusta os dele no próprio painel."
          : editable
            ? "Valem para todos os seus clientes. A mudança vale na próxima verificação, em até 10 minutos; o alerta que deixar de passar do limite some sozinho."
            : "Valem para todos os clientes do parceiro. Só o dono ou um administrador muda."}
      </PageHeader>

      <form onSubmit={submit} className="space-y-6">
        <section className="surface space-y-4 p-5" aria-labelledby="limites-titulo">
          <h2 id="limites-titulo" className="text-base font-semibold">
            Limites
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {settings.limits.map((l) => (
              <div key={l.key} className="space-y-1">
                <Field
                  label={`${l.label} (${l.unit})`}
                  type="number"
                  inputMode="numeric"
                  min={l.min}
                  max={l.max}
                  step={1}
                  required
                  disabled={!editable || !enabled(l.kind)}
                  value={draft.limits[l.key] ?? ""}
                  onChange={(e) => setLimit(l.key, e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {l.kind_label} · de {l.min} a {l.max} · padrão {l.default}
                </p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Falhas da IA e de envio contam as últimas 24 horas, a partir de 20 execuções ou
            mensagens.
          </p>
        </section>

        <section className="surface space-y-3 p-5" aria-labelledby="tipos-titulo">
          <h2 id="tipos-titulo" className="text-base font-semibold">
            Tipos de alerta
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {settings.kinds.map((k) => (
              <li key={k.kind}>
                <label className="flex min-h-11 items-center gap-3 rounded-xl border border-input px-3.5 text-sm">
                  <input
                    type="checkbox"
                    className="size-5 accent-primary"
                    checked={enabled(k.kind)}
                    disabled={!editable || !k.can_disable}
                    onChange={() => toggle(k.kind)}
                  />
                  <span className="flex-1">{k.label}</span>
                  {!k.can_disable && (
                    <span className="text-xs text-muted-foreground">sempre ligado</span>
                  )}
                </label>
              </li>
            ))}
          </ul>
        </section>

        {mutation.isError && <ErrorText>{mutation.error.message}</ErrorText>}
        {saved && (
          <p className="flex items-center gap-2 text-sm text-emerald-700" role="status">
            <CheckCircle2 className="size-4" aria-hidden="true" />
            Limites salvos. Valem na próxima verificação.
          </p>
        )}
        {editable && (
          <Button type="submit" loading={mutation.isPending}>
            Salvar limites
          </Button>
        )}
      </form>
    </>
  );
}
