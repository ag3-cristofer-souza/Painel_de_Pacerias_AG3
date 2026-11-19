import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { alertsApi, type Alert } from "@/api/partners";
import { usePanel } from "@/features/auth/AuthProvider";
import { formatDateTime } from "@/lib/format";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { ErrorText } from "@/ui/feedback";

/** Quem só visualiza não marca "já vi" (o servidor também recusa). */
const canAcknowledge = (panel: ReturnType<typeof usePanel>) =>
  panel.kind === "ag3" || panel.member_role !== "viewer";

function AlertItem({ alert, showCompany }: { alert: Alert; showCompany: boolean }) {
  const panel = usePanel();
  const client = useQueryClient();
  const ack = useMutation({
    mutationFn: () => alertsApi.acknowledge(alert.id),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["alerts"] }),
        client.invalidateQueries({ queryKey: ["company", alert.company_id] }),
        client.invalidateQueries({ queryKey: ["portfolio"] }),
      ]);
    },
  });
  const resolved = alert.state === "resolved";
  return (
    <li className="surface space-y-2 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={resolved ? "neutral" : alert.severity === "danger" ? "danger" : "warning"}>
          {alert.kind_label}
        </Badge>
        {showCompany && (
          <Link
            to={`/clientes/${alert.company_id}`}
            className="text-sm font-medium text-primary hover:underline"
          >
            {alert.company_name}
          </Link>
        )}
        {alert.state === "acknowledged" && <Badge>Já visto</Badge>}
      </div>
      <p className="text-sm font-medium">{alert.title}</p>
      <p className="flex flex-wrap gap-x-4 text-xs text-muted-foreground">
        <span>Desde {formatDateTime(alert.opened_at)}</span>
        {alert.acknowledged_at && (
          <span>
            Visto em {formatDateTime(alert.acknowledged_at)}
            {alert.acknowledged_by_name ? ` por ${alert.acknowledged_by_name}` : ""}
          </span>
        )}
        {alert.resolved_at && <span>Resolvido em {formatDateTime(alert.resolved_at)}</span>}
      </p>
      {alert.state === "open" && canAcknowledge(panel) && (
        <div className="space-y-1">
          <Button variant="outline" loading={ack.isPending} onClick={() => ack.mutate()}>
            <CheckCheck aria-hidden="true" />
            Já vi
          </Button>
          <ErrorText>{ack.error?.message}</ErrorText>
        </div>
      )}
    </li>
  );
}

/**
 * Lista de alertas. O alerta some sozinho quando o problema acaba: "Já vi" só avisa a equipe que alguém está cuidando
 * (e ele pesa menos na saúde do cliente).
 */
export function AlertList({ alerts, showCompany }: { alerts: Alert[]; showCompany: boolean }) {
  return (
    <ul className="space-y-3">
      {alerts.map((alert) => (
        <AlertItem key={alert.id} alert={alert} showCompany={showCompany} />
      ))}
    </ul>
  );
}
