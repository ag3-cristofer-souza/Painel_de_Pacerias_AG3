import { z } from "zod";
import { api } from "./client";

/**
 * Auditoria no Painel de Parcerias (plano de parceiros 14.4 a 14.6, D27 e D28; passo 9, 11d; backend
 * `apps/partners/views_audit.py`, adendo lf). Duas fontes: `clients` (o que acontece nos clientes) e `partner` (o
 * histórico do próprio parceiro). Só o dono e os administradores do parceiro, e a equipe AG3. Para a equipe AG3, o
 * "antes e depois" de um workspace só vem com acesso de suporte aberto nele (`changes_hidden`).
 */
const refSchema = z.object({ id: z.string(), name: z.string() });
const eventSchema = z.object({
  id: z.string(),
  source: z.string(),
  created_at: z.string(),
  actor: z.object({ id: z.string().nullable(), name: z.string() }),
  actor_partner: z.string().optional(),
  origin: z.string(), // client, partner, support ou system
  origin_label: z.string(),
  action_type: z.string(),
  action_label: z.string(),
  entity_type: z.string(),
  entity_label: z.string(),
  entity_id: z.string().nullable(),
  display_name: z.string(),
  changes: z.array(
    z.object({ field: z.string(), old_display: z.string(), new_display: z.string() })
  ),
  changes_hidden: z.boolean(),
  company: refSchema.optional(),
  ticket_id: z.string().nullable().optional(),
  partner: refSchema.optional(),
  ip: z.string().optional(),
  system_label: z.string().optional(),
});
const listSchema = z.object({
  data: z.array(eventSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
});

export type AuditEvent = z.infer<typeof eventSchema>;
export type AuditList = z.infer<typeof listSchema>;
export type AuditSource = "clients" | "partner";
export interface AuditFilters {
  source: AuditSource;
  company_id?: string;
  origin?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
}
export const AUDIT_PAGE_SIZE = 50;

function params(filters: AuditFilters): Record<string, unknown> {
  const out: Record<string, unknown> = { source: filters.source };
  for (const key of ["company_id", "origin", "date_from", "date_to"] as const) {
    if (filters[key]) out[key] = filters[key];
  }
  return out;
}

export const auditApi = {
  list: (filters: AuditFilters): Promise<AuditList> =>
    api.get("/partners/audit", listSchema, {
      ...params(filters),
      page: filters.page ?? 1,
      limit: AUDIT_PAGE_SIZE,
    }),

  /** CSV com os mesmos filtros (até 10.000 linhas); a exportação vira evento no histórico do parceiro. */
  export: (filters: AuditFilters): Promise<Blob> =>
    api.download("/partners/audit/export", params(filters)),
};
