import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { partnersApi } from "@/api/partners";
import { reportsApi, type Report } from "@/api/reports";
import { setToken } from "@/lib/session";
import { startFor } from "@/lib/support";
import { partnerPanel, renderApp, staffPanel } from "@/test/render";

vi.mock("@/api/partners", () => ({ partnersApi: { me: vi.fn() } }));
vi.mock("@/api/reports", () => ({ reportsApi: { sla: vi.fn() } }));

const metrics = {
  opened: 3,
  resolved: 1,
  open: 2,
  escalated: 1,
  returned: 1,
  reopened: 0,
  csat_count: 1,
  first_response_on_time_pct: 50,
  resolution_on_time_pct: 100,
  first_response_avg_hours: 0.5,
  resolution_avg_hours: 30,
  csat_avg: 4,
};
const report = (over: Partial<Report> = {}): Report => ({
  start: "2026-10-28",
  end: "2026-11-26",
  group_by: "level",
  totals: metrics,
  groups: [{ key: "n1", label: "N1", ...metrics }],
  ...over,
});

beforeEach(() => {
  vi.mocked(partnersApi.me).mockReset().mockResolvedValue(partnerPanel());
  vi.mocked(reportsApi.sla).mockReset().mockResolvedValue(report());
  setToken("ag3s_teste");
});

describe("relatórios de SLA (8b)", () => {
  it("mostra os totais e a tabela, e troca o agrupamento e o período", async () => {
    renderApp("/relatorios-sla");
    const user = userEvent.setup();
    const totais = await screen.findByRole("region", { name: "Totais" });
    expect(within(totais).getByText("50%")).toBeInTheDocument();
    expect(within(totais).getByText("média 30 min")).toBeInTheDocument();
    expect(within(totais).getByText("4 (1)")).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "N1" })).toBeInTheDocument();
    expect(reportsApi.sla).toHaveBeenCalledWith({ start: startFor(30), group_by: "level" });
    expect(screen.queryByRole("option", { name: "Parceiro" })).not.toBeInTheDocument(); // só a AG3

    await user.selectOptions(screen.getByLabelText("Agrupar por"), "assignee");
    await waitFor(() =>
      expect(reportsApi.sla).toHaveBeenLastCalledWith({ start: startFor(30), group_by: "assignee" })
    );
    await user.selectOptions(screen.getByLabelText("Período"), "90");
    await waitFor(() =>
      expect(reportsApi.sla).toHaveBeenLastCalledWith({ start: startFor(90), group_by: "assignee" })
    );
  });

  it("quem só vê indicadores entra; a equipe AG3 agrupa por parceiro", async () => {
    vi.mocked(partnersApi.me).mockResolvedValue(
      partnerPanel({ member_role: "viewer", can_admin_workspaces: false })
    );
    const { unmount } = renderApp("/relatorios-sla");
    expect(await screen.findByRole("heading", { name: "Relatórios de SLA" })).toBeInTheDocument();
    unmount();

    vi.mocked(partnersApi.me).mockResolvedValue(staffPanel());
    renderApp("/relatorios-sla");
    expect(await screen.findByRole("option", { name: "Parceiro" })).toBeInTheDocument();
  });

  it("sem chamado no período", async () => {
    const zero = { ...metrics, opened: 0, resolved: 0, open: 0, csat_count: 0 };
    vi.mocked(reportsApi.sla).mockResolvedValue(report({ totals: zero, groups: [] }));
    renderApp("/relatorios-sla");
    expect(await screen.findByText("Nenhum chamado aberto no período")).toBeInTheDocument();
  });

  it("a data inicial inclui hoje", () => {
    expect(startFor(1, new Date(2026, 10, 26))).toBe("2026-11-26");
    expect(startFor(30, new Date(2026, 10, 26))).toBe("2026-10-28");
  });
});
