import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { BarChart3, Loader2 } from "lucide-react";
import { useState } from "react";
import { reportsApi, type GroupBy, type ReportMetrics } from "@/api/reports";
import { usePanel } from "@/features/auth/AuthProvider";
import { startFor } from "@/lib/support";
import { EmptyState, ErrorText } from "@/ui/feedback";
import { PageHeader } from "@/ui/page";

const GROUPS: { key: GroupBy; label: string; staffOnly?: boolean }[] = [
  { key: "level", label: "Nível" },
  { key: "assignee", label: "Atendente" },
  { key: "category", label: "Categoria" },
  { key: "company", label: "Cliente" },
  { key: "partner", label: "Parceiro", staffOnly: true },
];
const PERIODS = [
  { days: 7, label: "Últimos 7 dias" },
  { days: 30, label: "Últimos 30 dias" },
  { days: 90, label: "Últimos 90 dias" },
  { days: 365, label: "Último ano" },
] as const;

const select = "min-h-11 rounded-xl border border-input bg-background px-3 text-sm";

const pct = (v?: number) => (v === undefined ? "—" : `${v.toLocaleString("pt-BR")}%`);
const hours = (v?: number) => {
  if (v === undefined) return "—";
  if (v < 1) return `${Math.round(v * 60)} min`;
  if (v < 48) return `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`;
  return `${(v / 24).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} dias`;
};
const csat = (m: ReportMetrics) =>
  m.csat_avg === undefined
    ? "—"
    : `${m.csat_avg.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} (${m.csat_count})`;

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="surface p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * Relatórios de SLA (plano de parceiros 5.3; passo 8b): os chamados abertos no período, com o que ficou dentro do
 * prazo, os tempos médios, a avaliação e o que foi escalado, devolvido ou reaberto, agrupados por nível, atendente,
 * categoria, cliente ou (equipe AG3) parceiro. Todo membro do parceiro vê, inclusive quem só vê indicadores.
 */
export function RelatoriosPage() {
  const panel = usePanel();
  const staff = panel.kind === "ag3";
  const [days, setDays] = useState(30);
  const [groupBy, setGroupBy] = useState<GroupBy>("level");
  const filters = { start: startFor(days), group_by: groupBy };
  const query = useQuery({
    queryKey: ["sla-report", filters],
    queryFn: () => reportsApi.sla(filters),
    placeholderData: keepPreviousData,
  });
  const data = query.data;
  const t = data?.totals;
  const groupLabel = GROUPS.find((g) => g.key === groupBy)?.label ?? "";

  return (
    <>
      <PageHeader title="Relatórios de SLA">
        Os chamados abertos no período: quanto ficou dentro do prazo, quanto tempo levou e como o
        cliente avaliou.
        {staff
          ? " A equipe AG3 vê todos os parceiros e os clientes diretos."
          : " Só os chamados dos seus clientes."}
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm">
          <span className="block text-muted-foreground">Período</span>
          <select
            className={select}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            aria-label="Período"
          >
            {PERIODS.map((p) => (
              <option key={p.days} value={p.days}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="block text-muted-foreground">Agrupar por</span>
          <select
            className={select}
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupBy)}
            aria-label="Agrupar por"
          >
            {GROUPS.filter((g) => staff || !g.staffOnly).map((g) => (
              <option key={g.key} value={g.key}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
        {query.isFetching && (
          <Loader2
            className="mb-3 size-4 animate-spin text-muted-foreground"
            aria-label="Atualizando"
          />
        )}
      </div>

      {query.isError && (
        <ErrorText>Não foi possível carregar o relatório. Tente de novo.</ErrorText>
      )}
      {query.isPending && <p className="text-sm text-muted-foreground">Carregando…</p>}

      {t && t.opened === 0 && (
        <EmptyState icon={BarChart3} title="Nenhum chamado aberto no período">
          Escolha um período maior para ver os números.
        </EmptyState>
      )}

      {t && data && t.opened > 0 && (
        <>
          <section aria-label="Totais" className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card
              label="Abertos"
              value={String(t.opened)}
              hint={`${t.resolved} resolvidos · ${t.open} em aberto`}
            />
            <Card
              label="1ª resposta no prazo"
              value={pct(t.first_response_on_time_pct)}
              hint={`média ${hours(t.first_response_avg_hours)}`}
            />
            <Card
              label="Resolução no prazo"
              value={pct(t.resolution_on_time_pct)}
              hint={`média ${hours(t.resolution_avg_hours)}`}
            />
            <Card label="Avaliação (CSAT)" value={csat(t)} hint="de 1 a 5 (avaliações)" />
            <Card label="Escalados" value={String(t.escalated)} />
            <Card label="Devolvidos" value={String(t.returned)} />
            <Card label="Reabertos" value={String(t.reopened)} />
          </section>

          <div className="surface overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <caption className="sr-only">Por {groupLabel.toLowerCase()}</caption>
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="p-3 font-medium">{groupLabel}</th>
                  <th className="p-3 text-right font-medium">Abertos</th>
                  <th className="p-3 text-right font-medium">Resolvidos</th>
                  <th className="p-3 text-right font-medium">1ª resposta no prazo</th>
                  <th className="p-3 text-right font-medium">Resolução no prazo</th>
                  <th className="p-3 text-right font-medium">Tempo médio de resolução</th>
                  <th className="p-3 text-right font-medium">CSAT</th>
                  <th className="p-3 text-right font-medium">Escalados</th>
                  <th className="p-3 text-right font-medium">Devolvidos</th>
                </tr>
              </thead>
              <tbody>
                {data.groups.map((g) => (
                  <tr key={g.key || "none"} className="border-t border-border">
                    <th scope="row" className="p-3 text-left font-medium">
                      {g.label || "—"}
                    </th>
                    <td className="p-3 text-right tabular-nums">{g.opened}</td>
                    <td className="p-3 text-right tabular-nums">{g.resolved}</td>
                    <td className="p-3 text-right tabular-nums">
                      {pct(g.first_response_on_time_pct)}
                    </td>
                    <td className="p-3 text-right tabular-nums">{pct(g.resolution_on_time_pct)}</td>
                    <td className="p-3 text-right tabular-nums">{hours(g.resolution_avg_hours)}</td>
                    <td className="p-3 text-right tabular-nums">{csat(g)}</td>
                    <td className="p-3 text-right tabular-nums">{g.escalated}</td>
                    <td className="p-3 text-right tabular-nums">{g.returned}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            No prazo conta o horário de atendimento e as pausas do chamado. Os tempos médios são em
            horas corridas desde a abertura.
          </p>
        </>
      )}
    </>
  );
}
