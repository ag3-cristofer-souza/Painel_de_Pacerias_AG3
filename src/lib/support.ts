import type { Panel } from "@/api/partners";
import type { Ticket, TicketEvent } from "@/api/support";
import { formatDateTime } from "./format";
import type { StatusLabel, Tone } from "./labels";

/** Textos dos chamados (os códigos vêm de `apps/support/models.py`). Código desconhecido aparece como veio. */
export const TICKET_STATUS: Record<string, StatusLabel> = {
  new: { label: "Novo", tone: "warning" },
  in_progress: { label: "Em atendimento", tone: "neutral" },
  waiting_customer: { label: "Aguardando o cliente", tone: "neutral" },
  waiting_third_party: { label: "Aguardando terceiro", tone: "neutral" },
  waiting_fix: { label: "Aguardando correção", tone: "neutral" },
  resolved: { label: "Resolvido", tone: "success" },
  closed: { label: "Fechado", tone: "neutral" },
};

export const ticketStatus = (code: string): StatusLabel =>
  TICKET_STATUS[code] ?? { label: code, tone: "neutral" };

export const PRIORITIES: { key: string; label: string; tone: Tone }[] = [
  { key: "low", label: "Baixa", tone: "neutral" },
  { key: "normal", label: "Normal", tone: "neutral" },
  { key: "high", label: "Alta", tone: "warning" },
  { key: "urgent", label: "Urgente", tone: "danger" },
];

export const priority = (code: string) =>
  PRIORITIES.find((p) => p.key === code) ?? { key: code, label: code, tone: "neutral" as Tone };

export const LEVELS = ["n1", "n2", "n3"] as const;
export const levelLabel = (code: string) => code.toUpperCase();

/** Situações que quem atende escolhe (o servidor recusa as outras). "Aguardando correção" é só no N3, com a issue. */
export const PANEL_STATUSES = [
  "in_progress",
  "waiting_customer",
  "waiting_third_party",
  "waiting_fix",
  "resolved",
] as const;

export const OPEN_STATUSES = [
  "new",
  "in_progress",
  "waiting_customer",
  "waiting_third_party",
  "waiting_fix",
];

export const VISIBILITY: Record<string, { label: string; hint: string }> = {
  public: { label: "Resposta ao cliente", hint: "O cliente vê e recebe o aviso por e-mail." },
  internal: {
    label: "Nota interna",
    hint: "Só quem atende vê, o parceiro e a equipe AG3. O cliente nunca vê.",
  },
  ag3: { label: "Nota só da equipe AG3", hint: "Nem o parceiro vê." },
};

export const SIDE_LABELS: Record<string, string> = {
  client: "Cliente",
  partner: "Parceiro",
  ag3: "Equipe AG3",
  system: "Sistema",
};

/** Quem atende chamados: dono, administrador e suporte do parceiro, e toda a equipe AG3. "Só indicadores", não. */
export const canHandleTickets = (panel: Panel) =>
  panel.kind === "ag3" || ["owner", "admin", "support"].includes(panel.member_role ?? "");

const DEADLINES: Record<string, string> = {
  first_response: "primeira resposta",
  resolution: "resolução",
};

/** Uma linha do histórico do chamado. */
export function eventText(e: TicketEvent): string {
  const st = (v: string | null) => (v ? ticketStatus(v).label : "—");
  switch (e.kind) {
    case "created":
      return `Chamado aberto no ${levelLabel(e.to_value ?? "n1")}`;
    case "status":
      return `Situação: ${st(e.from_value)} → ${st(e.to_value)}`;
    case "priority":
      return `Prioridade: ${priority(e.from_value ?? "").label} → ${priority(e.to_value ?? "").label}`;
    case "escalated":
      return `Escalado para o ${levelLabel(e.to_value ?? "")}`;
    case "returned":
      return `Devolvido para o ${levelLabel(e.to_value ?? "")}`;
    case "assigned":
      return e.to_value ? "Responsável definido" : "Responsável retirado";
    case "reopened":
      return "Reaberto pela resposta do cliente";
    case "rated":
      return `Avaliado pelo cliente: ${e.to_value ?? "?"} de 5`;
    case "issue":
      return e.to_value ? "Ligado a uma correção (issue)" : "Issue retirada";
    case "sla_warning":
      return `Prazo de ${DEADLINES[e.to_value ?? ""] ?? "atendimento"} perto de vencer`;
    case "sla_breach":
      return `Prazo de ${DEADLINES[e.to_value ?? ""] ?? "atendimento"} estourado`;
    case "closed":
      return "Fechado automaticamente depois de resolvido";
    default:
      return e.kind;
  }
}

/** O selo de prazo de uma linha da fila: estourado, relógio parado ou até quando. */
export function slaBadge(t: Ticket): { label: string; tone: Tone } | null {
  if (!OPEN_STATUSES.includes(t.status)) return null;
  const s = t.sla;
  if (s.resolution_breached || (s.first_response_breached && !t.first_response_at))
    return { label: "Prazo estourado", tone: "danger" };
  if (s.paused) return { label: "Relógio parado", tone: "neutral" };
  const due = t.first_response_at ? s.resolution_due_at : s.first_response_due_at;
  if (!due) return null;
  const late = new Date(due).getTime() - Date.now() < 2 * 3600 * 1000;
  return {
    label: `${t.first_response_at ? "Resolver" : "Responder"} até ${formatDateTime(due)}`,
    tone: late ? "warning" : "neutral",
  };
}

export const fileSize = (bytes?: number) =>
  bytes === undefined
    ? ""
    : bytes < 1024 * 1024
      ? `${Math.max(1, Math.round(bytes / 1024))} KB`
      : `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;

/** Data local (AAAA-MM-DD) de `days - 1` dias atrás: o período inclui hoje. */
export function startFor(days: number, today = new Date()) {
  const d = new Date(today);
  d.setDate(d.getDate() - (days - 1));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
