import { z } from "zod";
import { api } from "./client";

const panelSchema = z.object({
  kind: z.enum(["partner", "ag3"]),
  user: z.object({ id: z.string(), email: z.string(), full_name: z.string() }),
  partner: z
    .object({
      id: z.string(),
      name: z.string(),
      status: z.string(),
      max_workspaces: z.number().optional(),
      workspaces_used: z.number(),
      support_email: z.string().optional(),
      support_phone: z.string().optional(),
    })
    .optional(),
  member_role: z.string().optional(),
  support_level: z.string().optional(),
  can_admin_workspaces: z.boolean(),
});

/** Quem está no painel e em nome de quem: um parceiro (com o papel) ou a equipe AG3 (com o nível). */
export type Panel = z.infer<typeof panelSchema>;

// ── carteira e cliente (`/partners/companies`) ──
const usageSchema = z.object({
  users_active: z.number(),
  channels: z.number(),
  meta_channels: z.number(),
  conversations: z.number(),
  /** Custo de IA e voz no mês, por moeda (`{"USD": 1.23}`). */
  usage_cost: z.record(z.string(), z.number()),
  usage_audio_seconds: z.number(),
});

const planSchema = z.object({
  name: z.string().optional(),
  status: z.string().optional(),
  users_limit: z.number().optional(),
  minutes_limit: z.number().optional(),
});

const portfolioCompanySchema = z.object({
  id: z.string(),
  name: z.string(),
  created_at: z.string(),
  plan: planSchema,
  usage: usageSchema,
});

const companyDetailSchema = portfolioCompanySchema.extend({
  /** Retrato de cada mês (o mais recente primeiro), até 12. */
  history: z.array(usageSchema.extend({ month: z.string() })),
  users: z.array(
    z.object({
      id: z.string(),
      full_name: z.string(),
      email: z.string(),
      role: z.string(),
      status: z.string().optional(),
    })
  ),
});

export type Usage = z.infer<typeof usageSchema>;
export type Plan = z.infer<typeof planSchema>;
export type PortfolioCompany = z.infer<typeof portfolioCompanySchema>;
export type CompanyDetail = z.infer<typeof companyDetailSchema>;

export interface PortfolioQuery {
  search?: string;
  limit?: number;
  offset?: number;
}

export const partnersApi = {
  me: async (): Promise<Panel> =>
    (await api.get("/partners/me", z.object({ data: panelSchema }))).data,

  /** Clientes do parceiro; para a equipe AG3, os clientes diretos (sem parceiro). */
  portfolio: async ({ search, limit = 50, offset = 0 }: PortfolioQuery = {}) => {
    const params: Record<string, unknown> = { limit, offset };
    if (search?.trim()) params.search = search.trim();
    return api.get(
      "/partners/companies",
      z.object({ data: z.array(portfolioCompanySchema), count: z.number() }),
      params
    );
  },

  company: async (id: string): Promise<CompanyDetail> =>
    (
      await api.get(
        `/partners/companies/${encodeURIComponent(id)}`,
        z.object({ data: companyDetailSchema })
      )
    ).data,

  /** Suspende ou reativa o cliente (dono ou admin do parceiro). O motivo vai para o histórico da empresa. */
  setCompanyStatus: async (
    id: string,
    status: "active" | "suspended",
    reason?: string
  ): Promise<PortfolioCompany> => {
    const body: Record<string, string> = { status };
    if (reason?.trim()) body.reason = reason.trim();
    return (
      await api.patch(
        `/partners/companies/${encodeURIComponent(id)}`,
        z.object({ data: portfolioCompanySchema }),
        body
      )
    ).data;
  },
};
