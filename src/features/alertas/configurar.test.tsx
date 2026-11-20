import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { alertsApi, partnersApi, type AlertSettings } from "@/api/partners";
import { setToken } from "@/lib/session";
import { partnerPanel, renderApp, staffPanel } from "@/test/render";

vi.mock("@/api/partners", () => ({
  alertsApi: { list: vi.fn(), acknowledge: vi.fn(), settings: vi.fn(), saveSettings: vi.fn() },
  partnersApi: { me: vi.fn() },
}));

const settings = (overrides: Partial<AlertSettings> = {}): AlertSettings => ({
  editable: true,
  limits: [
    {
      key: "channel_down_min",
      kind: "channel_down",
      kind_label: "Canal desconectado",
      label: "Canal fora há mais de",
      unit: "min",
      value: 15,
      default: 15,
      min: 5,
      max: 120,
    },
    {
      key: "no_access_days",
      kind: "no_access",
      kind_label: "Sem acesso",
      label: "Ninguém da empresa entra há mais de",
      unit: "dias",
      value: 7,
      default: 7,
      min: 3,
      max: 30,
    },
  ],
  kinds: [
    { kind: "channel_down", label: "Canal desconectado", enabled: true, can_disable: true },
    { kind: "no_access", label: "Sem acesso", enabled: true, can_disable: true },
    { kind: "plan_past_due", label: "Pagamento pendente", enabled: true, can_disable: false },
  ],
  ...overrides,
});

beforeEach(() => {
  vi.mocked(partnersApi.me).mockReset().mockResolvedValue(partnerPanel());
  vi.mocked(alertsApi.settings).mockReset().mockResolvedValue(settings());
  vi.mocked(alertsApi.saveSettings).mockReset();
  vi.mocked(alertsApi.list).mockReset().mockResolvedValue({ data: [], count: 0 });
  setToken("ag3s_teste");
});

describe("configurar alertas", () => {
  it("abre pela página de alertas, muda um limite, desliga um tipo e salva", async () => {
    vi.mocked(alertsApi.saveSettings).mockResolvedValue(
      settings({
        limits: settings().limits.map((l) =>
          l.key === "channel_down_min" ? { ...l, value: 30 } : l
        ),
        kinds: settings().kinds.map((k) => (k.kind === "no_access" ? { ...k, enabled: false } : k)),
      })
    );
    renderApp("/alertas");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("link", { name: "Configurar alertas" }));

    const canal = await screen.findByLabelText("Canal fora há mais de (min)");
    await user.clear(canal);
    await user.type(canal, "30");
    expect(screen.getByRole("checkbox", { name: /Pagamento pendente/ })).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: /Sem acesso/ }));
    expect(screen.getByLabelText("Ninguém da empresa entra há mais de (dias)")).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Salvar limites" }));

    await waitFor(() =>
      expect(alertsApi.saveSettings).toHaveBeenCalledWith({
        limits: { channel_down_min: 30, no_access_days: 7 },
        disabled: ["no_access"],
      })
    );
    expect(await screen.findByText(/Limites salvos/)).toBeInTheDocument();
    expect(screen.getByLabelText("Canal fora há mais de (min)")).toHaveValue(30);
  });

  it("mostra o erro do servidor", async () => {
    vi.mocked(alertsApi.saveSettings).mockRejectedValue(
      new Error("Canal fora há mais de: escolha entre 5 e 120 min.")
    );
    renderApp("/alertas/configurar");
    const user = userEvent.setup();
    await screen.findByLabelText("Canal fora há mais de (min)");
    await user.click(screen.getByRole("button", { name: "Salvar limites" }));
    expect(await screen.findByText(/escolha entre 5 e 120 min/)).toBeInTheDocument();
  });

  it("quem só visualiza e a equipe AG3 não editam", async () => {
    vi.mocked(partnersApi.me).mockResolvedValue(
      partnerPanel({ member_role: "viewer", can_admin_workspaces: false })
    );
    vi.mocked(alertsApi.settings).mockResolvedValue(settings({ editable: false }));
    const { unmount } = renderApp("/alertas/configurar");
    expect(await screen.findByLabelText("Canal fora há mais de (min)")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Salvar limites" })).not.toBeInTheDocument();
    expect(screen.getByText(/Só o dono ou um administrador muda/)).toBeInTheDocument();
    unmount();

    vi.mocked(partnersApi.me).mockResolvedValue(staffPanel());
    renderApp("/alertas/configurar");
    expect(
      await screen.findByText(/Os clientes diretos usam estes limites padrão/)
    ).toBeInTheDocument();
  });
});
