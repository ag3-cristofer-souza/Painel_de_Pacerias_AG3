import { z } from "zod";
import { api } from "./client";

/**
 * Relatórios de SLA do Painel de Parcerias (plano de parceiros 5.3; passo 8b; backend
 * `apps/support/services/reports.py`, adendo le). Conta os chamados abertos no período. O parceiro vê os dele, com
 * qualquer papel; a equipe AG3 vê todos e agrupa também por parceiro. Sem dado, a chave não vem.
 */
const metricsSchema = z.object({
  opened: z.number(),
  resolved: z.number(),
  open: z.number(),
  escalated: z.number(),
  returned: z.number(),
  reopened: z.number(),
  csat_count: z.number(),
  first_response_on_time_pct: z.number().optional(),
  resolution_on_time_pct: z.number().optional(),
  first_response_avg_hours: z.number().optional(),
  resolution_avg_hours: z.number().optional(),
  csat_avg: z.number().optional(),
});
const groupSchema = metricsSchema.extend({ key: z.string(), label: z.string() });
const reportSchema = z.object({
  start: z.string(),
  end: z.string(),
  group_by: z.string(),
  totals: metricsSchema,
  groups: z.array(groupSchema),
});

export type ReportMetrics = z.infer<typeof metricsSchema>;
export type ReportGroup = z.infer<typeof groupSchema>;
export type Report = z.infer<typeof reportSchema>;
export type GroupBy = "level" | "assignee" | "category" | "company" | "partner";
export interface ReportFilters {
  start?: string;
  end?: string;
  group_by: GroupBy;
}

export const reportsApi = {
  sla: async (filters: ReportFilters): Promise<Report> => {
    const params: Record<string, unknown> = { group_by: filters.group_by };
    if (filters.start) params.start = filters.start;
    if (filters.end) params.end = filters.end;
    return (await api.get("/partners/support/reports", z.object({ data: reportSchema }), params))
      .data;
  },
};
