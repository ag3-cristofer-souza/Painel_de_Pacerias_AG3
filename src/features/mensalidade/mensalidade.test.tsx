import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { billingApi, type BillingDetail, type BillingState } from "@/api/billing";
import { partnersApi } from "@/api/partners";
import { localIsoDate } from "@/lib/format";
import { setToken } from "@/lib/session";
import { partnerPanel, renderApp, staffPanel } from "@/test/render";

vi.mock("@/api/partners", () => ({ partnersApi: { me: vi.fn() } }));
vi.mock("@/api/billing", () => ({
  billingApi: {
    overdue: vi.fn(),
    get: vi.fn(),
    setSchedule: vi.fn(),
    payment: vi.fn(),
    postpone: vi.fn(),
    cancelPostponement: vi.fn(),
  },
}));

const atrasado = (overrides: Partial<BillingState> = {}): BillingState => ({
  company: { id: "c1", name: "Loja Azul" },
  partner: { id: "p1", name: "Parceiro Alfa" },
  enrolled: true,
  auto_suspend: true,
  suspended: false,
  suspended_by_billing: false,
  summary:
    "Em atraso há 12 dias (vencimento 01/11/2026). Se nada for feito, será suspenso em 16/11/2026 (em 3 dias).",
  due_date: "2026-11-01",
  amount_cents: 19990,
  status: "overdue",
  days_late: 12,
  suspend_on: "2026-11-16",
  days_to_suspension: 3,
  ...overrides,
});

const detalhe = (overrides: Partial<BillingDetail> = {}): BillingDetail => ({
  ...atrasado(),
  timeline: [
    {
      date: "2026-10-29",
      kind: "notice_d-3",
      label: "Aviso ao cliente: vence em 3 dias",
      done: true,
    },
    { date: "2026-11-15", kind: "notice_last", label: "Último aviso", done: false },
    { date: "2026-11-16", kind: "suspension", label: "Suspensão automática", done: false },
  ],
  history: [
    {
      at: "2026-10-20T15:00:00Z",
      action: "billing_schedule_set",
      description: "Vencimento informado: 01/11/2026.",
      by_name: "Dona Parceira",
    },
  ],
  ...overrides,
});

beforeEach(() => {
  vi.mocked(partnersApi.me).mockReset().mockResolvedValue(partnerPanel());
  vi.mocked(billingApi.overdue)
    .mockReset()
    .mockResolvedValue({ data: [atrasado()], count: 1 });
  vi.mocked(billingApi.get).mockReset().mockResolvedValue(detalhe());
  for (const fn of [
    billingApi.setSchedule,
    billingApi.payment,
    billingApi.postpone,
    billingApi.cancelPostponement,
  ])
    vi.mocked(fn).mockReset();
  setToken("ag3s_teste");
});

describe("mensalidades em atraso", () => {
  it("equipe AG3 vê todos, com o parceiro, e abre a mensalidade", async () => {
    vi.mocked(partnersApi.me).mockResolvedValue(staffPanel());
    vi.mocked(billingApi.overdue).mockResolvedValue({
      data: [
        atrasado(),
        atrasado({ company: { id: "c2", name: "Loja Direta" }, partner: undefined }),
      ],
      count: 2,
    });
    renderApp("/atrasados");
    const item = (await screen.findByText("Loja Azul")).closest("a")!;
    expect(item).toHaveAttribute("href", "/mensalidade/c1");
    expect(item).toHaveTextContent("Parceiro: Parceiro Alfa");
    expect(item).toHaveTextContent("Suspende em 3 dias");
    expect(item).toHaveTextContent("R$ 199,90");
    expect(screen.getByText("Cliente direto")).toBeInTheDocument();
    expect(screen.getByText("2 clientes em atraso")).toBeInTheDocument();
  });

  it("lista vazia explica o que entra nela", async () => {
    vi.mocked(billingApi.overdue).mockResolvedValue({ data: [], count: 0 });
    renderApp("/atrasados");
    expect(await screen.findByText("Nenhum cliente em atraso")).toBeInTheDocument();
  });
});

