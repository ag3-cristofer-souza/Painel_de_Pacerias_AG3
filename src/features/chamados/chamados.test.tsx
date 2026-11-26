import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { partnersApi } from "@/api/partners";
import { supportApi, type Ticket, type TicketDetail } from "@/api/support";
import { setToken } from "@/lib/session";
import { partnerPanel, renderApp, staffPanel } from "@/test/render";

vi.mock("@/api/partners", () => ({ partnersApi: { me: vi.fn() } }));
vi.mock("@/api/support", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/support")>()),
  supportApi: {
    list: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
    reply: vi.fn(),
    escalate: vi.fn(),
    assignees: vi.fn(),
    returnDown: vi.fn(),
    openAccess: vi.fn(),
    closeAccess: vi.fn(),
  },
}));

const ticket = (over: Partial<Ticket> = {}): Ticket => ({
  id: "t1",
  number: 42,
  subject: "Relatório em branco",
  category: { key: "duvida-de-uso", name: "Dúvida de uso" },
  status: "new",
  status_label: "Novo",
  opened_by: { id: "c9", name: "Ana Cliente" },
  created_at: "2026-11-25T10:00:00Z",
  updated_at: "2026-11-25T10:00:00Z",
  last_message_at: "2026-11-25T10:00:00Z",
  resolved_at: null,
  company: { id: "c1", name: "Loja Azul" },
  partner: { id: "p1", name: "Parceiro Alfa" },
  priority: "normal",
  level: "n1",
  assignee: null,
  first_response_at: null,
  issue_url: null,
  can_attend: true,
  sla: {
    first_response_due_at: "2026-11-25T18:00:00Z",
    resolution_due_at: "2026-11-30T18:00:00Z",
    paused: false,
    first_response_breached: false,
    resolution_breached: false,
  },
  ...over,
});

const detail = (over: Partial<TicketDetail> = {}): TicketDetail => ({
  ...ticket(),
  messages: [
    {
      id: "m1",
      body: "A tela fica em branco.",
      visibility: "public",
      author: { side: "client", id: "c9", name: "Ana Cliente" },
      attachments: [{ key: "k1", name: "print.png", size: 2048, url: "https://assinada/print" }],
      created_at: "2026-11-25T10:00:00Z",
    },
    {
      id: "m2",
      body: "Parece cache.",
      visibility: "internal",
      author: { side: "partner", id: "u1", name: "Dona Parceira" },
      attachments: [],
      created_at: "2026-11-25T10:05:00Z",
    },
  ],
  events: [
    {
      id: "e1",
      kind: "created",
      from_value: null,
      to_value: "n1",
      reason: null,
      actor: { side: "client", id: "c9", name: "Ana Cliente" },
      created_at: "2026-11-25T10:00:00Z",
    },
  ],
  ...over,
});

beforeEach(() => {
  vi.mocked(partnersApi.me).mockReset().mockResolvedValue(partnerPanel());
  for (const fn of Object.values(supportApi)) vi.mocked(fn).mockReset();
  vi.mocked(supportApi.list).mockResolvedValue({ data: [ticket()], total: 1, page: 1, limit: 20 });
  vi.mocked(supportApi.get).mockResolvedValue(detail());
  setToken("ag3s_teste");
});

