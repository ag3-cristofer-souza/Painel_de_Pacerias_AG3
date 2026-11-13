/** Textos dos códigos que vêm do backend. Código desconhecido aparece como veio, sem quebrar a tela. */

export type Tone = "neutral" | "success" | "warning" | "danger";

export interface StatusLabel {
  label: string;
  tone: Tone;
}

/** `companies.plan_status`. Só `suspended` bloqueia o cliente (o resto é informativo). */
export const PLAN_STATUS: Record<string, StatusLabel> = {
  active: { label: "Ativo", tone: "success" },
  suspended: { label: "Suspenso", tone: "danger" },
  past_due: { label: "Pagamento pendente", tone: "warning" },
  inactive: { label: "Inativo", tone: "neutral" },
};

export const planStatus = (status?: string): StatusLabel =>
  PLAN_STATUS[status ?? "active"] ?? { label: status ?? "", tone: "neutral" };

/** Papel do usuário dentro da empresa do cliente. */
export const COMPANY_ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  manager: "Gestor",
  operator: "Operador",
};

export const USER_STATUS: Record<string, StatusLabel> = {
  active: { label: "Ativo", tone: "success" },
  inactive: { label: "Inativo", tone: "neutral" },
  suspended: { label: "Suspenso", tone: "danger" },
};

export const label = (map: Record<string, string>, code: string) => map[code] ?? code;
