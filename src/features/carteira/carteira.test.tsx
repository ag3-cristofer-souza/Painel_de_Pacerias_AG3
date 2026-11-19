import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/client";
import { partnersApi, type CompanyDetail, type PortfolioCompany } from "@/api/partners";
import { setToken } from "@/lib/session";
import { partnerPanel, renderApp, staffPanel } from "@/test/render";

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
  partnersApi: {
    me: vi.fn(),
    portfolio: vi.fn(),
    company: vi.fn(),
    setCompanyStatus: vi.fn(),
    setCompanyPlan: vi.fn(),
  },
}));

const usage = {
  users_active: 4,
  channels: 2,
  meta_channels: 1,
  conversations: 1234,
  usage_cost: { USD: 12.5 },
  usage_audio_seconds: 600,
};

const loja = (overrides: Partial<PortfolioCompany> = {}): PortfolioCompany => ({
  id: "c1",
  name: "Loja Azul",
  created_at: "2026-03-10T12:00:00Z",
  plan: { name: "Pro", status: "active", users_limit: 10 },
  usage,
  ...overrides,
});

const detalhe = (overrides: Partial<CompanyDetail> = {}): CompanyDetail => ({
  ...loja(),
  history: [{ month: "2026-10-01", ...usage, conversations: 900 }],
  users: [
    { id: "u1", full_name: "Ana Admin", email: "ana@loja.com", role: "admin", status: "active" },
    { id: "u2", full_name: "Beto", email: "beto@loja.com", role: "operator", status: "inactive" },
  ],
  ...overrides,
});

beforeEach(() => {
  vi.mocked(partnersApi.me).mockReset().mockResolvedValue(partnerPanel());
  vi.mocked(partnersApi.portfolio)
    .mockReset()
    .mockResolvedValue({ data: [loja()], count: 1 });
  vi.mocked(partnersApi.company).mockReset().mockResolvedValue(detalhe());
  vi.mocked(partnersApi.setCompanyStatus).mockReset();
  vi.mocked(partnersApi.setCompanyPlan).mockReset();
  setToken("ag3s_teste");
});

describe("carteira", () => {
  it("lista os clientes com o uso do mês e busca no servidor", async () => {
    renderApp("/");
    const table = await screen.findByRole("table");
    const row = within(table).getByRole("row", { name: /Loja Azul/ });
    expect(row).toHaveTextContent("4 de 10");
    expect(row).toHaveTextContent("3 (1 Meta)");
    expect(row).toHaveTextContent("1.234");
    expect(row).toHaveTextContent("Ativo");
    expect(screen.getByText("1 cliente de 10 do contrato")).toBeInTheDocument();
    expect(within(row).getByRole("link", { name: "Loja Azul" })).toHaveAttribute(
      "href",
      "/clientes/c1"
    );

    vi.mocked(partnersApi.portfolio).mockResolvedValue({ data: [], count: 0 });
    await userEvent.setup().type(screen.getByLabelText("Buscar cliente"), "verde");
    expect(await screen.findByText("Nenhum cliente encontrado")).toBeInTheDocument();
    expect(partnersApi.portfolio).toHaveBeenLastCalledWith({
      search: "verde",
      limit: 50,
      offset: 0,
    });
  });

  it("mostra a implantação de cada cliente", async () => {
    vi.mocked(partnersApi.portfolio).mockResolvedValue({
      data: [
        loja({ onboarding: { done: 3, total: 8 } }),
        loja({ id: "c2", name: "Loja Verde", onboarding: { done: 5, total: 5 } }),
        loja({ id: "c3", name: "Loja Roxa" }),
      ],
      count: 3,
    });
    renderApp("/");
    const table = await screen.findByRole("table");
    expect(within(table).getByRole("columnheader", { name: "Implantação" })).toBeInTheDocument();
    expect(within(table).getByRole("row", { name: /Loja Azul/ })).toHaveTextContent("3 de 8");
    expect(within(table).getByRole("row", { name: /Loja Verde/ })).toHaveTextContent("Concluída");
    expect(within(table).getByRole("row", { name: /Loja Roxa/ })).toHaveTextContent("–");
  });

  it("equipe AG3 vê a explicação dos clientes diretos", async () => {
    vi.mocked(partnersApi.me).mockResolvedValue(staffPanel());
    renderApp("/");
    expect(await screen.findByText(/Clientes diretos da AG3, sem parceiro/)).toBeInTheDocument();
    expect(await screen.findByText("1 cliente")).toBeInTheDocument();
  });
});

