import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { partnersApi } from "@/api/partners";
import { staffApi, type StaffDashboard } from "@/api/staff";
import { setToken } from "@/lib/session";
import { partnerPanel, renderApp, staffPanel } from "@/test/render";

vi.mock("@/api/partners", () => ({ partnersApi: { me: vi.fn() } }));
vi.mock("@/api/staff", () => ({ staffApi: { dashboard: vi.fn() } }));

const linha = (id: string, name: string, direct: boolean, partner = "") => ({
  id,
  name,
  created_at: "2026-11-20T12:00:00Z",
  age_days: 6,
  partner,
  suspended: false,
  users: 1,
  logged: 0,
  channels: 0,
  connected: 0,
  meta: 0,
  assistants: 0,
  conversations: 0,
  steps: [{ label: "Admin entrou", done: false }],
  next: "Admin entrou",
  direct,
});

const painel = (withHealth: boolean): StaffDashboard => ({
  generated_at: "2026-11-26T15:00:00Z",
  ms: 120,
  ...(withHealth
    ? {
        health: {
          overall: "warn",
          counts: { ok: 5, warn: 1 },
          version: "v1",
          groups: [
            {
              group: "Infraestrutura",
              checks: [{ name: "Redis", status: "ok", value: "2 ms", detail: "" }],
            },
          ],
          queues: [],
        },
      }
    : {}),
  overview: { ok: false, ms: 3, error: "OperationalError: timeout" },
  partners: { ok: false, ms: 3, error: "x" },
  onboarding: {
    ok: true,
    ms: 10,
    data: {
      days: 60,
      steps_total: 4,
      stuck: 0,
      complete: 0,
      has_snapshot: true,
      rows: [
        linha("c1", "Loja Direta", true),
        linha("c2", "Loja do Parceiro", false, "Parceiro Alfa"),
      ],
      stalled: [],
    },
  },
});

beforeEach(() => {
  vi.mocked(staffApi.dashboard).mockReset();
  setToken("ag3s_teste");
});

describe("Visão AG3 (adendo lg)", () => {
  it("equipe AG3 vê os blocos; cliente de parceiro sem link; bloco fora não derruba a tela", async () => {
    vi.mocked(partnersApi.me).mockResolvedValue(staffPanel());
    vi.mocked(staffApi.dashboard).mockResolvedValue(painel(true));
    renderApp("/visao-ag3");
    expect(await screen.findByText(/No ar, com 1 ponto/)).toBeInTheDocument();
    expect(screen.getByText(/Visão geral indisponível: OperationalError/)).toBeInTheDocument();
    const tabela = screen.getByText("Loja Direta").closest("table") as HTMLElement;
    expect(within(tabela).getByRole("link", { name: "Loja Direta" })).toHaveAttribute(
      "href",
      "/clientes/c1"
    );
    expect(
      within(tabela).queryByRole("link", { name: "Loja do Parceiro" })
    ).not.toBeInTheDocument();
    expect(within(tabela).getByText("Parceiro Alfa")).toBeInTheDocument();
  });

  it("sem a saúde (N1), a seção não aparece", async () => {
    vi.mocked(partnersApi.me).mockResolvedValue(staffPanel({ support_level: "n1" }));
    vi.mocked(staffApi.dashboard).mockResolvedValue(painel(false));
    renderApp("/visao-ag3");
    expect(await screen.findByText("Loja Direta")).toBeInTheDocument();
    expect(screen.queryByText("Saúde do sistema")).not.toBeInTheDocument();
  });

  it("parceiro volta para a carteira", async () => {
    vi.mocked(partnersApi.me).mockResolvedValue(partnerPanel());
    renderApp("/visao-ag3");
    await screen.findByRole("navigation", { name: "Menu" });
    expect(screen.queryByRole("link", { name: "Visão AG3" })).not.toBeInTheDocument();
    expect(staffApi.dashboard).not.toHaveBeenCalled();
  });
});
