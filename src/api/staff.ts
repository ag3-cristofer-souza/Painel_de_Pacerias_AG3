import { z } from "zod";
import { api } from "./client";

/** Visão AG3 (adendo lz): o dashboard do Django Admin, só para a equipe AG3. `health` só vem para N2/N3 e o admin global. */

const num = z.number();
const text = z.union([z.string(), z.number()]).transform(String);

const block = <T extends z.ZodTypeAny>(data: T) =>
  z.union([
    z.object({ ok: z.literal(true), ms: num, data }),
    z.object({ ok: z.literal(false), ms: num, error: z.string() }),
  ]);

const checkSchema = z.object({
  name: z.string(),
  status: z.string(),
  value: z.string(),
  detail: z.string(),
});

const healthSchema = z.object({
  overall: z.string(),
  counts: z.record(z.string(), num),
  version: z.string(),
  groups: z.array(z.object({ group: z.string(), checks: z.array(checkSchema) })),
  queues: z.array(
    z.object({
      name: z.string(),
      exists: z.boolean(),
      messages: num,
      consumers: num,
      dead: num,
      status: z.string(),
    })
  ),
});

const overviewSchema = z.object({
  companies: z.object({ total: num, suspended: num, new_month: num, new_week: num }),
  users: z.object({
    active: num,
    superusers: num,
    online: num,
    active_24h: num,
    online_by_system: z.array(z.object({ system: z.string(), count: num })),
  }),
  traffic: z.object({ inbound: text, outbound: text, failed: text, measured: z.boolean() }),
  instances: z.object({ total: num, connected: num, disconnected: num }),
  by_provider: z.array(z.object({ provider: z.string().nullable(), total: num, connected: num })),
  down: z.array(
    z.object({
      company_id: z.string(),
      company: z.string(),
      name: z.string().nullable(),
      provider: z.string(),
      status: z.string(),
      number: z.string(),
      direct: z.boolean(),
    })
  ),
  meta: z.object({ total: num, blocked: num, limited: num, red: num, token_expiring: num }),
  meta_problems: z.array(
    z.object({
      company_id: z.string(),
      company: z.string(),
      number: z.string().nullable(),
      situacao: z.string(),
      quality: z.string(),
      token: z.string().nullable(),
      direct: z.boolean(),
    })
  ),
  cost: z.array(z.object({ currency: z.string(), value: num })),
  audio_minutes: num,
  snapshot_ago: z.string().nullable(),
});

const partnersSchema = z.object({
  auto_suspend: z.boolean(),
  grace_days: num,
  partners_active: num,
  clients_partner: num,
  clients_direct: num,
  staff: z.array(z.object({ level: z.string(), count: num })),
  partners: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      status: z.string(),
      clients: num,
      max: num.nullable(),
      full: z.boolean(),
      members: num,
      late: num,
      last_access_ago: z.string(),
    })
  ),
  billing: z.object({
    enrolled: num,
    due_soon: num,
    overdue: num,
    postponed: num,
    suspended: num,
    partner_clients_without: num,
  }),
  late: z.array(
    z.object({
      company_id: z.string(),
      company: z.string(),
      partner: z.string(),
      due_date: z.string(),
      days_late: num,
      suspend_on: z.string(),
      days_to_suspension: num,
      postponed: z.boolean(),
      suspended: z.boolean(),
      direct: z.boolean(),
    })
  ),
});

const onboardingSchema = z.object({
  days: num,
  steps_total: num,
  stuck: num,
  complete: num,
  has_snapshot: z.boolean(),
  rows: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      created_at: z.string(),
      age_days: num,
      partner: z.string(),
      suspended: z.boolean(),
      users: num,
      logged: num,
      channels: num,
      connected: num,
      meta: num,
      assistants: num,
      conversations: num,
      steps: z.array(z.object({ label: z.string(), done: z.boolean() })),
      next: z.string().nullable(),
      direct: z.boolean(),
    })
  ),
  stalled: z.array(
    z.object({ id: z.string(), name: z.string(), created_at: z.string(), direct: z.boolean() })
  ),
});

const dashboardSchema = z.object({
  generated_at: z.string(),
  ms: num,
  health: healthSchema.optional(),
  overview: block(overviewSchema),
  partners: block(partnersSchema),
  onboarding: block(onboardingSchema),
});

export type StaffDashboard = z.infer<typeof dashboardSchema>;
export type DashboardHealth = z.infer<typeof healthSchema>;
export type DashboardOverview = z.infer<typeof overviewSchema>;
export type DashboardPartners = z.infer<typeof partnersSchema>;
export type DashboardOnboarding = z.infer<typeof onboardingSchema>;

export const staffApi = {
  /** `refresh`: refaz agora em vez de usar o retrato de até 1 minuto. */
  dashboard: async (refresh = false): Promise<StaffDashboard> =>
    (
      await api.get(
        "/partners/staff/dashboard",
        z.object({ data: dashboardSchema }),
        refresh ? { atualizar: true } : undefined
      )
    ).data,
};
