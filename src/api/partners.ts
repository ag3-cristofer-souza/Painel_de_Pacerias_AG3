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
  /** Planos que o contrato do parceiro permite dar aos clientes (só parceiro). */
  allowed_plans: z.array(z.object({ key: z.string(), name: z.string() })).optional(),
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
  /** Plano do catálogo (`essentials`, `pro`…); `name` é o nome dele. */
  key: z.string().optional(),
  name: z.string().optional(),
  status: z.string().optional(),
  users_limit: z.number().optional(),
  minutes_limit: z.number().optional(),
});

// ── alertas por cliente (`/partners/alerts`) ──
const alertSchema = z.object({
  id: z.string(),
  company_id: z.string(),
  company_name: z.string(),
  kind: z.string(),
  /** Nome do tipo ("Canal desconectado"); o texto do problema em si é `title`. */
  kind_label: z.string(),
  severity: z.enum(["warning", "danger"]),
  state: z.enum(["open", "acknowledged", "resolved"]),
  title: z.string(),
  opened_at: z.string(),
  last_seen_at: z.string(),
  acknowledged_at: z.string().optional(),
  acknowledged_by_name: z.string().optional(),
  resolved_at: z.string().optional(),
});

/** Pontuação de 0 a 100 (100 = nada aberto) e os alertas ativos do cliente. */
const healthSchema = z.object({ score: z.number(), alerts: z.number(), danger: z.number() });

// ── limites dos alertas (`/partners/alert-settings`, 6c) ──
const alertLimitSchema = z.object({
  key: z.string(),
  kind: z.string(),
  kind_label: z.string(),
  label: z.string(),
  unit: z.string(),
  value: z.number(),
  default: z.number(),
  min: z.number(),
  max: z.number(),
});
const alertSettingsSchema = z.object({
  /** Dono e admin do parceiro mudam; os demais (e a equipe AG3, com os padrões) só leem. */
  editable: z.boolean(),
  limits: z.array(alertLimitSchema),
  kinds: z.array(
    z.object({
      kind: z.string(),
      label: z.string(),
      enabled: z.boolean(),
      can_disable: z.boolean(),
    })
  ),
});

export type AlertLimit = z.infer<typeof alertLimitSchema>;
export type AlertSettings = z.infer<typeof alertSettingsSchema>;
export interface AlertSettingsInput {
  /** Só os que mudaram; o resto fica como está. */
  limits?: Record<string, number>;
  /** A lista inteira dos tipos desligados. */
  disabled?: string[];
}

export type Alert = z.infer<typeof alertSchema>;
export type Health = z.infer<typeof healthSchema>;

const portfolioCompanySchema = z.object({
  id: z.string(),
  name: z.string(),
  created_at: z.string(),
  plan: planSchema,
  usage: usageSchema,
  /** Passos iniciais do plano já feitos pelo cliente (implantação). Ausente se o servidor não conseguiu contar. */
  onboarding: z.object({ done: z.number(), total: z.number() }).optional(),
  health: healthSchema.optional(),
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
  /** Alertas ativos do cliente (abertos e já vistos). */
  alerts: z.array(alertSchema).optional(),
  /** Painel do cliente já nesta empresa ("Entrar no workspace"); só vem para quem entra nela como admin. */
  enter_url: z.string().url().optional(),
});

export type Usage = z.infer<typeof usageSchema>;
export type Plan = z.infer<typeof planSchema>;
export type PortfolioCompany = z.infer<typeof portfolioCompanySchema>;
export type CompanyDetail = z.infer<typeof companyDetailSchema>;

export interface PortfolioQuery {
  search?: string;
  limit?: number;
  offset?: number;
  /** `health`: pior saúde primeiro; `name`: ordem alfabética. */
  sort?: "health" | "name";
}

