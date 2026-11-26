import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { asaasApi, type AsaasOverview } from "@/api/asaas";
import { partnersApi, type CompanyDetail } from "@/api/partners";
import { setToken } from "@/lib/session";
import { partnerPanel, renderApp, staffPanel } from "@/test/render";

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
  partnersApi: { me: vi.fn(), company: vi.fn() },
}));
vi.mock("@/api/asaas", () => ({
  asaasApi: { get: vi.fn(), sync: vi.fn(), activate: vi.fn(), setMode: vi.fn(), end: vi.fn() },
}));

const usage = {
  users_active: 1,
  channels: 0,
  meta_channels: 0,
  conversations: 0,
  usage_cost: {},
  usage_audio_seconds: 0,
};
const detalhe = {
  id: "c1",
  name: "Loja Azul",
  created_at: "2026-03-10T12:00:00Z",
  plan: { name: "Essentials", status: "active", users_limit: 1 },
  usage,
  history: [],
  users: [],
} as unknown as CompanyDetail;

const pendente: AsaasOverview = {
  environment: "lab",
  configured: true,
  subscriptions: [
    {
      id: "s1",
      kind: "plan",
      plan_key: "pro",
      status: "pending",
      value_cents: 49900,
      method: "card",
      external_id: "sub_1",
      invoice_url: "https://sandbox.asaas.com/i/1",
      next_due_date: null,
      created_at: "2026-11-25T15:00:00Z",
      activated_at: null,
      canceled_at: null,
    },
  ],
  payments: [],
  manual_activations: [],
};

beforeEach(() => {
  vi.mocked(partnersApi.company).mockReset().mockResolvedValue(detalhe);
  vi.mocked(asaasApi.get).mockReset().mockResolvedValue(pendente);
  vi.mocked(asaasApi.sync).mockReset();
  vi.mocked(asaasApi.activate).mockReset();
  setToken("ag3s_teste");
});

