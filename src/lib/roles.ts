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
