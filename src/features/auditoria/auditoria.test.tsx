import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { auditApi, type AuditEvent } from "@/api/audit";
import { partnersApi } from "@/api/partners";
import { setToken } from "@/lib/session";
import { partnerPanel, renderApp, staffPanel } from "@/test/render";

vi.mock("@/api/partners", () => ({ partnersApi: { me: vi.fn() } }));
vi.mock("@/api/audit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/audit")>()),
  auditApi: { list: vi.fn(), export: vi.fn() },
}));

const evento = (over: Partial<AuditEvent> = {}): AuditEvent => ({
  id: "e1",
  source: "clients",
  created_at: "2026-11-26T10:00:00Z",
  actor: { id: "u1", name: "Dona Parceira" },
  actor_partner: "Parceiro Alfa",
  origin: "partner",
  origin_label: "Parceiro",
  action_type: "update",
  action_label: "Atualizado",
  entity_type: "pipeline",
  entity_label: "Funil",
  entity_id: null,
  display_name: "Vendas 2",
  changes: [{ field: "name", old_display: "Vendas", new_display: "Vendas 2" }],
  changes_hidden: false,
  company: { id: "c1", name: "Loja Azul" },
  ticket_id: "t9",
  ip: "203.0.113.5",
  ...over,
});

beforeEach(() => {
  vi.mocked(partnersApi.me).mockReset().mockResolvedValue(partnerPanel());
  vi.mocked(auditApi.list)
    .mockReset()
    .mockResolvedValue({ data: [evento()], total: 1, page: 1, limit: 50 });
  vi.mocked(auditApi.export)
    .mockReset()
    .mockResolvedValue(new Blob(["x"]));
  setToken("ag3s_teste");
});

describe("auditoria no Painel de Parcerias (passo 9)", () => {
  it("lista com quem fez, o antes e depois e o chamado; filtra e exporta", async () => {
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    renderApp("/auditoria");
    const user = userEvent.setup();
    const lista = await screen.findByRole("list", { name: "Eventos" });
    expect(
      within(lista).getByText(/Por: Dona Parceira \(Parceiro Alfa\) · Loja Azul/)
    ).toBeInTheDocument();
    expect(within(lista).getByText(/IP 203.0.113.5/)).toBeInTheDocument();
    expect(within(lista).getByRole("link", { name: "Abrir o chamado" })).toHaveAttribute(
      "href",
      "/chamados/t9"
    );
    await user.click(within(lista).getByText(/Ver o antes e depois/));
    expect(within(lista).getByText("Vendas")).toBeInTheDocument();
    expect(auditApi.list).toHaveBeenCalledWith(
      expect.objectContaining({ source: "clients", page: 1 })
    );

    await user.selectOptions(screen.getByLabelText("Origem"), "support");
    await waitFor(() =>
      expect(auditApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ origin: "support" }))
    );
    await user.click(screen.getByRole("button", { name: /Exportar CSV/ }));
    await waitFor(() =>
      expect(auditApi.export).toHaveBeenCalledWith(
        expect.objectContaining({ source: "clients", origin: "support", page: undefined })
      )
    );

    await user.click(screen.getByRole("tab", { name: "Parceiro" }));
    await waitFor(() =>
      expect(auditApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ source: "partner" }))
    );
  });

  it("equipe AG3 sem acesso aberto: o antes e depois fica escondido", async () => {
    vi.mocked(partnersApi.me).mockResolvedValue(staffPanel());
    vi.mocked(auditApi.list).mockResolvedValue({
      data: [evento({ changes: [], changes_hidden: true, ticket_id: null })],
      total: 1,
      page: 1,
      limit: 50,
    });
    renderApp("/auditoria");
    expect(
      await screen.findByText(
        "O antes e depois aparece com um acesso de suporte aberto neste workspace."
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Parceiros" })).toBeInTheDocument();
  });

  it("suporte do parceiro não entra na auditoria", async () => {
    vi.mocked(partnersApi.me).mockResolvedValue(partnerPanel({ member_role: "support" }));
    renderApp("/auditoria");
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "Auditoria" })).not.toBeInTheDocument()
    );
    expect(auditApi.list).not.toHaveBeenCalled();
  });
});
