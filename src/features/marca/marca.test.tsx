import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { brandApi, brandingApi, type PanelBrand } from "@/api/branding";
import { partnersApi } from "@/api/partners";
import { setToken } from "@/lib/session";
import { partnerPanel, renderApp } from "@/test/render";
import { BrandLogo } from "@/ui/brand";
import { applyBrand, useBrand } from "./brand";
import { BrandProvider } from "./BrandProvider";

vi.mock("@/api/branding", () => ({
  brandingApi: { byHost: vi.fn() },
  brandApi: { get: vi.fn(), save: vi.fn(), upload: vi.fn(), remove: vi.fn() },
}));
vi.mock("@/api/partners", () => ({ partnersApi: { me: vi.fn() } }));

const marca = (overrides: Partial<PanelBrand> = {}): PanelBrand => ({
  editable: true,
  active: true,
  is_default: false,
  slug: "lojafacil",
  product_name: "Loja Fácil",
  color_primary: "#1a2b3c",
  addresses: {
    painel: "https://lojafacil.ag3system.com",
    mobile: "https://lojafacil-m.ag3system.com",
    suporte: "https://lojafacil-suporte.ag3system.com",
  },
  ...overrides,
});

beforeEach(() => {
  vi.mocked(partnersApi.me).mockReset().mockResolvedValue(partnerPanel());
  vi.mocked(brandApi.get).mockReset().mockResolvedValue(marca());
  vi.mocked(brandApi.save).mockReset();
  vi.mocked(brandApi.upload).mockReset();
  vi.mocked(brandingApi.byHost)
    .mockReset()
    .mockResolvedValue({ is_default: true, product_name: "AG3" });
  setToken("ag3s_teste");
});

afterEach(() => {
  document.getElementById("brand-colors")?.remove();
  document.title = "Painel de Parcerias";
});

describe("página da marca", () => {
  it("pede o domínio próprio e mostra os registros de DNS", async () => {
    vi.mocked(brandApi.save).mockResolvedValue(
      marca({
        custom_domain: {
          domain: "lojafacil.com.br",
          status: "pending",
          cname_target: "clientes.ag3system.com",
          addresses: {
            painel: "https://app.lojafacil.com.br",
            mobile: "https://m.lojafacil.com.br",
            suporte: "https://suporte.lojafacil.com.br",
          },
        },
      })
    );
    renderApp("/marca");
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Domínio"), "lojafacil.com.br");
    await user.click(screen.getByRole("button", { name: "Salvar domínio" }));
    await waitFor(() =>
      expect(brandApi.save).toHaveBeenCalledWith({ custom_domain: "lojafacil.com.br" })
    );
    expect(await screen.findByText(/Pedido recebido/)).toBeInTheDocument();
    expect(screen.getAllByText("clientes.ag3system.com")).toHaveLength(3);
    expect(screen.getByText("suporte")).toBeInTheDocument();
  });

  it("mostra os endereços, salva só o que mudou e avisa ao trocar o endereço", async () => {
    vi.mocked(brandApi.save).mockResolvedValue(marca({ support_email: "ajuda@lojafacil.test" }));
    renderApp("/marca");
    const user = userEvent.setup();
    expect(await screen.findByText("https://lojafacil-m.ag3system.com")).toBeInTheDocument();
    expect(screen.getByText(/Marca ativa/)).toBeInTheDocument();

    await user.type(screen.getByLabelText("E-mail de suporte"), "ajuda@lojafacil.test");
    const endereco = screen.getByLabelText("Endereço curto");
    await user.clear(endereco);
    await user.type(endereco, "lojanova");
    expect(screen.getByText(/muda o endereço de todos os seus clientes/)).toBeInTheDocument();
    await user.clear(endereco);
    await user.type(endereco, "lojafacil");
    await user.click(screen.getByRole("button", { name: "Salvar marca" }));
    await waitFor(() =>
      expect(brandApi.save).toHaveBeenCalledWith({ support_email: "ajuda@lojafacil.test" })
    );
    expect(await screen.findByText("Marca salva.")).toBeInTheDocument();
  });

  it("envia o logo", async () => {
    vi.mocked(brandApi.upload).mockResolvedValue(marca({ logo_dark: "https://cdn.test/logo.png" }));
    renderApp("/marca");
    const user = userEvent.setup();
    const input = await screen.findByLabelText("Enviar logo para fundo escuro");
    const file = new File(["png"], "logo.png", { type: "image/png" });
    await user.upload(input, file);
    await waitFor(() => expect(brandApi.upload).toHaveBeenCalledWith("logo_dark", file));
    expect(await screen.findByAltText("Logo para fundo escuro")).toHaveAttribute(
      "src",
      "https://cdn.test/logo.png"
    );
  });

  it("quem não é dono nem admin só vê", async () => {
    vi.mocked(partnersApi.me).mockResolvedValue(
      partnerPanel({ member_role: "viewer", can_admin_workspaces: false })
    );
    vi.mocked(brandApi.get).mockResolvedValue(
      marca({ editable: false, active: false, slug: undefined, addresses: undefined })
    );
    renderApp("/marca");
    expect(await screen.findByLabelText("Nome do produto")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Salvar marca" })).not.toBeInTheDocument();
    expect(screen.getByText(/Marca ainda não ativa/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Enviar logo para fundo claro")).not.toBeInTheDocument();
  });
});

function Nome() {
  return <span>{useBrand().product_name}</span>;
}

describe("marca pelo endereço da tela", () => {
  it("aplica título, cor e logo do parceiro", async () => {
    vi.mocked(brandingApi.byHost).mockResolvedValue({
      is_default: false,
      slug: "lojafacil",
      product_name: "Loja Fácil",
      color_primary: "#2563eb",
      logo_dark: "https://cdn.test/escuro.png",
    });
    render(
      <BrandProvider host="lojafacil-suporte.ag3system.com">
        <Nome />
        <BrandLogo width={100} height={24} />
      </BrandProvider>
    );
    expect(await screen.findByText("Loja Fácil")).toBeInTheDocument();
    expect(brandingApi.byHost).toHaveBeenCalledWith("lojafacil-suporte.ag3system.com");
    expect(screen.getByAltText("Loja Fácil")).toHaveAttribute("src", "https://cdn.test/escuro.png");
    expect(document.title).toBe("Suporte Loja Fácil");
    expect(document.getElementById("brand-colors")?.textContent).toContain("--primary:221 83% 53%");
  });

  it("sem marca, nada muda", async () => {
    render(
      <BrandProvider host="parceiros.ag3system.com">
        <BrandLogo width={100} height={24} />
      </BrandProvider>
    );
    await waitFor(() => expect(brandingApi.byHost).toHaveBeenCalled());
    expect(screen.getByAltText("AG3.AI")).toBeInTheDocument();
    applyBrand({ is_default: true, product_name: "AG3" });
    expect(document.getElementById("brand-colors")).toBeNull();
    expect(document.title).toBe("Painel de Parcerias");
  });
});
