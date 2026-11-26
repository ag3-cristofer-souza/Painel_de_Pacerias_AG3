import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  staffApi,
  type DashboardHealth,
  type DashboardOnboarding,
  type DashboardOverview,
  type DashboardPartners,
  type StaffDashboard,
} from "@/api/staff";
import { formatCost, formatDate, formatDateTime, formatInt } from "@/lib/format";
import type { Tone } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { ErrorText } from "@/ui/feedback";
import { PageHeader } from "@/ui/page";

const KEY = ["staff-dashboard"];

const DOT: Record<string, string> = {
  ok: "bg-success",
  warn: "bg-warning",
  fail: "bg-destructive",
  off: "bg-muted-foreground",
};

function Dot({ status }: { status: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block size-2.5 shrink-0 rounded-full", DOT[status] ?? DOT.off)}
    />
  );
}

function Section({
  id,
  title,
  hint,
  children,
}: {
  id: string;
  title: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-4 space-y-3">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
      {children}
    </section>
  );
}

function Kpi({
  value,
  label,
  extra,
  tone,
}: {
  value: ReactNode;
  label: string;
  extra?: ReactNode;
  tone?: Tone;
}) {
  return (
    <div className="surface p-4">
      <p
        className={cn(
          "text-2xl font-semibold tabular-nums",
          tone === "danger" && "text-destructive",
          tone === "warning" && "text-warning"
        )}
      >
        {value}
      </p>
      <p className="text-sm text-muted-foreground">{label}</p>
      {extra && <p className="mt-1 text-xs text-muted-foreground">{extra}</p>}
    </div>
  );
}

const Kpis = ({ children }: { children: ReactNode }) => (
  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">{children}</div>
);

