import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Inbox, Loader2, Search, X } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supportApi, type Ticket, type TicketFilters } from "@/api/support";
import { usePanel } from "@/features/auth/AuthProvider";
import { formatDateTime } from "@/lib/format";
import { LEVELS, levelLabel, priority, slaBadge, ticketStatus } from "@/lib/support";
import { useDebounced } from "@/lib/useDebounced";
import { cn } from "@/lib/utils";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { EmptyState, ErrorText } from "@/ui/feedback";
import { PageHeader } from "@/ui/page";

const STATUS_TABS = [
  { key: "open", label: "Em aberto" },
  { key: "new", label: "Novos" },
  { key: "", label: "Todos" },
] as const;

const select = "min-h-11 rounded-xl border border-input bg-background px-3 text-sm";

function Row({ t, showPartner }: { t: Ticket; showPartner: boolean }) {
  const st = ticketStatus(t.status);
  const pr = priority(t.priority);
  const sla = slaBadge(t);
  return (
    <li>
      <Link
        to={`/chamados/${encodeURIComponent(t.id)}`}
        className="surface block space-y-1.5 p-4 transition-colors hover:border-primary/50"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">
            #{t.number} · {t.subject}
          </span>
          <Badge tone={st.tone}>{st.label}</Badge>
          {t.priority !== "normal" && <Badge tone={pr.tone}>{pr.label}</Badge>}
          <Badge>{levelLabel(t.level)}</Badge>
          {sla && <Badge tone={sla.tone}>{sla.label}</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">
          {t.company.name}
          {showPartner && t.partner
            ? ` · ${t.partner.name}`
            : showPartner
              ? " · cliente direto"
              : ""}{" "}
          · {t.category.name} · {t.assignee?.name ? `com ${t.assignee.name}` : "sem responsável"} ·
          última atividade {formatDateTime(t.last_message_at ?? t.updated_at)}
        </p>
      </Link>
    </li>
  );
}

/**
 * Fila de chamados (plano de parceiros 5.2 e 5.6; passo 8a): os abertos primeiro, a conversa mais recente no topo. O
 * parceiro vê o N1 dos clientes dele; a equipe AG3, o N1 dos diretos e o nível dela para baixo. Atualiza a cada 30 s
 * (D42: o painel consulta, sem tempo real). `?cliente=<id>` vem da tela do cliente.
 */
export function ChamadosPage() {
  const panel = usePanel();
  const staff = panel.kind === "ag3";
  const [params, setParams] = useSearchParams();
  const companyId = params.get("cliente") ?? undefined;
  const [status, setStatus] = useState<string>("open");
  const [level, setLevel] = useState("");
  const [assignee, setAssignee] = useState("");
  const [text, setText] = useState("");
  const [page, setPage] = useState(1);
  const q = useDebounced(text);

  const filters: TicketFilters = { status, level, assignee, q, company_id: companyId, page };
  const query = useQuery({
    queryKey: ["tickets", filters],
    queryFn: () => supportApi.list(filters),
    refetchInterval: 30_000,
    placeholderData: keepPreviousData,
  });
  const data = query.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const reset =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPage(1);
    };
  const clientName = companyId
    ? data?.data.find((t) => t.company.id === companyId)?.company.name
    : undefined;

  return (
    <>
      <PageHeader title="Chamados">
        {staff
          ? "Os chamados dos clientes diretos no N1 e os escalados para a equipe AG3, os em aberto primeiro."
          : "Os chamados dos seus clientes, os em aberto primeiro. O que for técnico ou exigir correção, escale para a equipe AG3."}
      </PageHeader>

      {companyId && (
        <div className="mb-3 flex items-center gap-2 text-sm">
          <span>
            Cliente: <strong>{clientName ?? "selecionado"}</strong>
          </span>
          <button
            type="button"
            onClick={() => {
              params.delete("cliente");
              setParams(params);
              setPage(1);
            }}
            className="inline-flex items-center gap-1 text-primary"
          >
            <X className="size-4" aria-hidden="true" />
            Ver todos os clientes
          </button>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <div role="tablist" aria-label="Situação" className="flex gap-2">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key || "all"}
              type="button"
              role="tab"
              aria-selected={status === tab.key}
              onClick={() => reset(setStatus)(tab.key)}
              className={cn(
                "min-h-11 rounded-full px-4 text-sm font-medium",
                status === tab.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {staff && (
          <select
            aria-label="Nível"
            value={level}
            onChange={(e) => reset(setLevel)(e.target.value)}
            className={select}
          >
            <option value="">Todos os níveis</option>
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {levelLabel(l)}
              </option>
            ))}
          </select>
        )}
        <select
          aria-label="Responsável"
          value={assignee}
          onChange={(e) => reset(setAssignee)(e.target.value)}
          className={select}
        >
          <option value="">Qualquer responsável</option>
          <option value="me">Comigo</option>
          <option value="none">Sem responsável</option>
        </select>
        <label className="relative min-w-[14rem] flex-1">
          <span className="sr-only">Buscar por número ou assunto</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            value={text}
            onChange={(e) => reset(setText)(e.target.value)}
            placeholder="Número ou assunto"
            maxLength={100}
            className={cn(select, "w-full pl-9")}
          />
        </label>
      </div>

      {query.isPending ? (
        <div className="surface flex justify-center p-10" role="status">
          <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
          <span className="sr-only">Carregando chamados</span>
        </div>
      ) : query.isError ? (
        <ErrorText>{query.error.message}</ErrorText>
      ) : !data || data.data.length === 0 ? (
        <div className="surface">
          <EmptyState icon={Inbox} title="Nenhum chamado aqui">
            {status === "open"
              ? "Nenhum chamado em aberto com esses filtros."
              : "Nada encontrado com esses filtros."}
          </EmptyState>
        </div>
      ) : (
        <>
          <ul className="space-y-2" aria-label="Chamados">
            {data.data.map((t) => (
              <Row key={t.id} t={t} showPartner={staff} />
            ))}
          </ul>
          <div className="mt-3 flex items-center justify-between gap-2 text-sm text-muted-foreground">
            <span>
              {data.total} chamado{data.total === 1 ? "" : "s"}
            </span>
            {pages > 1 && (
              <div className="flex items-center gap-2">
                <Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  Anterior
                </Button>
                <span>
                  Página {page} de {pages}
                </span>
                <Button
                  variant="outline"
                  disabled={page >= pages}
                  onClick={() => setPage(page + 1)}
                >
                  Próxima
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
