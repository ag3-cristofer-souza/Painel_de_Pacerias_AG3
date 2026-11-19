import { useQuery } from "@tanstack/react-query";
import { Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { alertsApi } from "@/api/partners";
import { usePanel } from "@/features/auth/AuthProvider";
import { cn } from "@/lib/utils";
import { EmptyState, ErrorText } from "@/ui/feedback";
import { PageHeader } from "@/ui/page";
import { AlertList } from "./AlertList";

const TABS = [
  { key: "active", label: "Ativos" },
  { key: "resolved", label: "Resolvidos" },
] as const;

export function AlertasPage() {
  const panel = usePanel();
  const [state, setState] = useState<"active" | "resolved">("active");
  const query = useQuery({
    queryKey: ["alerts", state],
    queryFn: () => alertsApi.list({ state }),
    refetchInterval: 60_000,
  });

  return (
    <>
      <PageHeader title="Alertas">
        {panel.kind === "ag3"
          ? "Problemas nos clientes diretos, os mais graves primeiro. A verificação roda a cada 10 minutos e o alerta some sozinho quando o problema acaba."
          : "Problemas nos seus clientes, os mais graves primeiro: canal desconectado, fila parada, queda de uso, implantação incompleta e outros. A verificação roda a cada 10 minutos e o alerta some sozinho quando o problema acaba."}
      </PageHeader>

      <div role="tablist" aria-label="Situação dos alertas" className="mb-4 flex gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={state === tab.key}
            onClick={() => setState(tab.key)}
            className={cn(
              "min-h-11 rounded-full px-4 text-sm font-medium",
              state === tab.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {query.isPending ? (
        <div className="surface flex justify-center p-10" role="status">
          <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
          <span className="sr-only">Carregando alertas</span>
        </div>
      ) : query.isError ? (
        <ErrorText>{query.error.message}</ErrorText>
      ) : query.data.data.length === 0 ? (
        <div className="surface">
          <EmptyState
            icon={ShieldCheck}
            title={state === "active" ? "Nenhum alerta ativo" : "Nenhum alerta resolvido"}
          >
            {state === "active"
              ? "Todos os clientes estão sem problemas conhecidos agora."
              : "Os alertas que acabarem aparecem aqui."}
          </EmptyState>
        </div>
      ) : (
        <AlertList alerts={query.data.data} showCompany />
      )}
    </>
  );
}
