import { describe, expect, it } from "vitest";
import { partnerPanel, staffPanel } from "@/test/render";
import { canSee, visibleNav } from "./navigation";

const labels = (items: { label: string }[]) => items.map((item) => item.label);

describe("menu por quem está no painel", () => {
  it("dono do parceiro vê tudo", () => {
    expect(labels(visibleNav(partnerPanel()))).toEqual([
      "Carteira",
      "Alertas",
      "Mensalidades em atraso",
      "Novo workspace",
      "Equipe",
      "Marca",
      "Artigos de ajuda",
      "Minha conta",
    ]);
  });

  it("quem só vê indicadores não cria workspace", () => {
    const viewer = partnerPanel({ member_role: "viewer", can_admin_workspaces: false });
    expect(labels(visibleNav(viewer))).not.toContain("Novo workspace");
    expect(canSee(viewer, "/novo-workspace")).toBe(false);
  });

  it("equipe AG3 não tem equipe de parceiro nem cria workspace", () => {
    expect(labels(visibleNav(staffPanel()))).toEqual([
      "Carteira",
      "Alertas",
      "Mensalidades em atraso",
      "Artigos de ajuda",
      "Minha conta",
    ]);
    expect(canSee(staffPanel(), "/equipe")).toBe(false);
    expect(canSee(staffPanel(), "/marca")).toBe(false);
  });
});
