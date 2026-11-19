import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/client";
import { partnersApi, teamApi, workspaceApi, type Member } from "@/api/partners";
import { setToken } from "@/lib/session";
import { partnerPanel, renderApp } from "@/test/render";

vi.mock("@/api/partners", () => ({
  partnersApi: { me: vi.fn() },
  workspaceApi: { create: vi.fn() },
  teamApi: { list: vi.fn(), invite: vi.fn(), update: vi.fn(), remove: vi.fn() },
}));

const membro = (overrides: Partial<Member> = {}): Member => ({
  id: "m2",
  user_id: "u2",
  full_name: "Bia Suporte",
  email: "bia@parceiro.com",
  role: "support",
  is_active: true,
  created_at: "2026-11-01T12:00:00Z",
  ...overrides,
});

const eu = membro({ id: "m1", user_id: "u1", full_name: "Dona Parceira", role: "owner" });

beforeEach(() => {
  vi.mocked(partnersApi.me).mockReset().mockResolvedValue(partnerPanel());
  vi.mocked(workspaceApi.create).mockReset();
  vi.mocked(teamApi.list).mockReset().mockResolvedValue([eu, membro()]);
  for (const fn of [teamApi.invite, teamApi.update, teamApi.remove]) vi.mocked(fn).mockReset();
  setToken("ag3s_teste");
});

