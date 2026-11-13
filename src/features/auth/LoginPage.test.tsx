import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authApi } from "@/api/auth";
import { ApiError } from "@/api/client";
import { partnersApi } from "@/api/partners";
import { getToken, setToken } from "@/lib/session";
import { partnerPanel, renderApp, staffPanel } from "@/test/render";

vi.mock("@/api/auth", async (original) => ({
  ...(await original<typeof import("@/api/auth")>()),
  authApi: {
    login: vi.fn(),
    confirmMfa: vi.fn(),
    resendMfa: vi.fn(),
    forgotPassword: vi.fn(),
    logout: vi.fn(),
  },
}));
vi.mock("@/api/partners", () => ({ partnersApi: { me: vi.fn() } }));

const challenge = {
  mfa_required: true as const,
  challenge_id: "c1",
  email_hint: "d***@parceiro.com",
  code_expires_in: 600,
  resend_in: 0,
};

async function typeCredentials() {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText("E-mail"), "dono@parceiro.com");
  await user.type(screen.getByLabelText("Senha"), "Senha-forte-123");
  await user.click(screen.getByRole("button", { name: "Entrar" }));
  return user;
}

beforeEach(() => {
  vi.mocked(authApi.login).mockReset();
  vi.mocked(authApi.confirmMfa).mockReset();
  vi.mocked(authApi.logout).mockReset().mockResolvedValue({ success: true });
  vi.mocked(partnersApi.me).mockReset();
});

describe("login do Painel de Parcerias", () => {
  it("senha, código por e-mail e a carteira", async () => {
    vi.mocked(authApi.login).mockResolvedValue(challenge);
    vi.mocked(authApi.confirmMfa).mockResolvedValue({ access_token: "ag3s_abc" });
    vi.mocked(partnersApi.me).mockResolvedValue(partnerPanel());
    renderApp("/");

    const user = await typeCredentials();
    expect(
      await screen.findByText(/Enviamos um código para d\*\*\*@parceiro.com/)
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText("Código"), "123456");
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(await screen.findByRole("heading", { name: "Carteira" })).toBeInTheDocument();
    expect(authApi.confirmMfa).toHaveBeenCalledWith("c1", "123456");
    expect(getToken()).toBe("ag3s_abc");
    expect(screen.getAllByText("Parceiro Alfa").length).toBeGreaterThan(0);
  });

  it("conta sem acesso ao painel vê o motivo e não entra", async () => {
    vi.mocked(authApi.login).mockResolvedValue(challenge);
    vi.mocked(authApi.confirmMfa).mockRejectedValue(
      new ApiError(403, "Esta conta não tem acesso ao Painel de Parcerias.")
    );
    renderApp("/");

    const user = await typeCredentials();
    await user.type(await screen.findByLabelText("Código"), "123456");
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "não tem acesso ao Painel de Parcerias"
    );
    expect(getToken()).toBeNull();
  });

  it("sessão que perdeu o acesso volta para o login com o motivo", async () => {
    setToken("ag3s_antigo");
    vi.mocked(partnersApi.me).mockRejectedValue(
      new ApiError(403, "Esta conta não tem acesso ao Painel de Parcerias.")
    );
    renderApp("/");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "não tem acesso ao Painel de Parcerias"
    );
    expect(getToken()).toBeNull();
  });

  it("equipe AG3 entra com o selo AG3 e sair encerra a sessão no servidor", async () => {
    setToken("ag3s_staff");
    vi.mocked(partnersApi.me).mockResolvedValue(staffPanel());
    renderApp("/equipe"); // a equipe AG3 não tem "Equipe": volta para a carteira

    expect(await screen.findByRole("heading", { name: "Carteira" })).toBeInTheDocument();
    expect(screen.getByText("AG3")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Novo workspace/ })).not.toBeInTheDocument();

    await userEvent.setup().click(screen.getAllByRole("button", { name: /Sair/ })[0]!);
    await waitFor(() => expect(authApi.logout).toHaveBeenCalledWith("ag3s_staff"));
    expect(getToken()).toBeNull();
    expect(await screen.findByRole("button", { name: "Entrar" })).toBeInTheDocument();
  });
});
