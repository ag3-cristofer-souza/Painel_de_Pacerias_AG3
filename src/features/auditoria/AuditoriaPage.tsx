import { useState } from "react";
import type { AuditSource } from "@/api/audit";
import { usePanel } from "@/features/auth/AuthProvider";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/ui/page";
import { AuditList } from "./AuditList";

/**
 * Auditoria (plano de parceiros 14.4, D27 e D28; passo 9): o que acontece nos clientes e o histórico do parceiro. O
 * parceiro vê os clientes da carteira e o próprio histórico; a equipe AG3 vê todos.
 */
export function AuditoriaPage() {
  const panel = usePanel();
  const staff = panel.kind === "ag3";
  const [source, setSource] = useState<AuditSource>("clients");
  const tabs: { key: AuditSource; label: string }[] = [
    { key: "clients", label: "Clientes" },
    { key: "partner", label: staff ? "Parceiros" : "Parceiro" },
  ];

  return (
    <>
      <PageHeader title="Auditoria">
        {staff
          ? "O que acontece em todos os clientes e parceiros. O antes e depois de um workspace aparece com um acesso de suporte aberto nele."
          : "O que acontece nos seus clientes, por quem e de onde, e o que mudou no próprio parceiro: equipe, marca, domínio e alertas."}
      </PageHeader>
      <div role="tablist" aria-label="Fonte" className="mb-4 flex gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={source === tab.key}
            onClick={() => setSource(tab.key)}
            className={cn(
              "min-h-11 rounded-full px-4 text-sm font-medium",
              source === tab.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="surface p-5">
        <AuditList key={source} source={source} />
      </div>
    </>
  );
}