describe("cliente", () => {
  it("mostra uso, histórico e usuários", async () => {
    renderApp("/clientes/c1");
    expect(await screen.findByRole("heading", { name: "Loja Azul" })).toBeInTheDocument();
    expect(partnersApi.company).toHaveBeenCalledWith("c1");
    expect(screen.getByText("Plano Pro · Cliente desde 10/03/2026")).toBeInTheDocument();
    expect(screen.getByText("out/2026")).toBeInTheDocument();
    expect(screen.getByText("Ana Admin")).toBeInTheDocument();
    expect(screen.getByText("Inativo")).toBeInTheDocument();
    expect(screen.getByText("Operador")).toBeInTheDocument();
  });

  it("dono suspende com motivo e a tela passa a mostrar o cliente suspenso", async () => {
    vi.mocked(partnersApi.setCompanyStatus).mockResolvedValue(
      loja({ plan: { status: "suspended" } })
    );
    renderApp("/clientes/c1");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Suspender cliente" }));
    const confirmar = screen.getByRole("button", { name: "Confirmar suspensão" });
    expect(confirmar).toBeDisabled(); // sem motivo, não suspende
    expect(screen.getByText(/Ao suspender: .*nada sai pelo WhatsApp/)).toBeInTheDocument();

    vi.mocked(partnersApi.company).mockResolvedValue(detalhe({ plan: { status: "suspended" } }));
    await user.type(screen.getByLabelText("Motivo da suspensão"), "contrato encerrado");
    await user.click(confirmar);

    await waitFor(() =>
      expect(partnersApi.setCompanyStatus).toHaveBeenCalledWith(
        "c1",
        "suspended",
        "contrato encerrado"
      )
    );
    expect(await screen.findByText("Cliente suspenso")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reativar cliente" })).toBeInTheDocument();
  });

  it("reativar cliente suspenso pela mensalidade mostra o caminho certo", async () => {
    vi.mocked(partnersApi.company).mockResolvedValue(detalhe({ plan: { status: "suspended" } }));
    vi.mocked(partnersApi.setCompanyStatus).mockRejectedValue(
      new ApiError(
        409,
        "Cliente com mensalidade em atraso: registre o pagamento ou adie a suspensão."
      )
    );
    renderApp("/clientes/c1");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Reativar cliente" }));
    await user.type(screen.getByLabelText("Motivo da reativação"), "pagou");
    await user.click(screen.getByRole("button", { name: "Confirmar reativação" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /registre o pagamento.*opções de mensalidade/
    );
  });

  it("quem não administra só vê a regra, sem botão", async () => {
    vi.mocked(partnersApi.me).mockResolvedValue(
      partnerPanel({ member_role: "viewer", can_admin_workspaces: false })
    );
    renderApp("/clientes/c1");
    expect(
      await screen.findByText(
        "Só o dono ou um administrador do parceiro suspende ou reativa o cliente."
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Suspender cliente" })).not.toBeInTheDocument();
  });

  it("dono troca o plano por outro do contrato, com a explicação antes", async () => {
    const planos = [
      { key: "essentials", name: "Essentials" },
      { key: "pro", name: "Pro" },
      { key: "plus", name: "Plus" },
    ];
    vi.mocked(partnersApi.me).mockResolvedValue(partnerPanel({ allowed_plans: planos }));
    vi.mocked(partnersApi.company).mockResolvedValue(
      detalhe({
        plan: { key: "pro", name: "Pro", status: "active" },
        onboarding: { done: 2, total: 7 },
      })
    );
    vi.mocked(partnersApi.setCompanyPlan).mockResolvedValue(loja());
    renderApp("/clientes/c1");
    const user = userEvent.setup();
    expect(await screen.findByText(/2 de 7 passos iniciais feitos/)).toBeInTheDocument();
    const grupo = screen.getByRole("radiogroup", { name: "Novo plano" });
    expect(within(grupo).queryByLabelText("Pro")).not.toBeInTheDocument(); // o atual não é opção
    const trocar = screen.getByRole("button", { name: "Trocar plano" });
    expect(trocar).toBeDisabled();
    await user.click(within(grupo).getByLabelText("Plus"));
    expect(screen.getByText(/A troca vale na hora/)).toBeInTheDocument();
    await user.click(trocar);
    await waitFor(() => expect(partnersApi.setCompanyPlan).toHaveBeenCalledWith("c1", "plus"));
  });

  it("equipe AG3 e quem não administra não trocam o plano", async () => {
    vi.mocked(partnersApi.me).mockResolvedValue(staffPanel());
    renderApp("/clientes/c1");
    expect(
      await screen.findByText(
        "O plano dos clientes diretos é trocado pela equipe AG3 no Django Admin."
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Trocar plano" })).not.toBeInTheDocument();
  });

  it("cliente fora da carteira", async () => {
    vi.mocked(partnersApi.company).mockRejectedValue(new ApiError(404, "Empresa não encontrada"));
    renderApp("/clientes/outro");
    expect(await screen.findByRole("alert")).toHaveTextContent("não está na sua carteira");
  });
});