describe("cobrança no Asaas (adendo kn)", () => {
  it("equipe AG3 confere no Asaas e ativa à mão com motivo", async () => {
    vi.mocked(partnersApi.me).mockReset().mockResolvedValue(staffPanel());
    vi.mocked(asaasApi.sync).mockResolvedValue({ data: pendente, activated: 0 });
    const ativa = {
      ...pendente.subscriptions[0]!,
      status: "active",
      activated_at: "2026-11-25T16:00:00Z",
    };
    vi.mocked(asaasApi.activate).mockResolvedValue({ ...pendente, subscriptions: [ativa] });
    const user = userEvent.setup();
    renderApp("/clientes/c1");
    const secao = (await screen.findByRole("heading", { name: "Cobrança no Asaas" })).closest(
      "section"
    )!;
    expect(await within(secao).findByText("Aguardando pagamento")).toBeInTheDocument();

    await user.click(within(secao).getByRole("button", { name: /Conferir no Asaas agora/ }));
    expect(await within(secao).findByText(/Nada novo/)).toBeInTheDocument();

    await user.click(within(secao).getByRole("button", { name: "Ativar à mão" }));
    const ativar = within(secao).getByRole("button", { name: /Ativar plano pro/ });
    expect(ativar).toBeDisabled();
    await user.type(within(secao).getByLabelText("Motivo"), "Pix conferido no extrato de 25/11");
    await user.click(ativar);
    await waitFor(() =>
      expect(asaasApi.activate).toHaveBeenCalledWith(
        "c1",
        "s1",
        "Pix conferido no extrato de 25/11"
      )
    );
    expect(await within(secao).findByText("Ativa")).toBeInTheDocument();
  });

  it("cliente atual aparece como cobrança manual e as notas com a situação (adendo ll)", async () => {
    vi.mocked(partnersApi.me).mockReset().mockResolvedValue(staffPanel());
    vi.mocked(asaasApi.get).mockResolvedValue({
      ...pendente,
      automatic: false,
      mode_source: "cutoff",
      nfse: {
        state: "incomplete",
        missing: ["alíquota de ISS (0 a 5%)"],
        fiscal: { required: false, complete: true, postal_code: "07000000", address_number: "10" },
        invoices: [
          {
            external_id: "inv_1",
            payment: "pay_1",
            status: "AUTHORIZED",
            number: "123",
            pdf_url: "https://asaas.test/nota.pdf",
            error: null,
            value_cents: 49900,
            created_at: "2026-11-25T16:00:00Z",
          },
          {
            external_id: null,
            payment: "pay_2",
            status: "REQUESTED",
            number: null,
            pdf_url: null,
            error: "conta sem dados fiscais",
            value_cents: 49900,
            created_at: "2026-11-25T17:00:00Z",
          },
        ],
      },
    });
    renderApp("/clientes/c1");
    const secao = (await screen.findByRole("heading", { name: "Cobrança no Asaas" })).closest(
      "section"
    )!;
    expect(await within(secao).findByText("Cobrança manual")).toBeInTheDocument();
    expect(
      within(secao).getByText(/falta preencher no Admin: alíquota de ISS/)
    ).toBeInTheDocument();
    expect(within(secao).getByText(/CEP 07000000, nº 10/)).toBeInTheDocument();
    expect(within(secao).getByText("Emitida")).toBeInTheDocument();
    expect(within(secao).getByRole("link", { name: /PDF/ })).toHaveAttribute(
      "href",
      "https://asaas.test/nota.pdf"
    );
    expect(within(secao).getByText("conta sem dados fiscais")).toBeInTheDocument();
  });

  it("equipe passa um cliente para a cobrança manual, com motivo (adendo lo)", async () => {
    vi.mocked(partnersApi.me).mockReset().mockResolvedValue(staffPanel());
    vi.mocked(asaasApi.get).mockResolvedValue({
      ...pendente,
      automatic: true,
      mode_source: "cutoff",
    });
    vi.mocked(asaasApi.setMode)
      .mockReset()
      .mockResolvedValue({ ...pendente, automatic: false, mode_source: "explicit" });
    const user = userEvent.setup();
    renderApp("/clientes/c1");
    const secao = (await screen.findByRole("heading", { name: "Cobrança no Asaas" })).closest(
      "section"
    )!;
    expect(await within(secao).findByText("Cobrança automática")).toBeInTheDocument();
    await user.click(within(secao).getByRole("button", { name: "Passar para cobrança manual" }));
    const confirmar = within(secao).getByRole("button", { name: "Confirmar cobrança manual" });
    expect(confirmar).toBeDisabled();
    await user.type(
      within(secao).getAllByLabelText("Motivo")[0]!,
      "Contrato com boleto do financeiro"
    );
    await user.click(confirmar);
    await waitFor(() =>
      expect(asaasApi.setMode).toHaveBeenCalledWith(
        "c1",
        "manual",
        "Contrato com boleto do financeiro"
      )
    );
    expect(await within(secao).findByText("Cobrança manual")).toBeInTheDocument();
    expect(within(secao).getByText(/escolhida pela equipe/)).toBeInTheDocument();
  });

  it("encerrar o plano no fim do período (adendo lq)", async () => {
    vi.mocked(partnersApi.me).mockReset().mockResolvedValue(staffPanel());
    const ativa = {
      ...pendente.subscriptions[0]!,
      status: "active",
      activated_at: "2026-11-01T10:00:00Z",
      next_due_date: "2026-12-01",
    };
    vi.mocked(asaasApi.get).mockResolvedValue({ ...pendente, subscriptions: [ativa] });
    vi.mocked(asaasApi.end)
      .mockReset()
      .mockResolvedValue({
        ...pendente,
        subscriptions: [{ ...ativa, status: "canceled", ends_on: "2026-12-01", ended_at: null }],
      });
    const user = userEvent.setup();
    renderApp("/clientes/c1");
    const secao = (await screen.findByRole("heading", { name: "Cobrança no Asaas" })).closest(
      "section"
    )!;
    await user.click(
      await within(secao).findByRole("button", { name: "Encerrar no fim do período" })
    );
    expect(within(secao).getByLabelText("Último dia de uso")).toHaveValue("2026-12-01");
    const cancelar = within(secao).getByRole("button", {
      name: "Cancelar o plano no fim do período",
    });
    expect(cancelar).toBeDisabled();
    await user.type(
      within(secao).getByLabelText("Motivo do cancelamento"),
      "Estorno pedido pelo cliente"
    );
    await user.click(cancelar);
    await waitFor(() =>
      expect(asaasApi.end).toHaveBeenCalledWith(
        "c1",
        "s1",
        "2026-12-01",
        "Estorno pedido pelo cliente"
      )
    );
    expect(await within(secao).findByText(/o cliente usa até 01\/12\/2026/)).toBeInTheDocument();
  });

  it("parceiro não vê a seção", async () => {
    vi.mocked(partnersApi.me).mockReset().mockResolvedValue(partnerPanel());
    renderApp("/clientes/c1");
    expect(await screen.findByRole("heading", { name: "Loja Azul" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Cobrança no Asaas" })).not.toBeInTheDocument();
    expect(asaasApi.get).not.toHaveBeenCalled();
  });
});
