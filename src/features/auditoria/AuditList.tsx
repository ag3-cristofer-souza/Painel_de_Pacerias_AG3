import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Download, ScrollText } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { auditApi, type AuditEvent, type AuditFilters, type AuditSource } from "@/api/audit";
import { formatDateTime } from "@/lib/format";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { EmptyState, ErrorText } from "@/ui/feedback";

const ORIGINS = [
  { key: "", label: "Todas as origens" },
  { key: "client", label: "Equipe do cliente" },
  { key: "partner", label: "Parceiro" },
  { key: "support", label: "Equipe AG3" },
  { key: "system", label: "Sistema" },
] as const;

const TONES: Record<string, "neutral" | "success" | "warning" | "danger"> = {
  client: "neutral",
  partner: "success",
  support: "warning",
  system: "neutral",
};

const input = "min-h-11 rounded-xl border border-input bg-background px-3 text-sm";

function Event({ e, showCompany }: { e: AuditEvent; showCompany: boolean }) {
  const where = e.company?.name ?? e.partner?.name;
  return (
    <li className="space-y-1.5 border-t border-border py-3 first:border-t-0">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">
          {e.action_label} · {e.entity_label}
          {e.display_name ? ` · ${e.display_name}` : ""}
        </span>
        <Badge tone={TONES[e.origin] ?? "neutral"}>{e.origin_label}</Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        {formatDateTime(e.created_at)} · Por: {e.actor.name || "—"}
        {e.actor_partner ? ` (${e.actor_partner})` : ""}
        {showCompany && where ? ` · ${where}` : ""}
        {e.system_label ? ` · ${e.system_label}` : ""}
        {e.ip ? ` · IP ${e.ip}` : ""}
      </p>
      {e.changes.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-primary">
            Ver o antes e depois ({e.changes.length})
          </summary>
          <dl className="mt-2 grid gap-1">
            {e.changes.map((c) => (
              <div key={c.field} className="flex flex-wrap gap-1">
                <dt className="font-medium">{c.field}:</dt>
                <dd>
                  <span className="line-through opacity-70">{c.old_display}</span> → {c.new_display}
                </dd>
              </div>
            ))}
          </dl>
        </details>
      )}
      {e.changes_hidden && (
        <p className="text-xs text-muted-foreground">
          O antes e depois aparece com um acesso de suporte aberto neste workspace.
        </p>
      )}
      {e.ticket_id && (
        <Link
          to={`/chamados/${encodeURIComponent(e.ticket_id)}`}
          className="text-xs font-medium text-primary"
        >
          Abrir o chamado
        </Link>
      )}
    </li>
  );
}

function save(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `auditoria_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Lista da auditoria (passo 9): filtros por origem e período, paginada no servidor, com o antes e depois e o CSV.
 * `companyId` fixa o cliente (seção na tela do cliente).
 */
export function AuditList({ source, companyId }: { source: AuditSource; companyId?: string }) {
  const [origin, setOrigin] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const filters: AuditFilters = {
    source,
    company_id: companyId,
    origin,
    date_from: dateFrom,
    date_to: dateTo,
    page,
  };
  const query = useQuery({
    queryKey: ["audit", filters],
    queryFn: () => auditApi.list(filters),
    placeholderData: keepPreviousData,
  });
  const data = query.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const reset = (set: (v: string) => void) => (v: string) => {
    set(v);
    setPage(1);
  };

  const onExport = async () => {
    setExporting(true);
    setExportError("");
    try {
      save(await auditApi.export({ ...filters, page: undefined }));
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Não foi possível exportar.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end gap-2">
        {source === "clients" && (
          <select
            className={input}
            aria-label="Origem"
            value={origin}
            onChange={(e) => reset(setOrigin)(e.target.value)}
          >
            {ORIGINS.map((o) => (
              <option key={o.key || "all"} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        )}
        <label className="text-xs text-muted-foreground">
          De
          <input
            type="date"
            className={`${input} ml-1`}
            value={dateFrom}
            onChange={(e) => reset(setDateFrom)(e.target.value)}
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Até
          <input
            type="date"
            className={`${input} ml-1`}
            value={dateTo}
            onChange={(e) => reset(setDateTo)(e.target.value)}
          />
        </label>
        <Button variant="outline" onClick={onExport} loading={exporting}>
          <Download className="size-4" aria-hidden="true" />
          Exportar CSV
        </Button>
      </div>
      {exportError && <ErrorText>{exportError}</ErrorText>}
      {query.isError && <ErrorText>{query.error.message}</ErrorText>}
      {query.isPending && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {data && data.data.length === 0 && (
        <EmptyState icon={ScrollText} title="Nenhum evento">
          Nada registrado com estes filtros.
        </EmptyState>
      )}
      {data && data.data.length > 0 && (
        <>
          <ul aria-label="Eventos">
            {data.data.map((e) => (
              <Event key={e.id} e={e} showCompany={!companyId} />
            ))}
          </ul>
          {pages > 1 && (
            <div className="mt-3 flex items-center gap-2 text-sm">
              <Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Anterior
              </Button>
              <span>
                Página {page} de {pages}
              </span>
              <Button variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>
                Próxima
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
