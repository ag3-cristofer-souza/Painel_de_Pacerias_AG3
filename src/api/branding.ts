import { z } from "zod";
import { api } from "./client";

/** Marca pública (`GET /branding`, sem login): só o que o servidor libera antes de entrar. */
const publicBrandSchema = z.object({
  is_default: z.boolean(),
  product_name: z.string(),
  slug: z.string().optional(),
  color_primary: z.string().optional(),
  color_primary_dark: z.string().optional(),
  /** Logo para fundo claro. */
  logo_light: z.string().optional(),
  /** Logo para fundo escuro (a tela de entrada e o menu). */
  logo_dark: z.string().optional(),
  favicon: z.string().optional(),
  app_icon: z.string().optional(),
  support_email: z.string().optional(),
  support_phone: z.string().optional(),
  support_url: z.string().optional(),
  terms_url: z.string().optional(),
  privacy_url: z.string().optional(),
});

const panelBrandSchema = publicBrandSchema.extend({
  /** Dono e admin do parceiro editam; os demais veem. */
  editable: z.boolean(),
  /** A marca vale quando tem endereço e nome do produto. */
  active: z.boolean(),
  product_name: z.string().optional(),
  addresses: z.object({ painel: z.string(), mobile: z.string(), suporte: z.string() }).optional(),
  /** Domínio próprio (onda 8): pedido até a AG3 ativar na Cloudflare. */
  custom_domain: z
    .object({
      domain: z.string(),
      status: z.enum(["pending", "active"]),
      cname_target: z.string(),
      addresses: z.object({ painel: z.string(), mobile: z.string(), suporte: z.string() }),
    })
    .optional(),
});

export type PublicBrand = z.infer<typeof publicBrandSchema>;
export type PanelBrand = z.infer<typeof panelBrandSchema>;
export type BrandAssetKind = "logo_light" | "logo_dark" | "favicon" | "app_icon";
export type BrandInput = Partial<
  Record<
    | "slug"
    | "product_name"
    | "color_primary"
    | "color_primary_dark"
    | "support_email"
    | "support_phone"
    | "support_url"
    | "terms_url"
    | "privacy_url"
    | "custom_domain",
    string
  >
>;

const one = z.object({ data: panelBrandSchema });

export const brandingApi = {
  /** A marca do endereço desta tela (`<slug>-suporte.ag3system.com`). */
  byHost: async (host: string): Promise<PublicBrand> =>
    (await api.get("/branding", z.object({ data: publicBrandSchema }), { host })).data,
};

export const brandApi = {
  get: async (): Promise<PanelBrand> => (await api.get("/partners/brand", one)).data,

  /** Campo vazio apaga; o que não vier fica como está. */
  save: async (input: BrandInput): Promise<PanelBrand> =>
    (await api.patch("/partners/brand", one, input)).data,

  upload: async (kind: BrandAssetKind, file: File): Promise<PanelBrand> => {
    const form = new FormData();
    form.append("file", file);
    return (await api.post(`/partners/brand/assets/${kind}`, one, form)).data;
  },

  remove: async (kind: BrandAssetKind): Promise<PanelBrand> =>
    (await api.delete(`/partners/brand/assets/${kind}`, one)).data,
};
