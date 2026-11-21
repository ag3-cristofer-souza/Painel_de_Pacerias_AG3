import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { helpApi, type Article } from "@/api/help";
import { partnersApi } from "@/api/partners";
import { setToken } from "@/lib/session";
import { partnerPanel, renderApp } from "@/test/render";

vi.mock("@/api/partners", () => ({ partnersApi: { me: vi.fn() } }));
vi.mock("@/api/help", () => ({
  helpApi: { list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}));

const art = (o: Partial<Article> = {}): Article => ({
  id: "a1",
  title: "Conectar o WhatsApp",
  summary: "",
  category: "canais",
  category_label: "Canais de mensagem",
  status: "published",
  position: 0,
  source: "partner",
  updated_at: "2026-11-21T10:00:00Z",
  editable: true,
  ...o,
});
const CATS = [
  { key: "geral", label: "Geral" },
  { key: "canais", label: "Canais de mensagem" },
];

beforeEach(() => {
  setToken("ag3s_teste");
  vi.mocked(partnersApi.me).mockReset().mockResolvedValue(partnerPanel());
  vi.mocked(helpApi.list)
    .mockReset()
    .mockResolvedValue({
      data: [
        art(),
        art({ id: "g1", title: "Primeiro acesso", source: "general", editable: false }),
      ],
      categories: CATS,
      can_write: true,
    });
  vi.mocked(helpApi.create).mockReset();
});

describe("Artigos de ajuda (onda 9)", () => {
  it("cria um artigo e mostra o geral só para consulta", async () => {
    vi.mocked(helpApi.create).mockResolvedValue(art({ id: "n1", title: "Novo" }));
    renderApp("/artigos");
    expect(await screen.findByText("Conectar o WhatsApp")).toBeInTheDocument();
    expect(screen.getByText("Geral", { selector: "span" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Novo artigo/ }));
    await userEvent.type(screen.getByLabelText("Título"), "Trocar a senha");
    await userEvent.type(screen.getByLabelText("Texto"), "Abra o perfil.");
    await userEvent.selectOptions(screen.getByLabelText("Categoria"), "canais");
    await userEvent.click(screen.getByLabelText("Publicado"));
    await userEvent.click(screen.getByRole("button", { name: "Criar artigo" }));
    await waitFor(() =>
      expect(helpApi.create).toHaveBeenCalledWith({
        title: "Trocar a senha",
        summary: "",
        body: "Abra o perfil.",
        category: "canais",
        status: "published",
        position: 0,
      })
    );
    expect(await screen.findByText("Conectar o WhatsApp")).toBeInTheDocument(); // voltou à lista
  });

  it("quem só vê indicadores não escreve", async () => {
    vi.mocked(partnersApi.me).mockResolvedValue(
      partnerPanel({ member_role: "viewer", can_admin_workspaces: false })
    );
    vi.mocked(helpApi.list).mockResolvedValue({
      data: [art({ editable: false })],
      categories: CATS,
      can_write: false,
    });
    vi.mocked(helpApi.get).mockResolvedValue(art({ editable: false, body: "Texto" }));
    renderApp("/artigos");
    await userEvent.click(await screen.findByText("Conectar o WhatsApp"));
    expect(await screen.findByLabelText("Título")).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: /Novo artigo|Salvar|Apagar/ })
    ).not.toBeInTheDocument();
  });
});
