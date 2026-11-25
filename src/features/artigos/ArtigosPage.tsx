import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, CirclePlus, Loader2, Search } from "lucide-react";
import { useState, type FormEvent } from "react";
import { helpApi, type Article, type ArticleInput } from "@/api/help";
import { usePanel } from "@/features/auth/AuthProvider";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { EmptyState, ErrorText } from "@/ui/feedback";
import { Field } from "@/ui/field";
import { PageHeader } from "@/ui/page";
import { ArticleTextEditor } from "./ArticleTextEditor";

const EMPTY: ArticleInput = {
  title: "",
  summary: "",
  body: "",
  category: "geral",
  status: "draft",
  position: 0,
};

type Mode = { kind: "list" } | { kind: "new" } | { kind: "edit"; id: string };

/** Artigos de ajuda (onda 9): o parceiro escreve os dele; os gerais aparecem só para consulta. */
export function ArtigosPage() {
  const panel = usePanel();
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const list = useQuery({ queryKey: ["help-articles", q], queryFn: () => helpApi.list(q) });

  if (mode.kind !== "list") {
    return (
      <Editor
        id={mode.kind === "edit" ? mode.id : null}
        categories={list.data?.categories ?? []}
        onClose={() => setMode({ kind: "list" })}
      />
    );
  }

  const canWrite = list.data?.can_write ?? false;
  return (
    <>
      <PageHeader title="Artigos de ajuda">
        {panel.kind === "ag3"
          ? "Os artigos gerais aparecem para todos os clientes, diretos e de parceiros. Não cite a marca: os clientes dos parceiros também leem."
          : "Seus artigos aparecem só para os seus clientes, no menu Ajuda, junto com os artigos gerais."}
      </PageHeader>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <Field
            label="Buscar"
            leading={<Search />}
            value={q}
            maxLength={100}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        {canWrite && (
          <Button onClick={() => setMode({ kind: "new" })}>
            <CirclePlus aria-hidden="true" />
            Novo artigo
          </Button>
        )}
      </div>
      {list.isPending ? (
        <div className="surface flex justify-center p-10" role="status">
          <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
          <span className="sr-only">Carregando artigos</span>
        </div>
      ) : list.isError ? (
        <ErrorText>{list.error.message}</ErrorText>
      ) : list.data.data.length === 0 ? (
        <div className="surface">
          <EmptyState icon={BookOpen} title="Nenhum artigo">
            {q ? "Nada com essa busca." : "Escreva o primeiro com o passo a passo de uma tela."}
          </EmptyState>
        </div>
      ) : (
        <ul className="surface divide-y divide-border">
          {list.data.data.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => setMode({ kind: "edit", id: a.id })}
                className="flex min-h-14 w-full flex-wrap items-center gap-2 px-4 py-3 text-left hover:bg-muted/50"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-medium break-words">{a.title}</span>
                  <span className="block text-xs text-muted-foreground">{a.category_label}</span>
                </span>
                {a.source === "general" && panel.kind === "partner" && <Badge>Geral</Badge>}
                <Badge tone={a.status === "published" ? "success" : "warning"}>
                  {a.status === "published" ? "Publicado" : "Rascunho"}
                </Badge>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Editor({
  id,
  categories,
  onClose,
}: {
  id: string | null;
  categories: { key: string; label: string }[];
  onClose: () => void;
}) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["help-article", id],
    queryFn: () => helpApi.get(id as string),
    enabled: !!id,
  });
  const [draft, setDraft] = useState<ArticleInput | null>(id ? null : EMPTY);
  const article: Article | undefined = query.data;
  if (id && article && draft === null) {
    setDraft({
      title: article.title,
      summary: article.summary,
      body: article.body ?? "",
      category: article.category,
      status: article.status,
      position: article.position,
    });
  }
  const editable = id ? (article?.editable ?? false) : true;
  const done = () => {
    void client.invalidateQueries({ queryKey: ["help-articles"] });
    onClose();
  };
  const save = useMutation({
    mutationFn: (d: ArticleInput) => (id ? helpApi.update(id, d) : helpApi.create(d)),
    onSuccess: done,
  });
  const remove = useMutation({ mutationFn: () => helpApi.remove(id as string), onSuccess: done });

  const back = (
    <button
      type="button"
      onClick={onClose}
      className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      Artigos
    </button>
  );
  if (id && query.isError) {
    return (
      <>
        {back}
        <ErrorText>{query.error.message}</ErrorText>
      </>
    );
  }
  if (draft === null) {
    return (
      <>
        {back}
        <div className="surface flex justify-center p-10" role="status">
          <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
          <span className="sr-only">Carregando artigo</span>
        </div>
      </>
    );
  }
  const set = (patch: Partial<ArticleInput>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(draft);
  };

  return (
    <>
      {back}
      <PageHeader title={id ? (editable ? "Editar artigo" : draft.title) : "Novo artigo"}>
        {editable
          ? "Use a barra do texto para títulos, listas, dicas, links e imagens. Ao lado (ou na aba “Ver como o cliente”), o artigo como o cliente vê."
          : "Artigo geral: aparece para os seus clientes também, mas só quem o escreveu altera."}
      </PageHeader>
      <form onSubmit={submit} className="surface space-y-4 p-5">
        <Field
          label="Título"
          required
          minLength={3}
          maxLength={140}
          disabled={!editable}
          value={draft.title}
          onChange={(e) => set({ title: e.target.value })}
        />
        <Field
          label="Resumo (opcional)"
          maxLength={280}
          disabled={!editable}
          value={draft.summary}
          onChange={(e) => set({ summary: e.target.value })}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label htmlFor="artigo-categoria" className="block text-sm font-medium">
              Categoria
            </label>
            <select
              id="artigo-categoria"
              className="min-h-12 w-full rounded-xl border border-input bg-background px-3.5 text-base"
              disabled={!editable}
              value={draft.category}
              onChange={(e) => set({ category: e.target.value })}
            >
              {categories.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <Field
            label="Ordem na categoria"
            type="number"
            min={0}
            max={9999}
            disabled={!editable}
            value={String(draft.position)}
            onChange={(e) => set({ position: Number(e.target.value) || 0 })}
          />
          <label className="flex min-h-12 items-center gap-3 self-end rounded-xl border border-input px-3.5 text-sm">
            <input
              type="checkbox"
              className="size-5 accent-primary"
              disabled={!editable}
              checked={draft.status === "published"}
              onChange={(e) => set({ status: e.target.checked ? "published" : "draft" })}
            />
            Publicado
          </label>
        </div>
        <ArticleTextEditor
          value={draft.body}
          disabled={!editable}
          onChange={(body) => set({ body })}
        />
        {save.isError && <ErrorText>{save.error.message}</ErrorText>}
        {remove.isError && <ErrorText>{remove.error.message}</ErrorText>}
        {editable && (
          <div className="flex flex-wrap gap-3">
            <Button type="submit" loading={save.isPending}>
              {id ? "Salvar" : "Criar artigo"}
            </Button>
            {id && (
              <Button
                type="button"
                variant="destructive"
                loading={remove.isPending}
                onClick={() => {
                  if (window.confirm("Apagar este artigo? Os clientes deixam de vê-lo na hora.")) {
                    remove.mutate();
                  }
                }}
              >
                Apagar
              </Button>
            )}
          </div>
        )}
      </form>
    </>
  );
}