function Box({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="surface min-w-0 p-4">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr className="border-b">
            {head.map((h) => (
              <th key={h} className="py-2 pr-3 font-medium whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&_td]:py-2 [&_td]:pr-3 [&_td]:align-top [&_tr]:border-b [&_tr:last-child]:border-0">
          {children}
        </tbody>
      </table>
    </div>
  );
}

const Muted = ({ children }: { children: ReactNode }) => (
  <p className="text-sm text-muted-foreground">{children}</p>
);

/** Cliente direto abre a tela do cliente; o de parceiro não (a carteira da equipe AG3 é só a dos diretos). */
function Company({ id, name, direct }: { id: string; name: string; direct: boolean }) {
  return direct ? (
    <Link to={`/clientes/${id}`} className="font-medium text-primary hover:underline">
      {name}
    </Link>
  ) : (
    <span className="font-medium">{name}</span>
  );
}

function Unavailable({ what, error }: { what: string; error: string }) {
  return (
    <p className="rounded-xl border border-dashed border-destructive/50 p-3 text-sm text-muted-foreground">
      {what} indisponível: {error}
    </p>
  );
}

function Health({ h }: { h: DashboardHealth }) {
  const fail = h.counts.fail ?? 0;
  const warn = h.counts.warn ?? 0;
  const banner =
    h.overall === "ok"
      ? "Tudo no ar: nenhuma verificação com problema."
      : h.overall === "warn"
        ? `No ar, com ${warn} ponto(s) de atenção${fail ? ` e ${fail} falha(s)` : ""}.`
        : `${fail} falha(s)${warn ? ` e ${warn} ponto(s) de atenção` : ""}: veja os cartões em vermelho.`;
  return (
    <Section
      id="saude"
      title="Saúde do sistema"
      hint="Medido a partir do servidor do painel. Pods, logs e a borda ficam no 13_verificar.sh e no Kubernetes."
    >
      <p
        role="status"
        className={cn(
          "rounded-xl border px-4 py-3 text-sm font-semibold",
          h.overall === "ok" && "border-success/50 bg-success/10",
          h.overall === "warn" && "border-warning/50 bg-warning/10",
          h.overall === "fail" && "border-destructive/50 bg-destructive/10"
        )}
      >
        {banner}
      </p>
      {h.groups.map((g) => (
        <div key={g.group} className="space-y-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {g.group}
          </p>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {g.checks.map((c) => (
              <div key={c.name} className="surface p-3">
                <div className="flex items-center justify-between gap-2 text-sm font-semibold">
                  <span className="flex items-center gap-2">
                    <Dot status={c.status} />
                    {c.name}
                  </span>
                  <span className="whitespace-nowrap">{c.value}</span>
                </div>
                {c.detail && (
                  <p className="mt-1 text-xs break-words text-muted-foreground">{c.detail}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
      {h.queues.length > 0 && (
        <details className="surface p-4">
          <summary className="cursor-pointer text-sm font-medium">
            Filas do RabbitMQ ({h.queues.length})
          </summary>
          <div className="mt-3">
            <Table head={["Fila", "Mensagens", "Consumidores", "Na DLQ", "Situação"]}>
              {h.queues.map((q) => (
                <tr key={q.name}>
                  <td>
                    <code className="text-xs">{q.name}</code>
                  </td>
                  <td className="tabular-nums">{formatInt(q.messages)}</td>
                  <td className="tabular-nums">{formatInt(q.consumers)}</td>
                  <td className="tabular-nums">{q.dead ? formatInt(q.dead) : "—"}</td>
                  <td>
                    <span className="flex items-center gap-2">
                      <Dot status={q.status} />
                      {!q.exists
                        ? "não existe"
                        : !q.consumers
                          ? "sem consumidor"
                          : q.messages >= 100
                            ? "acumulando"
                            : q.dead
                              ? "mensagens na DLQ"
                              : "ok"}
                    </span>
                  </td>
                </tr>
              ))}
            </Table>
          </div>
        </details>
      )}
    </Section>
  );
}

function Overview({ o }: { o: DashboardOverview }) {
  const cost = Object.fromEntries(o.cost.map((c) => [c.currency, c.value]));
  return (
    <>
      <Kpis>
        <Kpi
          value={formatInt(o.companies.total)}
          label="empresas"
          extra={`+${o.companies.new_month} no mês · +${o.companies.new_week} em 7 dias`}
        />
        <Kpi
          value={formatInt(o.companies.suspended)}
          label="empresas suspensas"
          tone={o.companies.suspended ? "warning" : undefined}
        />
        <Kpi
          value={formatInt(o.users.online)}
          label="online agora"
          extra={
            o.users.online_by_system.map((s) => `${s.system}: ${s.count}`).join(" · ") ||
            "ninguém nos últimos 2 min"
          }
        />
        <Kpi
          value={formatInt(o.users.active_24h)}
          label="usaram nas últimas 24 h"
          extra={`de ${formatInt(o.users.active)} usuários ativos`}
        />
        <Kpi value={o.traffic.inbound} label="mensagens recebidas (24 h)" />
        <Kpi
          value={o.traffic.outbound}
          label="mensagens enviadas (24 h)"
          extra={`${o.traffic.failed} com falha`}
        />
        <Kpi
          value={`${o.instances.connected}/${o.instances.total}`}
          label="canais conectados"
          tone={o.instances.disconnected ? "warning" : undefined}
          extra={o.by_provider
            .map((p) => `${p.provider || "?"}: ${p.connected}/${p.total}`)
            .join(" · ")}
        />
        <Kpi
          value={formatInt(o.meta.total)}
          label="números Meta"
          tone={
            o.meta.blocked || o.meta.red
              ? "danger"
              : o.meta.limited || o.meta.token_expiring
                ? "warning"
                : undefined
          }
          extra={`${o.meta.blocked} bloqueado(s) · ${o.meta.limited} limitado(s) · ${o.meta.red} qualidade vermelha · ${o.meta.token_expiring} token vencendo`}
        />
        <Kpi
          value={formatCost(cost)}
          label="custo de IA e voz no mês"
          extra={`${formatInt(o.audio_minutes)} min de áudio · ${o.snapshot_ago ? `retrato ${o.snapshot_ago}` : "sem retrato ainda"}`}
        />
      </Kpis>
      <div className="grid gap-4 lg:grid-cols-2">
        <Box title={`Canais desconectados (${o.instances.disconnected})`}>
          {o.down.length ? (
            <Table head={["Empresa", "Canal", "Provedor", "Situação"]}>
              {o.down.map((i, n) => (
                <tr key={`${i.company_id}-${n}`}>
                  <td>
                    <Company id={i.company_id} name={i.company} direct={i.direct} />
                  </td>
                  <td>
                    {i.name}
                    <p className="text-xs text-muted-foreground">{i.number}</p>
                  </td>
                  <td>{i.provider}</td>
                  <td>{i.status}</td>
                </tr>
              ))}
            </Table>
          ) : (
            <Muted>Todos os canais estão conectados.</Muted>
          )}
        </Box>
        <Box title="Números Meta com problema">
          {o.meta_problems.length ? (
            <Table head={["Empresa", "Número", "Situação", "Qualidade", "Token"]}>
              {o.meta_problems.map((m, n) => (
                <tr key={`${m.company_id}-${n}`}>
                  <td>
                    <Company id={m.company_id} name={m.company} direct={m.direct} />
                  </td>
                  <td>{m.number}</td>
                  <td>{m.situacao}</td>
                  <td>{m.quality}</td>
                  <td>{m.token ? formatDate(m.token) : "—"}</td>
                </tr>
              ))}
            </Table>
          ) : (
            <Muted>
              Nenhum número bloqueado, limitado, com qualidade vermelha ou token vencendo em 7 dias.
            </Muted>
          )}
        </Box>
      </div>
    </>
  );
}

function Partners({ p }: { p: DashboardPartners }) {
  return (
    <>
      <p
        className={cn(
          "rounded-xl border px-4 py-3 text-sm",
          p.auto_suspend ? "border-warning/50 bg-warning/10" : "border-success/50 bg-success/10"
        )}
      >
        {p.auto_suspend ? (
          <>
            <strong>Suspensão automática ligada:</strong> cliente com a mensalidade {p.grace_days}{" "}
            dias em atraso é suspenso pela rotina.
          </>
        ) : (
          <>
            <strong>Suspensão automática desligada:</strong> a rotina só manda os avisos.
          </>
        )}
      </p>
      <Kpis>
        <Kpi
          value={formatInt(p.partners_active)}
          label="parceiros ativos"
          extra={`${p.partners.length} cadastrados`}
        />
        <Kpi
          value={formatInt(p.clients_partner)}
          label="clientes de parceiros"
          extra={`${formatInt(p.clients_direct)} clientes diretos da AG3`}
        />
        <Kpi value={p.staff.map((s) => s.count).join("/")} label="equipe AG3 (N1/N2/N3)" />
        <Kpi
          value={formatInt(p.billing.enrolled)}
          label="mensalidades cadastradas"
          extra={`${p.billing.partner_clients_without} cliente(s) de parceiro sem vencimento`}
        />
        <Kpi
          value={formatInt(p.billing.due_soon)}
          label="vencem em até 3 dias"
          tone={p.billing.due_soon ? "warning" : undefined}
        />
        <Kpi
          value={formatInt(p.billing.overdue)}
          label="em atraso"
          tone={p.billing.overdue ? "danger" : undefined}
          extra={`${p.billing.postponed} com suspensão adiada`}
        />
        <Kpi
          value={formatInt(p.billing.suspended)}
          label="suspensas pela mensalidade"
          tone={p.billing.suspended ? "danger" : undefined}
        />
      </Kpis>
      <div className="grid gap-4 lg:grid-cols-2">
        <Box title="Parceiros">
          {p.partners.length ? (
            <Table head={["Parceiro", "Clientes", "Equipe", "Em atraso", "Último acesso"]}>
              {p.partners.map((x) => (
                <tr key={x.id}>
                  <td>
                    <span className="font-medium">{x.name}</span>{" "}
                    {x.status !== "active" && <Badge tone="warning">{x.status}</Badge>}
                  </td>
                  <td className="tabular-nums">
                    {x.clients}
                    {x.max !== null && `/${x.max}`} {x.full && <Badge tone="warning">cheio</Badge>}
                  </td>
                  <td className="tabular-nums">{x.members}</td>
                  <td>{x.late ? <Badge tone="danger">{x.late}</Badge> : "0"}</td>
                  <td>{x.last_access_ago}</td>
                </tr>
              ))}
            </Table>
          ) : (
            <Muted>Nenhum parceiro cadastrado (o cadastro é no Django Admin).</Muted>
          )}
        </Box>
        <Box title="Mensalidades em atraso">
          {p.late.length ? (
            <Table head={["Cliente", "Vencimento", "Dias", "Suspensão"]}>
              {p.late.map((r) => (
                <tr key={r.company_id}>
                  <td>
                    {r.direct ? (
                      <Link
                        to={`/mensalidade/${r.company_id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {r.company}
                      </Link>
                    ) : (
                      <span className="font-medium">{r.company}</span>
                    )}
                    <p className="text-xs text-muted-foreground">{r.partner || "cliente direto"}</p>
                  </td>
                  <td>{formatDate(r.due_date)}</td>
                  <td className="tabular-nums">{r.days_late}</td>
                  <td>
                    {r.suspended ? (
                      <Badge tone="danger">suspensa</Badge>
                    ) : !p.auto_suspend ? (
                      <span className="text-muted-foreground">desligada</span>
                    ) : (
                      <>
                        {formatDate(r.suspend_on)}{" "}
                        {r.postponed && <Badge tone="warning">adiada</Badge>}{" "}
                        {r.days_to_suspension >= 0 && r.days_to_suspension <= 3 && (
                          <Badge tone="danger">em {r.days_to_suspension} d</Badge>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </Table>
          ) : (
            <Muted>Nenhuma mensalidade em atraso.</Muted>
          )}
        </Box>
      </div>
    </>
  );
}

function Onboarding({ b }: { b: DashboardOnboarding }) {
  return (
    <>
      <Kpis>
        <Kpi
          value={formatInt(b.rows.length)}
          label="empresas novas"
          extra={`${b.complete} com os ${b.steps_total} passos feitos`}
        />
        <Kpi
          value={formatInt(b.stuck)}
          label="paradas há 7 dias ou mais"
          tone={b.stuck ? "warning" : undefined}
          extra="com algum passo pendente"
        />
        <Kpi
          value={formatInt(b.stalled.length)}
          label="clientes sem conversa no mês"
          tone={b.stalled.length ? "warning" : undefined}
          extra="com mais de 30 dias de casa"
        />
      </Kpis>
      <Box title={`Empresas criadas nos últimos ${b.days} dias`}>
        {b.rows.length ? (
          <>
            <Table head={["Empresa", "Criada", "Usuários", "Canais", "IA", "Conversas", "Passos"]}>
              {b.rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Company id={r.id} name={r.name} direct={r.direct} />{" "}
                    {r.suspended && <Badge tone="danger">suspensa</Badge>}
                    <p className="text-xs text-muted-foreground">{r.partner || "cliente direto"}</p>
                  </td>
                  <td className="whitespace-nowrap">
                    {formatDate(r.created_at)}
                    <p className="text-xs text-muted-foreground">{r.age_days} d</p>
                  </td>
                  <td className="tabular-nums">
                    {r.logged}/{r.users}
                    <p className="text-xs text-muted-foreground">entraram</p>
                  </td>
                  <td className="tabular-nums">
                    {r.connected}/{r.channels}
                    {r.meta > 0 && <p className="text-xs text-muted-foreground">{r.meta} Meta</p>}
                  </td>
                  <td className="tabular-nums">{r.assistants}</td>
                  <td className="tabular-nums">{r.conversations}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {r.steps.map((s) => (
                        <Badge key={s.label} tone={s.done ? "success" : "neutral"}>
                          {s.done ? "✓" : "○"} {s.label}
                        </Badge>
                      ))}
                    </div>
                    {r.next ? (
                      <p
                        className={cn(
                          "mt-1 text-xs",
                          r.age_days >= 7 ? "text-warning" : "text-muted-foreground"
                        )}
                      >
                        Próximo: {r.next}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-success">Implantada</p>
                    )}
                  </td>
                </tr>
              ))}
            </Table>
            <p className="mt-2 text-xs text-muted-foreground">
              "Entraram" = usuários que já abriram uma sessão no painel ou no app. Canal conectado
              vale Z-API, Wafly ou número Meta.
            </p>
          </>
        ) : (
          <Muted>Nenhuma empresa criada nos últimos {b.days} dias.</Muted>
        )}
      </Box>
      <Box title={`Clientes sem conversa no mês (${b.stalled.length})`}>
        {!b.has_snapshot ? (
          <Muted>Aguardando o primeiro retrato de consumo do mês (rotina diária).</Muted>
        ) : b.stalled.length ? (
          <ul className="space-y-1 text-sm">
            {b.stalled.map((s) => (
              <li key={s.id}>
                <Company id={s.id} name={s.name} direct={s.direct} />{" "}
                <span className="text-muted-foreground">desde {formatDate(s.created_at)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <Muted>Todos os clientes com mais de 30 dias tiveram conversa neste mês.</Muted>
        )}
      </Box>
    </>
  );
}

function Body({ d }: { d: StaffDashboard }) {
  return (
    <div className="space-y-10">
      {d.health && <Health h={d.health} />}
      <Section
        id="visao"
        title="Visão geral"
        hint="Quem usa, quanto trafega e quais canais precisam de atenção."
      >
        {d.overview.ok ? (
          <Overview o={d.overview.data} />
        ) : (
          <Unavailable what="Visão geral" error={d.overview.error} />
        )}
      </Section>
      <Section
        id="parceiros"
        title="Parceiros e mensalidades"
        hint="Contratos, equipe, uso do Painel de Parcerias e quem está em atraso."
      >
        {d.partners.ok ? (
          <Partners p={d.partners.data} />
        ) : (
          <Unavailable what="Parceiros" error={d.partners.error} />
        )}
      </Section>
      <Section
        id="implantacao"
        title="Implantação"
        hint="Empresas novas, o que já fizeram e o próximo passo; e clientes antigos sem conversa no mês."
      >
        {d.onboarding.ok ? (
          <Onboarding b={d.onboarding.data} />
        ) : (
          <Unavailable what="Implantação" error={d.onboarding.error} />
        )}
      </Section>
    </div>
  );
}

/** Visão AG3 (adendo lz): o dashboard do Django Admin no painel, só para a equipe AG3. */
export function VisaoAG3Page() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: KEY, queryFn: () => staffApi.dashboard() });
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    try {
      client.setQueryData(KEY, await staffApi.dashboard(true));
    } catch {
      await query.refetch();
    } finally {
      setRefreshing(false);
    }
  };
  const d = query.data;
  return (
    <>
      <PageHeader title="Visão AG3">
        Saúde do sistema, uso, parceiros e implantação de todas as empresas. Clientes de parceiros
        aparecem aqui, mas o detalhe deles continua com o parceiro.
      </PageHeader>
      {d && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Seções" className="flex flex-wrap gap-3 text-sm">
            {d.health && (
              <a href="#saude" className="text-primary hover:underline">
                Saúde
              </a>
            )}
            <a href="#visao" className="text-primary hover:underline">
              Visão geral
            </a>
            <a href="#parceiros" className="text-primary hover:underline">
              Parceiros
            </a>
            <a href="#implantacao" className="text-primary hover:underline">
              Implantação
            </a>
          </nav>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              Atualizado {formatDateTime(d.generated_at)} · {formatInt(d.ms)} ms
            </span>
            <Button variant="outline" loading={refreshing} onClick={() => void refresh()}>
              <RefreshCw aria-hidden="true" />
              Atualizar
            </Button>
          </div>
        </div>
      )}
      {query.isPending ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Montando a visão…
        </p>
      ) : query.isError ? (
        <ErrorText>{query.error.message}</ErrorText>
      ) : d ? (
        <Body d={d} />
      ) : null}
    </>
  );
}
