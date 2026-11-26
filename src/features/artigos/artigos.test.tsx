import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { helpApi, type Article } from "@/api/help";
import { partnersApi } from "@/api/partners";
import { setToken } from "@/lib/session";
import { partnerPanel, renderApp } from "@/test/render";

vi.mock("@/api/partners", () => ({ partnersApi: { me: vi.fn() } }));
vi.mock("@/api/help", () => ({
  helpApi: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    uploadImage: vi.fn(),
  },
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

  it("editor: barra de formatação, imagem enviada e o artigo como o cliente vê (adendo li)", async () => {
    const url = "https://cdn.ag3.test/geonai/help/p1/tela.png";
    vi.mocked(helpApi.uploadImage).mockReset().mockResolvedValue(url);
    vi.mocked(helpApi.create).mockResolvedValue(art({ id: "n2" }));
    const user = userEvent.setup();
    renderApp("/artigos");
    await user.click(await screen.findByRole("button", { name: /Novo artigo/ }));
    await user.type(screen.getByLabelText("Título"), "Conectar canal");
    const texto = screen.getByLabelText("Texto");
    await user.type(texto, "Primeiro passo");
    await user.click(screen.getByRole("button", { name: "Título de seção" }));
    await waitFor(() => expect(texto).toHaveValue("## Primeiro passo"));

    const png = new File(["x"], "tela.png", { type: "image/png" });
    await user.upload(screen.getByTestId("artigo-imagem"), png);
    await waitFor(() => expect(texto).toHaveValue(`## Primeiro passo\n\n![](${url})\n`));
    expect(helpApi.uploadImage).toHaveBeenCalledWith(png);
    const preview = screen.getByLabelText("Ver como o cliente", { selector: "div" });
    expect(within(preview).getByRole("heading", { name: "Primeiro passo" })).toBeInTheDocument();
    expect(preview.querySelector(`img[src="${url}"]`)).not.toBeNull();

    await userEvent
      .setup({ applyAccept: false })
      .upload(
        screen.getByTestId("artigo-imagem"),
        new File(["<svg/>"], "x.svg", { type: "image/svg+xml" })
      );
    expect(await screen.findByText(/PNG, JPEG, WebP ou GIF/)).toBeInTheDocument();
    expect(helpApi.uploadImage).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Criar artigo" }));
    await waitFor(() =>
      expect(helpApi.create).toHaveBeenCalledWith(
        expect.objectContaining({ body: `## Primeiro passo\n\n![](${url})\n` })
      )
    );
  });

  it("envio de imagem que falha avisa junto da barra (25/11: 404 silencioso em produção)", async () => {
    const { ApiError } = await import("@/api/client");
    vi.mocked(helpApi.uploadImage)
      .mockReset()
      .mockRejectedValue(new ApiError(404, "Registro não encontrado"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();
    renderApp("/artigos");
    await user.click(await screen.findByRole("button", { name: /Novo artigo/ }));
    const texto = screen.getByLabelText("Texto");
    await user.type(texto, "Passo 1");
    await user.upload(
      screen.getByTestId("artigo-imagem"),
      new File(["x"], "fig1.png", { type: "image/png" })
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /ainda não aceita imagens nos artigos/
    );
    expect(texto).toHaveValue("Passo 1"); // nada inserido, nada apagado
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
    expect(screen.queryByRole("toolbar", { name: "Formatação" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Novo artigo|Salvar|Apagar/ })
    ).not.toBeInTheDocument();
  });
});
