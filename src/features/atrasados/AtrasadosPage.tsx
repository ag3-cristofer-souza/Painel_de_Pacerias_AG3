import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Loader2, PartyPopper } from "lucide-react";
import { Link } from "react-router-dom";
import { billingApi, type BillingState } from "@/api/billing";
import { usePanel } from "@/features/auth/AuthProvider";
import { formatDate, formatInt, formatMoneyCents, inDays } from "@/lib/format";
import { POSTPONE_KIND } from "@/lib/labels";
import { Badge } from "@/ui/badge";
import { EmptyState, ErrorText } from "@/ui/feedback";
import { PageHeader } from "@/ui/page";

const billingPath = (id: string) => `/mensalidade/${id}`;

function Situation({ s }: { s: BillingState }) {
  if (s.suspended)
    return <Badge tone="danger">{s.suspended_by_billing ? "Suspenso" : "Suspenso à mão"}</Badge>;
  if (s.postponement)
    return <Badge tone="warning">{POSTPONE_KIND[s.postponement.kind] ?? "Adiado"}</Badge>;
  if (s.auto_suspend && s.days_to_suspension !== undefined && s.days_to_suspension <= 3)
    return <Badge tone="danger">Suspende {inDays(s.days_to_suspension)}</Badge>;
  return <Badge tone="warning">Em atraso</Badge>;
}

function OverdueItem({ s, showPartner }: { s: BillingState; showPartner: boolean }) {
  return (
    <li>
      <Link
        to={billingPath(s.company.id)}
        className="surface flex items-center gap-4 p-4 hover:bg-muted/40 active:bg-muted"
      >
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{s.company.name}</span>
            <Situation s={s} />
            {showPartner && (
              <span className="text-xs text-muted-foreground">
                {s.partner ? `Parceiro: ${s.partner.name}` : "Cliente direto"}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{s.summary}</p>
          <p className="flex flex-wrap gap-x-4 text-xs text-muted-foreground">
            {s.due_date && <span>Vencimento {formatDate(s.due_date)}</span>}
            {s.days_late !== undefined && <span>{formatInt(s.days_late)} dias de atraso</span>}
            {s.amount_cents !== undefined && <span>{formatMoneyCents(s.amount_cents)}</span>}
          </p>
        </div>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Link>
    </li>
  );
}

export function AtrasadosPage() {
  const panel = usePanel();
  const query = useQuery({ queryKey: ["overdue"], queryFn: () => billingApi.overdue() });
  const ag3 = panel.kind === "ag3";

  return (
    <>
      <PageHeader title="Mensalidades em atraso">
        {ag3
          ? "Todos os clientes em atraso, diretos e dos parceiros, a suspender primeiro. Entre em contato antes da data da suspensão; nos clientes de parceiro, o parceiro também vê esta lista."
          : "Os seus clientes com mensalidade em atraso, a suspender primeiro. Abra um cliente para ver o que vai acontecer e quando, registrar o pagamento ou adiar a suspensão."}
      </PageHeader>

      {query.isPending ? (
        <div className="surface flex justify-center p-10" role="status">
          <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
          <span className="sr-only">Carregando atrasados</span>
        </div>
      ) : query.isError ? (
        <ErrorText>{query.error.message}</ErrorText>
      ) : query.data.data.length === 0 ? (
        <div className="surface">
          <EmptyState icon={PartyPopper} title="Nenhum cliente em atraso">
            Só aparecem aqui os clientes com vencimento informado e mensalidade vencida.
          </EmptyState>
        </div>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground">
            {formatInt(query.data.count)}{" "}
            {query.data.count === 1 ? "cliente em atraso" : "clientes em atraso"}
            {query.data.count > query.data.data.length &&
              ` (mostrando os ${formatInt(query.data.data.length)} mais urgentes)`}
          </p>
          <ul className="space-y-3">
            {query.data.data.map((s) => (
              <OverdueItem key={s.company.id} s={s} showPartner={ag3} />
            ))}
          </ul>
        </>
      )}
    </>
  );
}
