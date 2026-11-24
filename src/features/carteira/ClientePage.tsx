import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Layers, Loader2, LogIn, PauseCircle, PlayCircle } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError } from "@/api/client";
import { partnersApi, type CompanyDetail } from "@/api/partners";
import { usePanel } from "@/features/auth/AuthProvider";
import { AlertList } from "@/features/alertas/AlertList";
import { BillingPanel } from "@/features/mensalidade/BillingPanel";
import { formatCost, formatDate, formatInt, formatMinutes, formatMonth } from "@/lib/format";
import {
  COMPANY_ROLE_LABELS,
  SUSPENSION_EFFECTS,
  USER_STATUS,
  label,
  planStatus,
} from "@/lib/labels";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { ErrorText } from "@/ui/feedback";
import { TextArea } from "@/ui/field";

function Section({
  title,
  children,
  aside,
}: {
  title: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="surface p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">{title}</h2>
        {aside && <span className="text-xs text-muted-foreground">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

function Stat({ label: name, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-muted/60 p-3">
      <dt className="text-xs text-muted-foreground">{name}</dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums">{value}</dd>
      {hint && <dd className="text-xs text-muted-foreground">{hint}</dd>}
    </div>
  );
}

function ofLimit(value: number, limit?: number) {
  return limit ? `${formatInt(value)} de ${formatInt(limit)}` : formatInt(value);
}

function UsageNow({ company }: { company: CompanyDetail }) {
  const { usage, plan } = company;
  const minutes = Math.round(usage.usage_audio_seconds / 60);
  return (
    <Section title="Uso deste mês" aside="Calculado agora">
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat
          label="Usuários ativos"
          value={ofLimit(usage.users_active, plan.users_limit)}
          hint={plan.users_limit ? "limite do plano" : undefined}
        />
        <Stat
          label="Canais"
          value={formatInt(usage.channels + usage.meta_channels)}
          hint={
            usage.meta_channels
              ? `${formatInt(usage.meta_channels)} da API oficial da Meta`
              : undefined
          }
        />
        <Stat label="Conversas novas" value={formatInt(usage.conversations)} />
        <Stat label="Custo de IA e voz" value={formatCost(usage.usage_cost)} />
        <Stat
          label="Minutos de áudio"
          value={ofLimit(minutes, plan.minutes_limit)}
          hint={plan.minutes_limit ? "limite do plano" : undefined}
        />
      </dl>
    </Section>
  );
}

function History({ company }: { company: CompanyDetail }) {
  return (
    <Section
      title="Histórico mensal"
      aside="Retrato gravado todo dia; o mês corrente fecha no último dia"
    >
      {company.history.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Ainda sem retrato gravado para este cliente. O primeiro aparece no dia seguinte ao
          cadastro.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr className="border-b">
                <th className="py-2 pr-4 font-medium">Mês</th>
                <th className="py-2 pr-4 text-right font-medium">Usuários</th>
                <th className="py-2 pr-4 text-right font-medium">Canais</th>
                <th className="py-2 pr-4 text-right font-medium">Conversas</th>
                <th className="py-2 pr-4 text-right font-medium">IA e voz</th>
                <th className="py-2 text-right font-medium">Áudio</th>
              </tr>
            </thead>
            <tbody>
              {company.history.map((m) => (
                <tr key={m.month} className="border-b last:border-0">
                  <td className="py-2 pr-4">{formatMonth(m.month)}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{formatInt(m.users_active)}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {formatInt(m.channels + m.meta_channels)}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {formatInt(m.conversations)}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">{formatCost(m.usage_cost)}</td>
                  <td className="py-2 text-right tabular-nums">
                    {formatMinutes(m.usage_audio_seconds)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

function Users({ company }: { company: CompanyDetail }) {
  return (
    <Section title="Usuários do cliente" aside={`${formatInt(company.users.length)} no total`}>
      {company.users.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum usuário nesta empresa.</p>
      ) : (
        <ul className="divide-y">
          {company.users.map((u) => {
            const st = u.status ? USER_STATUS[u.status] : undefined;
            return (
              <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{u.full_name || u.email}</p>
                  <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {label(COMPANY_ROLE_LABELS, u.role)}
                  </span>
                  {st && st.tone !== "success" && <Badge tone={st.tone}>{st.label}</Badge>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        A equipe do parceiro não aparece aqui: ela entra nos clientes sem ocupar vaga do plano.
      </p>
    </Section>
  );
}

/**
 * O plano do cliente (D16, B.7): o dono ou administrador do parceiro troca por outro do contrato. A troca vale na hora e
 * fica no histórico da empresa.
 */
function PlanActions({ company }: { company: CompanyDetail }) {
  const panel = usePanel();
  const client = useQueryClient();
  const options = panel.allowed_plans ?? [];
  const current = company.plan.key;
  const [chosen, setChosen] = useState("");
  const mutation = useMutation({
    mutationFn: () => partnersApi.setCompanyPlan(company.id, chosen),
    onSuccess: async () => {
      setChosen("");
      await Promise.all([
        client.invalidateQueries({ queryKey: ["company", company.id] }),
        client.invalidateQueries({ queryKey: ["portfolio"] }),
      ]);
    },
  });
  const others = options.filter((option) => option.key !== current);
  const outside = !!current && !options.some((option) => option.key === current);

  return (
    <div className="space-y-3 text-sm">
      <p>
        Plano atual: <strong>{company.plan.name ?? "não informado"}</strong>
        {company.onboarding &&
          ` · ${formatInt(company.onboarding.done)} de ${formatInt(company.onboarding.total)} passos iniciais feitos`}
      </p>
      {!panel.can_admin_workspaces ? (
        <p className="text-muted-foreground">
          {panel.kind === "ag3"
            ? "O plano dos clientes diretos é trocado pela equipe AG3 no Django Admin."
            : "Só o dono ou um administrador do parceiro troca o plano do cliente."}
        </p>
      ) : others.length === 0 ? (
        <p className="text-muted-foreground">
          O seu contrato não tem outro plano para este cliente. Para liberar mais planos, fale com a
          AG3.
        </p>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          {outside && (
            <p className="text-muted-foreground">
              O plano atual não está no seu contrato: se trocar, não dá para voltar a ele pelo
              painel.
            </p>
          )}
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Novo plano">
            {others.map((option) => (
              <label
                key={option.key}
                className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-4 has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:checked]:font-semibold"
              >
                <input
                  type="radio"
                  name="novo-plano"
                  value={option.key}
                  checked={chosen === option.key}
                  onChange={() => {
                    mutation.reset();
                    setChosen(option.key);
                  }}
                  className="accent-primary"
                />
                {option.name}
              </label>
            ))}
          </div>
          {chosen && (
            <p className="text-muted-foreground">
              A troca vale na hora: as telas e os limites do cliente passam a ser os do plano novo.
              Nada é apagado; o que ficar fora do plano só deixa de aparecer. Fica no histórico da
              empresa, com o seu nome.
            </p>
          )}
          <ErrorText>{mutation.error?.message}</ErrorText>
          <Button type="submit" loading={mutation.isPending} disabled={!chosen}>
            <Layers aria-hidden="true" />
            Trocar plano
          </Button>
        </form>
      )}
    </div>
  );
}

/** Suspender ou reativar à mão. Quem pode: dono ou administrador do parceiro (a equipe AG3 usa o Django Admin). */
function StatusActions({ company }: { company: CompanyDetail }) {
  const panel = usePanel();
  const client = useQueryClient();
  const suspended = company.plan.status === "suspended";
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      partnersApi.setCompanyStatus(company.id, suspended ? "active" : "suspended", reason),
    onSuccess: async () => {
      setConfirming(false);
      setReason("");
      await Promise.all([
        client.invalidateQueries({ queryKey: ["company", company.id] }),
        client.invalidateQueries({ queryKey: ["portfolio"] }),
      ]);
    },
  });

  const error = mutation.error;
  const conflict = error instanceof ApiError && error.status === 409;

  if (!panel.can_admin_workspaces) {
    return (
      <p className="text-sm text-muted-foreground">
        {panel.kind === "ag3"
          ? "Clientes diretos são suspensos e reativados pela equipe AG3 no Django Admin."
          : "Só o dono ou um administrador do parceiro suspende ou reativa o cliente."}
      </p>
    );
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  if (!confirming) {
    return (
      <Button
        variant={suspended ? "default" : "destructive"}
        onClick={() => {
          mutation.reset();
          setConfirming(true);
        }}
      >
        {suspended ? <PlayCircle aria-hidden="true" /> : <PauseCircle aria-hidden="true" />}
        {suspended ? "Reativar cliente" : "Suspender cliente"}
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-sm">
        {suspended
          ? "Ao reativar, a empresa volta a entrar e a operar na hora. As conversas que chegaram durante a suspensão ficam na fila dos operadores; a IA não responde mensagens antigas."
          : `Ao suspender: ${SUSPENSION_EFFECTS} Vale na hora, até alguém reativar.`}
      </p>
      <TextArea
        label={suspended ? "Motivo da reativação" : "Motivo da suspensão"}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={500}
        required
        hint="Fica no histórico da empresa, com o seu nome."
      />
      {error && (
        <ErrorText>
          {error.message}
          {conflict &&
            " Use as opções de mensalidade deste cliente para registrar o pagamento ou adiar a suspensão."}
        </ErrorText>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          variant={suspended ? "default" : "destructive"}
          loading={mutation.isPending}
          disabled={!reason.trim()}
        >
          {suspended ? "Confirmar reativação" : "Confirmar suspensão"}
        </Button>
        <Button variant="ghost" onClick={() => setConfirming(false)} disabled={mutation.isPending}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

export function ClientePage() {
  const { id = "" } = useParams();
  const query = useQuery({ queryKey: ["company", id], queryFn: () => partnersApi.company(id) });

  const back = (
    <Link
      to="/"
      className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      Carteira
    </Link>
  );

  if (query.isPending) {
    return (
      <>
        {back}
        <div className="surface flex justify-center p-10" role="status">
          <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
          <span className="sr-only">Carregando cliente</span>
        </div>
      </>
    );
  }

  if (query.isError) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return (
      <>
        {back}
        <div className="surface p-6">
          <ErrorText>
            {notFound ? "Este cliente não está na sua carteira." : query.error.message}
          </ErrorText>
        </div>
      </>
    );
  }

  const company = query.data;
  const status = planStatus(company.plan.status);
  const suspended = company.plan.status === "suspended";

  return (
    <>
      {back}
      <div className="mb-6 space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{company.name}</h1>
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {company.plan.name ? `Plano ${company.plan.name} · ` : ""}
          Cliente desde {formatDate(company.created_at)}
        </p>
        {company.enter_url && (
          <a
            href={company.enter_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            <LogIn className="size-4" aria-hidden="true" />
            Entrar no workspace
          </a>
        )}
      </div>

      {suspended && (
        <div
          role="status"
          className="mb-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm"
        >
          <p className="font-semibold text-destructive">Cliente suspenso</p>
          <p className="mt-1">{SUSPENSION_EFFECTS}</p>
        </div>
      )}

      <div className="space-y-4">
        {company.alerts && company.alerts.length > 0 && (
          <Section title="Alertas">
            <AlertList alerts={company.alerts} showCompany={false} />
          </Section>
        )}
        <UsageNow company={company} />
        <Section title="Plano">
          <PlanActions company={company} />
        </Section>
        <Section title="Situação">
          <StatusActions company={company} />
        </Section>
        <Section title="Mensalidade">
          <BillingPanel companyId={company.id} />
        </Section>
        <History company={company} />
        <Users company={company} />
      </div>
    </>
  );
}
