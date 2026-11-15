import { z } from "zod";
import { api } from "./client";

/** Mensalidade do cliente no Painel de Parcerias (plano de parceiros §13, D20). Datas em `aaaa-mm-dd`. */
const ref = z.object({ id: z.string(), name: z.string() });

const postponementSchema = z.object({
  kind: z.enum(["manual", "agreement"]),
  /** Nova data da suspensão. */
  until: z.string(),
  note: z.string(),
  /** Só no acordo: quando o cliente prometeu pagar. */
  promised_date: z.string().optional(),
  by_name: z.string().optional(),
  at: z.string().optional(),
});

const stateSchema = z.object({
  company: ref,
  /** Só para a equipe AG3 (clientes dos parceiros) e quando o cliente é de parceiro. */
  partner: ref.optional(),
  /** O vencimento já foi informado: o cliente está na rotina de avisos e suspensão. */
  enrolled: z.boolean(),
  auto_suspend: z.boolean(),
  suspended: z.boolean(),
  /** Suspenso pela rotina da mensalidade (pagamento ou adiamento reativam). */
  suspended_by_billing: z.boolean(),
  /** Uma frase que diz o que está acontecendo e o que vai acontecer. */
  summary: z.string(),
  due_date: z.string().optional(),
  amount_cents: z.number().optional(),
  status: z.enum(["ok", "due_soon", "overdue", "postponed"]).optional(),
  days_late: z.number().optional(),
  suspend_on: z.string().optional(),
  days_to_suspension: z.number().optional(),
  postponement: postponementSchema.optional(),
  notice_stage: z.string().optional(),
  last_paid_at: z.string().optional(),
});

const detailSchema = stateSchema.extend({
  timeline: z.array(
    z.object({ date: z.string(), kind: z.string(), label: z.string(), done: z.boolean() })
  ),
  history: z.array(
    z.object({
      at: z.string(),
      action: z.string(),
      description: z.string(),
      by_name: z.string().optional(),
    })
  ),
});

export type BillingState = z.infer<typeof stateSchema>;
export type BillingDetail = z.infer<typeof detailSchema>;
export type Postponement = z.infer<typeof postponementSchema>;

export type PostponeInput =
  | { kind: "manual"; until: string; note: string }
  | { kind: "agreement"; promised_date: string; note: string };

const detail = z.object({ data: detailSchema });
const url = (id: string) => `/partners/companies/${encodeURIComponent(id)}/billing`;

export const billingApi = {
  /** Clientes em atraso, a suspender primeiro. Parceiro: os dele; equipe AG3: todos, com o parceiro. */
  overdue: (limit = 200, offset = 0) =>
    api.get(
      "/partners/billing/overdue",
      z.object({ data: z.array(stateSchema), count: z.number() }),
      { limit, offset }
    ),

  get: async (id: string): Promise<BillingDetail> => (await api.get(url(id), detail)).data,

  /** Informa (ou corrige) o vencimento em aberto e o valor. */
  setSchedule: async (
    id: string,
    body: { due_date: string; amount_cents?: number | null }
  ): Promise<BillingDetail> => (await api.put(url(id), detail, body)).data,

  payment: async (id: string, note?: string): Promise<BillingDetail> =>
    (await api.post(`${url(id)}/payment`, detail, note?.trim() ? { note: note.trim() } : {})).data,

  postpone: async (id: string, body: PostponeInput): Promise<BillingDetail> =>
    (await api.post(`${url(id)}/postpone`, detail, { ...body, note: body.note.trim() })).data,

  cancelPostponement: async (id: string): Promise<BillingDetail> =>
    (await api.delete(`${url(id)}/postpone`, detail)).data,
};