export const partnersApi = {
  me: async (): Promise<Panel> =>
    (await api.get("/partners/me", z.object({ data: panelSchema }))).data,

  /** Clientes do parceiro; para a equipe AG3, os clientes diretos (sem parceiro). */
  portfolio: async ({ search, limit = 50, offset = 0, sort }: PortfolioQuery = {}) => {
    const params: Record<string, unknown> = { limit, offset };
    if (sort) params.sort = sort;
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

  /** Troca o plano do cliente por outro do contrato (dono ou admin do parceiro). Fica no histórico da empresa. */
  setCompanyPlan: async (id: string, planKey: string): Promise<PortfolioCompany> =>
    (
      await api.patch(
        `/partners/companies/${encodeURIComponent(id)}`,
        z.object({ data: portfolioCompanySchema }),
        { plan_key: planKey }
      )
    ).data,
};

// ── novo workspace e equipe do parceiro ──
const memberSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  full_name: z.string(),
  email: z.string(),
  role: z.string(),
  is_active: z.boolean(),
  created_at: z.string(),
});

export type Member = z.infer<typeof memberSchema>;
export type MemberRole = "owner" | "admin" | "support" | "viewer";

export interface WorkspaceInput {
  name: string;
  cnpj?: string;
  admin_name: string;
  admin_email: string;
  /** Um dos `allowed_plans` do painel; sem ele, o servidor usa o primeiro do contrato. */
  plan_key?: string;
}

export const workspaceApi = {
  /** Cliente novo do parceiro, dentro do limite do contrato, com o primeiro admin convidado por e-mail. */
  create: async (input: WorkspaceInput): Promise<PortfolioCompany> => {
    const body: Record<string, string> = {
      name: input.name.trim(),
      admin_name: input.admin_name.trim(),
      admin_email: input.admin_email.trim().toLowerCase(),
    };
    if (input.cnpj?.trim()) body.cnpj = input.cnpj.trim();
    if (input.plan_key) body.plan_key = input.plan_key;
    return (await api.post("/partners/companies", z.object({ data: portfolioCompanySchema }), body))
      .data;
  },
};

export const teamApi = {
  list: async (): Promise<Member[]> =>
    (await api.get("/partners/team", z.object({ data: z.array(memberSchema) }))).data,

  /** Só pessoa nova: a conta nasce sem senha e recebe o convite por e-mail. */
  invite: async (input: { full_name: string; email: string; role: MemberRole }): Promise<Member> =>
    (
      await api.post("/partners/team", z.object({ data: memberSchema }), {
        full_name: input.full_name.trim(),
        email: input.email.trim().toLowerCase(),
        role: input.role,
      })
    ).data,

  update: async (id: string, change: { role?: MemberRole; is_active?: boolean }): Promise<Member> =>
    (
      await api.patch(
        `/partners/team/${encodeURIComponent(id)}`,
        z.object({ data: memberSchema }),
        change
      )
    ).data,

  /** Tira da equipe sem apagar a conta: a pessoa perde o acesso aos clientes e ao painel. */
  remove: async (id: string): Promise<void> => {
    await api.delete(
      `/partners/team/${encodeURIComponent(id)}`,
      z.object({ success: z.boolean() })
    );
  },
};

export const alertsApi = {
  /** Da carteira de quem pede: ativos (pior primeiro) ou resolvidos (mais recentes primeiro). */
  list: async ({
    state = "active",
    companyId,
  }: { state?: "active" | "resolved"; companyId?: string } = {}) => {
    const params: Record<string, unknown> = { state, limit: 200 };
    if (companyId) params.company_id = companyId;
    return api.get(
      "/partners/alerts",
      z.object({ data: z.array(alertSchema), count: z.number() }),
      params
    );
  },

  /** Limites e tipos ligados, para todos os clientes do parceiro. */
  settings: async (): Promise<AlertSettings> =>
    (await api.get("/partners/alert-settings", z.object({ data: alertSettingsSchema }))).data,

  saveSettings: async (input: AlertSettingsInput): Promise<AlertSettings> =>
    (await api.patch("/partners/alert-settings", z.object({ data: alertSettingsSchema }), input))
      .data,

  /** "Já vi": continua na lista até o problema acabar, com peso menor na saúde. */
  acknowledge: async (id: string): Promise<Alert> =>
    (
      await api.post(
        `/partners/alerts/${encodeURIComponent(id)}/acknowledge`,
        z.object({ data: alertSchema })
      )
    ).data,
};