describe("mensalidade do cliente", () => {
  it("explica o que vai acontecer e registra o pagamento", async () => {
    vi.mocked(billingApi.payment).mockResolvedValue(
      detalhe({ status: "ok", summary: "Em dia. Próximo vencimento em 01/12/2026.", timeline: [] })
    );
    renderApp("/mensalidade/c1");
    expect(await screen.findByRole("heading", { name: "Loja Azul" })).toBeInTheDocument();
    expect(screen.getByText(/será suspenso em 16\/11\/2026/)).toBeInTheDocument();
    expect(screen.getByText("16/11/2026 (em 3 dias)")).toBeInTheDocument();
    expect(screen.getByLabelText("próximo passo")).toBeInTheDocument();
    expect(screen.getByText("Como funciona a mensalidade e a suspensão")).toBeInTheDocument();
    expect(screen.getByText("Vencimento informado: 01/11/2026.")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Registrar pagamento" }));
    await user.type(screen.getByLabelText("Observação (opcional)"), "pix");
    await user.click(screen.getByRole("button", { name: "Confirmar pagamento" }));
    await waitFor(() => expect(billingApi.payment).toHaveBeenCalledWith("c1", "pix"));
    expect(
      await screen.findByText("Em dia. Próximo vencimento em 01/12/2026.")
    ).toBeInTheDocument();
  });

  it("registra um acordo com a data prometida e o combinado", async () => {
    vi.mocked(billingApi.postpone).mockResolvedValue(
      detalhe({
        status: "postponed",
        postponement: {
          kind: "agreement",
          until: "2026-11-23",
          promised_date: "2026-11-20",
          note: "paga via Pix",
          by_name: "Dona Parceira",
        },
      })
    );
    renderApp("/mensalidade/c1");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Adiar suspensão" }));
    await user.click(screen.getByRole("radio", { name: /Acordo com o cliente/ }));
    const form = screen.getByRole("form", { name: "Adiar suspensão" });
    const submit = within(form).getByRole("button", { name: "Registrar acordo" });
    expect(submit).toBeDisabled();

    // data relativa a hoje: a data prometida não pode ficar no passado (o campo tem `min` = hoje)
    const promised = localIsoDate(2);
    await user.type(within(form).getByLabelText("Data prometida de pagamento"), promised);
    await user.type(within(form).getByLabelText("O que foi combinado"), "paga via Pix");
    await user.click(submit);

    await waitFor(() =>
      expect(billingApi.postpone).toHaveBeenCalledWith("c1", {
        kind: "agreement",
        promised_date: promised,
        note: "paga via Pix",
      })
    );
    expect(
      await screen.findByText("Acordo com o cliente: suspensão só em 23/11/2026")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Renovar adiamento" })).toBeInTheDocument();
  });

  it("desfaz o adiamento", async () => {
    vi.mocked(billingApi.get).mockResolvedValue(
      detalhe({
        status: "postponed",
        postponement: { kind: "manual", until: "2026-11-25", note: "pediu prazo" },
      })
    );
    vi.mocked(billingApi.cancelPostponement).mockResolvedValue(detalhe());
    renderApp("/mensalidade/c1");
    const user = userEvent.setup();
    expect(
      await screen.findByText("Adiamento manual: suspensão só em 25/11/2026")
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Desfazer adiamento" }));
    const form = screen.getByRole("form", { name: "Desfazer adiamento" });
    expect(form).toHaveTextContent("volta para a data original");
    await user.click(within(form).getByRole("button", { name: "Desfazer adiamento" }));
    await waitFor(() => expect(billingApi.cancelPostponement).toHaveBeenCalledWith("c1"));
  });

  it("cliente sem vencimento: informar data e valor", async () => {
    vi.mocked(billingApi.get).mockResolvedValue(
      detalhe({
        enrolled: false,
        status: undefined,
        due_date: undefined,
        amount_cents: undefined,
        summary: "Vencimento ainda não informado.",
        timeline: [],
        history: [],
      })
    );
    vi.mocked(billingApi.setSchedule).mockResolvedValue(detalhe());
    renderApp("/mensalidade/c1");
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Vencimento em aberto"), "2026-12-01");
    await user.type(screen.getByLabelText("Valor (opcional)"), "199,9x");
    expect(screen.getByRole("alert")).toHaveTextContent("Valor inválido");
    await user.clear(screen.getByLabelText("Valor (opcional)"));
    await user.type(screen.getByLabelText("Valor (opcional)"), "1.299,90");
    await user.click(screen.getByRole("button", { name: "Salvar vencimento" }));
    await waitFor(() =>
      expect(billingApi.setSchedule).toHaveBeenCalledWith("c1", {
        due_date: "2026-12-01",
        amount_cents: 129990,
      })
    );
  });

  it("quem só vê indicadores acompanha, sem botões", async () => {
    vi.mocked(partnersApi.me).mockResolvedValue(
      partnerPanel({ member_role: "viewer", can_admin_workspaces: false })
    );
    renderApp("/mensalidade/c1");
    expect(
      await screen.findByText(/Só o dono ou um administrador do parceiro mexe na mensalidade/)
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Registrar pagamento" })).not.toBeInTheDocument();
  });
});
