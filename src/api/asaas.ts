import { z } from "zod";
import { api } from "./client";

/**
 * Cobrança pelo Asaas de um cliente — só a equipe AG3 (adendo kn). Quando o Asaas não avisa um pagamento, o
 * suporte ou o financeiro confere no Asaas na hora ou ativa à mão, com motivo.
 */
const subscriptionSchema = z.object({
  id: z.string(),
  kind: z.string(),
  plan_key: z.string().nullable(),
  status: z.string(),
  value_cents: z.number().nullable(),
  method: z.string().nullable(),
  external_id: z.string().nullable(),
  invoice_url: z.string().nullable(),
  next_due_date: z.string().nullable(),
  created_at: z.string().nullable(),
  activated_at: z.string().nullable(),
  canceled_at: z.string().nullable(),
});

const paymentSchema = z.object({
  external_id: z.string(),
  description: z.string().nullable(),
  amount_cents: z.number().nullable(),
  status: z.string().nullable(),
  method: z.string().nullable(),
  invoice_url: z.string().nullable(),
  due: z.string().nullable(),
  updated_at: z.string().nullable(),
});

/** Nota fiscal (B18, adendo ks): uma por pagamento. `REQUESTED` = pedida e ainda não criada no Asaas. */
const invoiceSchema = z.object({
  external_id: z.string().nullable(),
  payment: z.string().nullable(),
  status: z.string(),
  number: z.string().nullable(),
  pdf_url: z.string().nullable(),
  error: z.string().nullable(),
  value_cents: z.number(),
  created_at: z.string(),
});

const nfseSchema = z.object({
  state: z.enum(["off", "incomplete", "on"]),
  missing: z.array(z.string()),
  invoices: z.array(invoiceSchema),
  fiscal: z.object({
    required: z.boolean(),
    complete: z.boolean(),
    postal_code: z.string().optional(),
    address_number: z.string().optional(),
    complement: z.string().optional(),
  }),
});

const overviewSchema = z.object({
  environment: z.string(),
  configured: z.boolean(),
  subscriptions: z.array(subscriptionSchema),
  payments: z.array(paymentSchema),
  manual_activations: z.array(
    z.object({
      at: z.string(),
      by: z.string().nullable(),
      by_name: z.string(),
      description: z.string(),
    })
  ),
  /** Falso = cliente atual, cobrado à mão pela equipe (adendo ks). Opcionais: backend anterior não manda. */
  automatic: z.boolean().optional(),
  nfse: nfseSchema.optional(),
});

export type AsaasOverview = z.infer<typeof overviewSchema>;
export type AsaasSubscription = z.infer<typeof subscriptionSchema>;
export type AsaasNfse = z.infer<typeof nfseSchema>;

const url = (id: string) => `/partners/companies/${id}/asaas`;

export const asaasApi = {
  get: async (id: string): Promise<AsaasOverview> =>
    (await api.get(url(id), z.object({ data: overviewSchema }))).data,

  /** Confere no Asaas agora; devolve quantas assinaturas pagas foram ativadas. */
  sync: async (id: string): Promise<{ data: AsaasOverview; activated: number }> =>
    api.post(`${url(id)}/sync`, z.object({ data: overviewSchema, activated: z.number() }), {}),

  activate: async (id: string, subscriptionId: string, reason: string): Promise<AsaasOverview> =>
    (
      await api.post(`${url(id)}/activate`, z.object({ data: overviewSchema }), {
        subscription_id: subscriptionId,
        reason,
      })
    ).data,
};
