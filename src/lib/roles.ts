import type { Panel } from "@/api/partners";

export const MEMBER_ROLE_LABELS: Record<string, string> = {
  owner: "Dono",
  admin: "Administrador",
  support: "Suporte",
  viewer: "Só indicadores",
};

export const SUPPORT_LEVEL_LABELS: Record<string, string> = {
  n1: "N1 — clientes diretos",
  n2: "N2 — técnico",
  n3: "N3 — desenvolvimento",
};

/** Em nome de quem a pessoa está no painel: o parceiro, ou a equipe AG3. */
export function panelOwnerName(panel: Panel): string {
  return panel.kind === "partner" && panel.partner ? panel.partner.name : "Equipe AG3";
}

/** Papel (parceiro) ou nível (AG3), para mostrar ao lado do nome. */
export function panelRoleLabel(panel: Panel): string {
  if (panel.kind === "partner")
    return MEMBER_ROLE_LABELS[panel.member_role ?? ""] ?? panel.member_role ?? "";
  return SUPPORT_LEVEL_LABELS[panel.support_level ?? ""] ?? panel.support_level ?? "";
}

export const isOwner = (panel: Panel) => panel.kind === "partner" && panel.member_role === "owner";

/** Mexe na mensalidade (vencimento, pagamento, adiamento): dono ou admin do parceiro; a equipe AG3, em todos. */
export const canWriteBilling = (panel: Panel) => panel.kind === "ag3" || panel.can_admin_workspaces;

/** O que cada papel do parceiro faz, para quem convida escolher sem adivinhar. */
export const MEMBER_ROLE_HELP: Record<string, string> = {
  owner:
    "Tudo o que o administrador faz, mais a equipe: convida pessoas, muda papéis e tira da equipe.",
  admin:
    "Entra nos clientes como administrador, cria workspaces, suspende e reativa clientes e cuida da mensalidade.",
  support:
    "Acompanha a carteira e a mensalidade e vai atender os chamados dos clientes. Não entra nos clientes como administrador.",
  viewer: "Só acompanha a carteira, o uso e a mensalidade, sem alterar nada.",
};

export const MEMBER_ROLES = ["owner", "admin", "support", "viewer"] as const;
