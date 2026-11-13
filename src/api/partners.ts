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

export const partnersApi = {
  me: async (): Promise<Panel> =>
    (await api.get("/partners/me", z.object({ data: panelSchema }))).data,
};
