import { z } from "zod";
import { api } from "./client";

/**
 * Chamados no Painel de Parcerias (plano de parceiros 5.1 a 5.3; passo 8a; backend `apps/support`, adendos kl, km, kv e
 * la). O parceiro vê o N1 dos clientes dele; a equipe AG3, o N1 dos clientes diretos e os níveis dela para baixo (D7).
 * Quem atende responde ao cliente ou escreve nota interna; a equipe AG3 tem ainda a nota só dela, devolve o chamado e
 * abre o acesso de suporte ao workspace (D14).
 */
const personSchema = z.object({ id: z.string().nullable(), name: z.string() });
const attachmentSchema = z.object({
  key: z.string(),
  name: z.string(),
  content_type: z.string().optional(),
  size: z.number().optional(),
  url: z.string().optional(),
});
const authorSchema = z.object({
  side: z.string(), // client, partner, ag3 ou system
  id: z.string().nullable(),
  name: z.string(),
});

const ticketSchema = z.object({
  id: z.string(),
  number: z.number(),
  subject: z.string(),
  category: z.object({ key: z.string(), name: z.string() }),
  status: z.string(),
  status_label: z.string(),
  opened_by: personSchema.nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  last_message_at: z.string().nullable(),
  resolved_at: z.string().nullable(),
  rating: z.object({ score: z.number(), comment: z.string(), rated_at: z.string() }).optional(),
  company: z.object({ id: z.string(), name: z.string() }),
  /** Dono atual do cliente; vazio = cliente direto. */
  partner: z.object({ id: z.string(), name: z.string() }).nullable(),
  priority: z.string(),
  level: z.string(),
  assignee: personSchema.nullable(),
  first_response_at: z.string().nullable(),
  issue_url: z.string().nullable(),
  /** Quem vê pode atender (responder ao cliente, mudar, escalar) neste nível. */
  can_attend: z.boolean(),
  sla: z.object({
    first_response_due_at: z.string().nullable(),
    resolution_due_at: z.string().nullable(),
    paused: z.boolean(),
    first_response_breached: z.boolean(),
    resolution_breached: z.boolean(),
  }),
});

const messageSchema = z.object({
  id: z.string(),
  body: z.string(),
  visibility: z.string(), // public, internal ou ag3
  author: authorSchema,
  attachments: z.array(attachmentSchema),
  created_at: z.string(),
});

const eventSchema = z.object({
  id: z.string(),
  kind: z.string(),
  from_value: z.string().nullable(),
  to_value: z.string().nullable(),
  reason: z.string().nullable(),
  actor: authorSchema,
  created_at: z.string(),
});

const accessSchema = z.object({
  id: z.string(),
  ticket_id: z.string(),
  company_id: z.string(),
  opened_at: z.string(),
  expires_at: z.string(),
  renewals: z.number(),
  ended_at: z.string().nullable(),
  end_reason: z.string().nullable(),
  enter_url: z.string().optional(),
});

const detailSchema = ticketSchema.extend({
  messages: z.array(messageSchema),
  events: z.array(eventSchema),
  /** Só para a equipe AG3, com o acesso dela valendo. */
  support_access: accessSchema.optional(),
});

const listSchema = z.object({
  data: z.array(ticketSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
});

export type Ticket = z.infer<typeof ticketSchema>;
export type TicketDetail = z.infer<typeof detailSchema>;
export type TicketMessage = z.infer<typeof messageSchema>;
export type TicketEvent = z.infer<typeof eventSchema>;
export type TicketAttachment = z.infer<typeof attachmentSchema>;
export type SupportAccess = z.infer<typeof accessSchema>;
export type TicketList = z.infer<typeof listSchema>;
export type Visibility = "public" | "internal" | "ag3";

export interface TicketFilters {
  /** `open` = todas as situações em aberto; vazio = todas. */
  status?: string;
  level?: string;
  /** `me`, `none` ou o id da pessoa. */
  assignee?: string;
  company_id?: string;
  category?: string;
  q?: string;
  page?: number;
}

export interface TicketChange {
  status?: string;
  priority?: string;
  assignee_id?: string | null;
  issue_url?: string | null;
}

const one = <T extends z.ZodType>(schema: T) => z.object({ data: schema });
const path = (id: string, rest = "") =>
  `/partners/support/tickets/${encodeURIComponent(id)}${rest}`;

export const PAGE_SIZE = 20;

const assigneeOptionSchema = z.object({ id: z.string(), name: z.string(), current: z.boolean() });
export type AssigneeOption = z.infer<typeof assigneeOptionSchema>;

export const supportApi = {
  /** Para quem transferir o responsável no nível atual (26/11, adendo lh); a transferência é o `update`. */
  assignees: async (id: string): Promise<AssigneeOption[]> =>
    (await api.get(path(id, "/assignees"), one(z.array(assigneeOptionSchema)))).data,

  categories: async () =>
    (
      await api.get(
        "/partners/support/categories",
        one(z.array(z.object({ key: z.string(), name: z.string() })))
      )
    ).data,

  list: async (filters: TicketFilters = {}): Promise<TicketList> => {
    const params: Record<string, unknown> = { page: filters.page ?? 1, limit: PAGE_SIZE };
    for (const key of ["status", "level", "assignee", "company_id", "category"] as const) {
      if (filters[key]) params[key] = filters[key];
    }
    if (filters.q?.trim()) params.q = filters.q.trim();
    return api.get("/partners/support/tickets", listSchema, params);
  },

  get: async (id: string): Promise<TicketDetail> =>
    (await api.get(path(id), one(detailSchema))).data,

  /** Situação, prioridade, responsável e a issue (N3). Só quem atende neste nível. */
  update: async (id: string, change: TicketChange): Promise<TicketDetail> =>
    (await api.patch(path(id), one(detailSchema), change)).data,

  /** Resposta ao cliente ou nota; com anexos, vai em formulário (até 5, de 10 MB). */
  reply: async (
    id: string,
    input: { body: string; visibility: Visibility; files?: File[] }
  ): Promise<TicketMessage> => {
    const files = input.files ?? [];
    if (files.length === 0) {
      return (
        await api.post(path(id, "/messages"), one(messageSchema), {
          body: input.body,
          visibility: input.visibility,
        })
      ).data;
    }
    const form = new FormData();
    form.append("body", input.body);
    form.append("visibility", input.visibility);
    for (const f of files) form.append("files", f);
    return (await api.upload(path(id, "/messages"), one(messageSchema), form)).data;
  },

  escalate: async (id: string, reason: string): Promise<TicketDetail> =>
    (await api.post(path(id, "/escalate"), one(detailSchema), { reason })).data,

  /** Só a equipe AG3: devolve um nível (o N2 ao N1, o N3 ao N2). */
  returnDown: async (id: string, reason: string): Promise<TicketDetail> =>
    (await api.post(path(id, "/return"), one(detailSchema), { reason })).data,

  /** Equipe AG3: abre (ou renova por mais 24 h) o acesso de suporte ao workspace, só leitura. */
  openAccess: async (id: string): Promise<SupportAccess> =>
    (await api.post(path(id, "/access"), one(accessSchema))).data,

  closeAccess: async (id: string): Promise<SupportAccess> =>
    (await api.delete(path(id, "/access"), one(accessSchema))).data,
};