describe("chamados no Painel de Parcerias (8a)", () => {
  it("fila: em aberto, com o prazo, e o filtro do responsável", async () => {
    renderApp("/chamados");
    const user = userEvent.setup();
    expect(await screen.findByText("#42 · Relatório em branco")).toBeInTheDocument();
    expect(supportApi.list).toHaveBeenCalledWith(
      expect.objectContaining({ status: "open", page: 1 })
    );
    expect(screen.getByText(/Responder até/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Nível")).not.toBeInTheDocument(); // o parceiro só tem o N1

    await user.selectOptions(screen.getByLabelText("Responsável"), "me");
    await waitFor(() =>
      expect(supportApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ assignee: "me" }))
    );
  });

  it("chamado: nota interna destacada, resposta ao cliente com anexo, assumir e escalar", async () => {
    vi.mocked(supportApi.reply).mockResolvedValue(detail().messages[0]!);
    vi.mocked(supportApi.update).mockResolvedValue(
      detail({ assignee: { id: "u1", name: "Dona Parceira" } })
    );
    vi.mocked(supportApi.escalate).mockResolvedValue(detail({ level: "n2", can_attend: false }));
    renderApp("/chamados/t1");
    const user = userEvent.setup();

    const conversa = await screen.findByRole("list", { name: "Conversa" });
    expect(within(conversa).getByText("Nota interna")).toBeInTheDocument();
    expect(within(conversa).getByRole("link", { name: /print.png/ })).toHaveAttribute(
      "href",
      "https://assinada/print"
    );
    expect(screen.queryByText("Nota só da equipe AG3")).not.toBeInTheDocument(); // só a AG3

    await user.type(screen.getByLabelText("Mensagem"), "Limpe o cache e tente de novo.");
    const file = new File(["%PDF-1.4"], "passo.pdf", { type: "application/pdf" });
    await user.upload(screen.getByLabelText("Anexar arquivos"), file);
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() =>
      expect(supportApi.reply).toHaveBeenCalledWith("t1", {
        body: "Limpe o cache e tente de novo.",
        visibility: "public",
        files: [file],
      })
    );

    await user.click(screen.getByRole("button", { name: "Assumir" }));
    await waitFor(() =>
      expect(supportApi.update).toHaveBeenCalledWith("t1", { assignee_id: "u1" })
    );

    await user.click(screen.getByRole("button", { name: "Escalar" }));
    await user.type(screen.getByLabelText("Motivo"), "Erro na integração");
    await user.click(screen.getByRole("button", { name: "Escalar para o N2" }));
    await waitFor(() =>
      expect(supportApi.escalate).toHaveBeenCalledWith("t1", "Erro na integração")
    );
  });

  it("equipe AG3: abre o acesso ao workspace e devolve ao N1", async () => {
    vi.mocked(partnersApi.me).mockResolvedValue(staffPanel());
    vi.mocked(supportApi.get).mockResolvedValue(detail({ level: "n2", partner: null }));
    vi.mocked(supportApi.openAccess).mockResolvedValue({
      id: "g1",
      ticket_id: "t1",
      company_id: "c1",
      opened_at: "2026-11-25T11:00:00Z",
      expires_at: "2026-11-26T11:00:00Z",
      renewals: 0,
      ended_at: null,
      end_reason: null,
      enter_url: "https://app.test/?workspace=c1",
    });
    vi.mocked(supportApi.returnDown).mockResolvedValue(detail({ level: "n1" }));
    renderApp("/chamados/t1");
    const user = userEvent.setup();

    expect(await screen.findByText("Nota só da equipe AG3")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Abrir acesso ao workspace" }));
    await waitFor(() => expect(supportApi.openAccess).toHaveBeenCalledWith("t1"));

    await user.click(screen.getByRole("button", { name: "Devolver ao N1" }));
    await user.type(screen.getByLabelText("Motivo"), "Era configuração");
    await user.click(screen.getAllByRole("button", { name: "Devolver ao N1" }).at(-1)!);
    await waitFor(() =>
      expect(supportApi.returnDown).toHaveBeenCalledWith("t1", "Era configuração")
    );
  });

  it("acesso valendo: entrar no workspace e encerrar", async () => {
    vi.mocked(partnersApi.me).mockResolvedValue(staffPanel());
    vi.mocked(supportApi.get).mockResolvedValue(
      detail({
        level: "n2",
        support_access: {
          id: "g1",
          ticket_id: "t1",
          company_id: "c1",
          opened_at: "2026-11-25T11:00:00Z",
          expires_at: "2026-11-26T11:00:00Z",
          renewals: 1,
          ended_at: null,
          end_reason: null,
          enter_url: "https://app.test/?workspace=c1",
        },
      })
    );
    renderApp("/chamados/t1");
    const user = userEvent.setup();
    expect(await screen.findByRole("link", { name: /Entrar no workspace/ })).toHaveAttribute(
      "href",
      "https://app.test/?workspace=c1"
    );
    await user.click(screen.getByRole("button", { name: "Encerrar acesso" }));
    await waitFor(() => expect(supportApi.closeAccess).toHaveBeenCalledWith("t1"));
  });

  it("quem só vê indicadores não entra nos chamados", async () => {
    vi.mocked(partnersApi.me).mockResolvedValue(
      partnerPanel({ member_role: "viewer", can_admin_workspaces: false })
    );
    renderApp("/chamados");
    await waitFor(() => expect(supportApi.list).not.toHaveBeenCalled());
    expect(screen.queryByRole("heading", { name: "Chamados" })).not.toBeInTheDocument();
  });

  it("transfere o responsável para quem atende no nível (26/11)", async () => {
    vi.mocked(partnersApi.me).mockResolvedValue(staffPanel());
    vi.mocked(supportApi.get).mockResolvedValue(
      detail({ partner: null, assignee: { id: "u9", name: "Suporte AG3" } })
    );
    vi.mocked(supportApi.assignees).mockResolvedValue([
      { id: "u9", name: "Suporte AG3", current: true },
      { id: "s2", name: "Bruno Lima", current: false },
    ]);
    vi.mocked(supportApi.update).mockResolvedValue(
      detail({ partner: null, assignee: { id: "s2", name: "Bruno Lima" } })
    );
    renderApp("/chamados/t1");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Transferir" }));
    const select = screen.getByLabelText("Transferir para");
    await waitFor(() =>
      expect(within(select).getByRole("option", { name: "Bruno Lima" })).toBeInTheDocument()
    );
    expect(within(select).queryByRole("option", { name: "Suporte AG3" })).not.toBeInTheDocument(); // já é o responsável
    await user.selectOptions(select, "s2");
    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() =>
      expect(supportApi.update).toHaveBeenCalledWith("t1", { assignee_id: "s2" })
    );
    await waitFor(() => expect(screen.queryByLabelText("Transferir para")).not.toBeInTheDocument());
  });
});