describe("novo workspace", () => {
  it("cria o cliente, convida o admin e atualiza o contador do contrato", async () => {
    vi.mocked(workspaceApi.create).mockResolvedValue({
      id: "c9",
      name: "Loja Nova",
      created_at: "2026-11-14T12:00:00Z",
      plan: {},
      usage: {
        users_active: 0,
        channels: 0,
        meta_channels: 0,
        conversations: 0,
        usage_cost: {},
        usage_audio_seconds: 0,
      },
    });
    renderApp("/novo-workspace");
    const user = userEvent.setup();
    expect(await screen.findByText("Clientes no contrato: 3 de 10.")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Nome da empresa"), "Loja Nova");
    await user.type(screen.getByLabelText("Nome"), "Carla");
    await user.type(screen.getByLabelText("E-mail"), "Carla@Loja.com");
    vi.mocked(partnersApi.me).mockResolvedValue(
      partnerPanel({
        partner: {
          id: "p1",
          name: "Parceiro Alfa",
          status: "active",
          max_workspaces: 10,
          workspaces_used: 4,
        },
      })
    );
    await user.click(screen.getByRole("button", { name: "Criar workspace e enviar convite" }));

    expect(await screen.findByText("Workspace Loja Nova criado")).toBeInTheDocument();
    expect(screen.getByText("carla@loja.com")).toBeInTheDocument();
    expect(workspaceApi.create).toHaveBeenCalledWith({
      name: "Loja Nova",
      cnpj: "",
      admin_name: "Carla",
      admin_email: "Carla@Loja.com",
    });
    expect(screen.getByRole("link", { name: "Abrir o cliente" })).toHaveAttribute(
      "href",
      "/clientes/c9"
    );
    expect(await screen.findByText("Clientes no contrato: 4 de 10.")).toBeInTheDocument();
  });

  it("escolhe o plano entre os do contrato, com o primeiro marcado", async () => {
    vi.mocked(partnersApi.me).mockResolvedValue(
      partnerPanel({
        allowed_plans: [
          { key: "essentials", name: "Essentials" },
          { key: "pro", name: "Pro" },
        ],
      })
    );
    vi.mocked(workspaceApi.create).mockRejectedValue(new ApiError(422, "teste"));
    renderApp("/novo-workspace");
    const user = userEvent.setup();
    expect(await screen.findByLabelText("Essentials")).toBeChecked();
    await user.click(screen.getByLabelText("Pro"));
    await user.type(screen.getByLabelText("Nome da empresa"), "Loja");
    await user.type(screen.getByLabelText("Nome"), "Carla");
    await user.type(screen.getByLabelText("E-mail"), "carla@loja.com");
    await user.click(screen.getByRole("button", { name: "Criar workspace e enviar convite" }));
    await waitFor(() =>
      expect(workspaceApi.create).toHaveBeenCalledWith(expect.objectContaining({ plan_key: "pro" }))
    );
  });

  it("contrato cheio: explica em vez de mostrar o formulário", async () => {
    vi.mocked(partnersApi.me).mockResolvedValue(
      partnerPanel({
        partner: {
          id: "p1",
          name: "Parceiro Alfa",
          status: "active",
          max_workspaces: 3,
          workspaces_used: 3,
        },
      })
    );
    renderApp("/novo-workspace");
    expect(await screen.findByText(/todos já estão em uso/)).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Novo workspace" })).not.toBeInTheDocument();
  });

  it("e-mail que já tem conta: mostra o motivo do servidor", async () => {
    vi.mocked(workspaceApi.create).mockRejectedValue(
      new ApiError(409, "Este e-mail já tem conta no sistema. Fale com a AG3.")
    );
    renderApp("/novo-workspace");
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Nome da empresa"), "Loja");
    await user.type(screen.getByLabelText("Nome"), "Carla");
    await user.type(screen.getByLabelText("E-mail"), "carla@loja.com");
    await user.click(screen.getByRole("button", { name: "Criar workspace e enviar convite" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("já tem conta");
  });
});

describe("equipe", () => {
  it("dono convida com papel explicado", async () => {
    vi.mocked(teamApi.invite).mockResolvedValue(membro({ id: "m3", full_name: "Caio" }));
    renderApp("/equipe");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Convidar pessoa" }));
    const form = screen.getByRole("form", { name: "Convidar pessoa" });
    await user.type(within(form).getByLabelText("Nome"), "Caio");
    await user.type(within(form).getByLabelText("E-mail"), "caio@parceiro.com");
    await user.click(within(form).getByRole("radio", { name: /Administrador/ }));
    await user.click(within(form).getByRole("button", { name: "Enviar convite" }));
    await waitFor(() =>
      expect(teamApi.invite).toHaveBeenCalledWith({
        full_name: "Caio",
        email: "caio@parceiro.com",
        role: "admin",
      })
    );
    expect(teamApi.list).toHaveBeenCalledTimes(2);
  });

  it("dono muda papel e tira da equipe, nunca a si mesmo", async () => {
    vi.mocked(teamApi.update).mockResolvedValue(membro({ role: "admin" }));
    vi.mocked(teamApi.remove).mockResolvedValue();
    renderApp("/equipe");
    const user = userEvent.setup();
    await user.selectOptions(await screen.findByLabelText("Papel de Bia Suporte"), "admin");
    await waitFor(() => expect(teamApi.update).toHaveBeenCalledWith("m2", { role: "admin" }));
    expect(screen.queryByLabelText("Papel de Dona Parceira")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Tirar da equipe" }));
    expect(screen.getByText(/perde na hora o acesso/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(teamApi.remove).toHaveBeenCalledWith("m2"));
  });

  it("recusa do servidor aparece na linha", async () => {
    vi.mocked(teamApi.update).mockRejectedValue(
      new ApiError(409, "O parceiro precisa de pelo menos um dono ativo.")
    );
    vi.mocked(teamApi.list).mockResolvedValue([
      eu,
      membro({ role: "owner", full_name: "Outro Dono" }),
    ]);
    renderApp("/equipe");
    await userEvent.setup().click(await screen.findByRole("button", { name: "Desativar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("pelo menos um dono ativo");
  });

  it("quem não é dono só vê a equipe", async () => {
    vi.mocked(partnersApi.me).mockResolvedValue(
      partnerPanel({ member_role: "admin", can_admin_workspaces: true })
    );
    renderApp("/equipe");
    expect(await screen.findByText("Bia Suporte")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Convidar pessoa" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tirar da equipe" })).not.toBeInTheDocument();
    expect(screen.getByText(/Só o dono do parceiro convida/)).toBeInTheDocument();
  });
});
