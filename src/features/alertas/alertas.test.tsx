import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { alertsApi, partnersApi, type Alert, type CompanyDetail } from "@/api/partners";
import { setToken } from "@/lib/session";
import { partnerPanel, renderApp } from "@/test/render";

vi.mock("@/api/audit", () => ({
  auditApi: {
    list: vi.fn(async () => ({ data: [], total: 0, page: 1, limit: 50 })),
    export: vi.fn(),
  },
}));
vi.mock("@/api/billing", () => ({
  billingApi: {
    get: vi.fn().mockResolvedValue({
      company: { id: "c1", name: "Loja Azul" },
      enrolled: false,
      auto_suspend: true,
      suspended: false,
      suspended_by_billing: false,
      summary: "Vencimento ainda não informado.",
      timeline: [],
      history: [],
    }),
  },
}));
vi.mock("@/api/partners", () => ({
  alertsApi: { list: vi.fn(), acknowledge: vi.fn() },
  partnersApi: { me: vi.fn(), portfolio: vi.fn(), company: vi.fn() },
}));

const alerta = (overrides: Partial<Alert> = {}): Alert => ({
  id: "a1",
  company_id: "c1",
  company_name: "Loja Azul",
  kind: "channel_down",
  kind_label: "Canal desconectado",
  severity: "danger",
  state: "open",
  title: "Canal Vendas desconectado",
  opened_at: "2026-11-18T15:00:00Z",
  last_seen_at: "2026-11-18T15:30:00Z",
  ...overrides,
});

const usage = {
  users_active: 1,
  channels: 1,
  meta_channels: 0,
  conversations: 10,
  usage_cost: {},
  usage_audio_seconds: 0,
};

beforeEach(() => {
  vi.mocked(partnersApi.me).mockReset().mockResolvedValue(partnerPanel());
  vi.mocked(alertsApi.list)
    .mockReset()
    .mockResolvedValue({ data: [alerta()], count: 1 });
  vi.mocked(alertsApi.acknowledge).mockReset();
  setToken("ag3s_teste");
});

describe("alertas", () => {
  it("lista os ativos com o cliente e marca como visto", async () => {
    vi.mocked(alertsApi.acknowledge).mockResolvedValue(alerta({ state: "acknowledged" }));
    renderApp("/alertas");
    const user = userEvent.setup();
    expect(await screen.findByText("Canal Vendas desconectado")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Loja Azul" })).toHaveAttribute("href", "/clientes/c1");
    expect(alertsApi.list).toHaveBeenCalledWith({ state: "active" });

    vi.mocked(alertsApi.list).mockResolvedValue({
      data: [
        alerta({
          state: "acknowledged",
          acknowledged_at: "2026-11-18T16:00:00Z",
          acknowledged_by_name: "Dona Parceira",
        }),
      ],
      count: 1,
    });
    await user.click(screen.getByRole("button", { name: "Já vi" }));
    await waitFor(() => expect(alertsApi.acknowledge).toHaveBeenCalledWith("a1"));
    expect(await screen.findByText("Já visto")).toBeInTheDocument();
    expect(screen.getByText(/por Dona Parceira/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Já vi" })).not.toBeInTheDocument();
  });

  it("aba de resolvidos e lista vazia", async () => {
    renderApp("/alertas");
    const user = userEvent.setup();
    await screen.findByText("Canal Vendas desconectado");
    vi.mocked(alertsApi.list).mockResolvedValue({ data: [], count: 0 });
    await user.click(screen.getByRole("tab", { name: "Resolvidos" }));
    expect(await screen.findByText("Nenhum alerta resolvido")).toBeInTheDocument();
    expect(alertsApi.list).toHaveBeenLastCalledWith({ state: "resolved" });
  });

  it("quem só visualiza não vê o botão", async () => {
    vi.mocked(partnersApi.me).mockResolvedValue(
      partnerPanel({ member_role: "viewer", can_admin_workspaces: false })
    );
    renderApp("/alertas");
    expect(await screen.findByText("Canal Vendas desconectado")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Já vi" })).not.toBeInTheDocument();
  });

  it("a tela do cliente mostra os alertas ativos dele", async () => {
    const detalhe: CompanyDetail = {
      id: "c1",
      name: "Loja Azul",
      created_at: "2026-03-10T12:00:00Z",
      plan: { name: "Pro", status: "active" },
      usage,
      health: { score: 70, alerts: 1, danger: 1 },
      history: [],
      users: [],
      alerts: [alerta()],
    };
    vi.mocked(partnersApi.company).mockResolvedValue(detalhe);
    renderApp("/clientes/c1");
    const titulo = await screen.findByRole("heading", { name: "Alertas" });
    const secao = titulo.closest("section") as HTMLElement;
    expect(within(secao).getByText("Canal Vendas desconectado")).toBeInTheDocument();
    expect(within(secao).queryByRole("link", { name: "Loja Azul" })).not.toBeInTheDocument();
  });
});
