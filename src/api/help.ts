import { z } from "zod";
import { api } from "./client";

/** Artigos de ajuda (onda 9, ONB-04): os do parceiro, que só os clientes dele leem, e os gerais, que todos leem. */
const articleSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  category: z.string(),
  category_label: z.string(),
  status: z.enum(["draft", "published"]),
  position: z.number(),
  source: z.enum(["general", "partner"]),
  published_at: z.string().optional(),
  updated_at: z.string(),
  body: z.string().optional(),
  editable: z.boolean().optional(),
});

const listSchema = z.object({
  data: z.array(articleSchema),
  categories: z.array(z.object({ key: z.string(), label: z.string() })),
  can_write: z.boolean().optional(),
});

const one = z.object({ data: articleSchema });

export type Article = z.infer<typeof articleSchema>;
export type ArticleList = z.infer<typeof listSchema>;
export interface ArticleInput {
  title: string;
  summary: string;
  body: string;
  category: string;
  status: "draft" | "published";
  position: number;
}

export const helpApi = {
  list: async (q?: string): Promise<ArticleList> =>
    api.get("/partners/help-articles", listSchema, q ? { q } : undefined),
  get: async (id: string): Promise<Article> =>
    (await api.get(`/partners/help-articles/${id}`, one)).data,
  create: async (input: ArticleInput): Promise<Article> =>
    (await api.post("/partners/help-articles", one, input)).data,
  update: async (id: string, input: Partial<ArticleInput>): Promise<Article> =>
    (await api.put(`/partners/help-articles/${id}`, one, input)).data,
  remove: async (id: string): Promise<void> => {
    await api.delete(`/partners/help-articles/${id}`, z.object({ deleted: z.boolean() }));
  },
};
