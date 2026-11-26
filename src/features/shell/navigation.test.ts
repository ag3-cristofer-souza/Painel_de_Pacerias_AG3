import { describe, expect, it } from "vitest";
import { partnerPanel, staffPanel } from "@/test/render";
import { canSee, visibleNav } from "./navigation";

const labels = (items: { label: string }[]) => items.map((item) => item.label);

describe("menu por quem está no painel", () => {
  it("dono do parceiro vê tudo", () => {
    expect(labels(visibleNav(partnerPanel()))).toEqual([
      "Carteira",
      "Chamados",
      "Relatórios de SLA",
      "Alertas",
      "Mensalidades em atraso",
      "Novo workspace",
      "Equipe",
      "Marca",
      "Auditoria",
      "Artigos de ajuda",
      "Minha conta",
    ]);
  });

  it("quem só vê indicadores não cria workspace", () => {
    const viewer = partnerPanel({ member_role: "viewer", can_admin_workspaces: false });
    expect(labels(visibleNav(viewer))).not.toContain("Novo workspace");
    expect(canSee(viewer, "/novo-workspace")).toBe(false);
    expect(labels(visibleNav(viewer))).not.toContain("Chamados"); // não atende chamados
    expect(canSee(viewer, "/chamados")).toBe(false);
    expect(canSee(viewer, "/relatorios-sla")).toBe(true); // indicador: vê os relatórios (8b)
    expect(canSee(viewer, "/auditoria")).toBe(false); // D27: só dono e administrador
    expect(canSee(partnerPanel({ member_role: "support" }), "/auditoria")).toBe(false);
    expect(canSee(partnerPanel({ member_role: "admin" }), "/auditoria")).toBe(true);
    expect(labels(visibleNav(partnerPanel({ member_role: "support" })))).toContain("Chamados");
  });

  it("equipe AG3 não tem equipe de parceiro nem cria workspace", () => {
    expect(labels(visibleNav(staffPanel()))).toEqual([
      "Carteira",
      "Chamados",
      "Relatórios de SLA",
      "Alertas",
      "Mensalidades em atraso",
      "Auditoria",
      "Artigos de ajuda",
      "Minha conta",
    ]);
    expect(canSee(staffPanel(), "/equipe")).toBe(false);
    expect(canSee(staffPanel(), "/marca")).toBe(false);
  });

  it("admin global da AG3 cria cliente direto (adendo kh)", () => {
    const chefe = staffPanel({ can_create_workspaces: true });
    expect(labels(visibleNav(chefe))).toContain("Novo workspace");
    expect(canSee(chefe, "/novo-workspace")).toBe(true);
    expect(canSee(staffPanel({ can_create_workspaces: false }), "/novo-workspace")).toBe(false);
  });
});
