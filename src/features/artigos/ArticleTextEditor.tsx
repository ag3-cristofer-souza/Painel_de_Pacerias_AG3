import {
  Bold,
  Eye,
  Heading2,
  Heading3,
  ImagePlus,
  Lightbulb,
  Link,
  List,
  ListOrdered,
  Loader2,
  PencilLine,
  type LucideIcon,
} from "lucide-react";
import { useId, useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import { ApiError } from "@/api/client";
import { helpApi } from "@/api/help";
import { cn } from "@/lib/utils";
import { ErrorText } from "@/ui/feedback";
import { ArticleBody } from "./ArticleBody";
import { applyBold, applyLine, applyLink, insertImage, type Edit, type LineAction } from "./format";

export const MAX_BODY = 20000;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_IMAGE = 5 * 1024 * 1024;

/**
 * Texto do artigo com barra de formatação, imagem (botão, colar ou arrastar) e "Ver como o cliente" (adendo li). Em
 * tela larga, escrever e ver ficam lado a lado; no celular, em abas.
 */
export function ArticleTextEditor({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const commit = (edit: Edit) => {
    onChange(edit.value);
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(edit.start, edit.end);
    });
  };
  const sel = () => {
    const el = ref.current;
    return el ? [el.selectionStart, el.selectionEnd] : [value.length, value.length];
  };
  const line = (a: LineAction) => {
    const [s, e] = sel();
    commit(applyLine(value, s ?? 0, e ?? 0, a));
  };

  const upload = async (file: File) => {
    setError(null);
    setNotice(null);
    if (!IMAGE_TYPES.includes(file.type)) {
      setError("Envie uma imagem PNG, JPEG, WebP ou GIF.");
      return;
    }
    if (file.size > MAX_IMAGE) {
      setError("A imagem passa de 5 MB. Reduza o tamanho e tente de novo.");
      return;
    }
    const [s, e] = sel();
    setUploading(true);
    try {
      const url = await helpApi.uploadImage(file);
      commit(insertImage(ref.current?.value ?? value, s ?? 0, e ?? 0, url));
      setNotice("Imagem inserida. Para uma legenda, escreva entre os colchetes: ![Legenda](…).");
    } catch (err) {
      // 25/11: com o painel novo e o backend antigo, a rota não existia (404) e ninguém viu o aviso, que ficava
      // embaixo do texto. Agora ele fica junto da barra, e o 404 diz o que é.
      console.error("[artigos] envio da imagem falhou:", err);
      setError(
        err instanceof ApiError && err.status === 404
          ? "O servidor ainda não aceita imagens nos artigos (atualização pendente). Avise o suporte e tente mais tarde."
          : `A imagem não foi enviada: ${err instanceof Error && err.message ? err.message : "tente de novo."}`
      );
    } finally {
      setUploading(false);
    }
  };
  const firstImage = (files: FileList | null | undefined) =>
    Array.from(files ?? []).find((f) => f.type.startsWith("image/"));
  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const f = firstImage(e.clipboardData?.files);
    if (!f) return;
    e.preventDefault();
    void upload(f);
  };
  const onDrop = (e: DragEvent<HTMLTextAreaElement>) => {
    const f = firstImage(e.dataTransfer?.files);
    if (!f) return;
    e.preventDefault();
    void upload(f);
  };

  const tools: { label: string; icon: LucideIcon; run: () => void }[] = [
    { label: "Título de seção", icon: Heading2, run: () => line("h2") },
    { label: "Subtítulo", icon: Heading3, run: () => line("h3") },
    {
      label: "Negrito",
      icon: Bold,
      run: () => {
        const [s, e] = sel();
        commit(applyBold(value, s ?? 0, e ?? 0));
      },
    },
    { label: "Lista", icon: List, run: () => line("ul") },
    { label: "Lista numerada", icon: ListOrdered, run: () => line("ol") },
    { label: "Dica", icon: Lightbulb, run: () => line("tip") },
    {
      label: "Link",
      icon: Link,
      run: () => {
        const [s, e] = sel();
        commit(applyLink(value, s ?? 0, e ?? 0));
      },
    },
  ];

  const tabBtn = (t: "write" | "preview", label: string, Icon: LucideIcon) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === t}
      onClick={() => setTab(t)}
      className={cn(
        "inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium",
        tab === t ? "bg-muted text-foreground" : "text-muted-foreground"
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
      {label}
    </button>
  );

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={id} className="block text-sm font-medium">
          Texto
        </label>
        <div role="tablist" aria-label="Modo do texto" className="flex gap-1 lg:hidden">
          {tabBtn("write", "Escrever", PencilLine)}
          {tabBtn("preview", "Ver como o cliente", Eye)}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={cn("space-y-2", tab === "write" ? "" : "hidden lg:block")}>
          {!disabled && (
            <div
              role="toolbar"
              aria-label="Formatação"
              className="flex flex-wrap gap-1 rounded-xl border border-input p-1"
            >
              {tools.map(({ label, icon: Icon, run }) => (
                <button
                  key={label}
                  type="button"
                  title={label}
                  aria-label={label}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={run}
                  className="inline-flex size-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Icon className="size-4" aria-hidden="true" />
                </button>
              ))}
              <button
                type="button"
                title="Imagem"
                aria-label="Imagem"
                disabled={uploading}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => fileRef.current?.click()}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg px-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-60"
              >
                {uploading ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <ImagePlus className="size-4" aria-hidden="true" />
                )}
                {uploading ? "Enviando…" : "Imagem"}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept={IMAGE_TYPES.join(",")}
                className="hidden"
                data-testid="artigo-imagem"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void upload(f);
                }}
              />
            </div>
          )}
          {error && (
            <ErrorText className="rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2">
              {error}
            </ErrorText>
          )}
          {notice && (
            <p role="status" className="rounded-xl bg-muted px-3 py-2 text-xs">
              {notice}
            </p>
          )}
          <textarea
            id={id}
            ref={ref}
            rows={18}
            required
            maxLength={MAX_BODY}
            disabled={disabled}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onPaste={onPaste}
            onDrop={onDrop}
            className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 font-mono text-sm leading-relaxed outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            placeholder={
              "Escreva o passo a passo. Use a barra acima para títulos, listas e imagens — ou cole uma imagem aqui."
            }
          />
          <p className="text-xs text-muted-foreground">
            {value.length}/{MAX_BODY} · cole ou arraste uma imagem no texto para enviá-la
          </p>
        </div>
        <div
          className={cn(
            "min-h-40 rounded-xl border border-dashed border-border p-4",
            tab === "preview" ? "" : "hidden lg:block"
          )}
          aria-label="Ver como o cliente"
        >
          <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Como o cliente vê
          </p>
          {value.trim() ? (
            <ArticleBody text={value} />
          ) : (
            <p className="text-sm text-muted-foreground">
              O texto aparece aqui enquanto você escreve.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
