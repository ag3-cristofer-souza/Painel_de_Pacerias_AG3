/**
 * Formato do texto dos artigos de ajuda (adendo li). O mesmo arquivo existe no painel (`src/components/help/format.ts`):
 * o que o editor mostra em "Ver como o cliente" é o que o cliente vê.
 *
 * - linha em branco separa parágrafos;
 * - "## " título, "### " subtítulo, "- " item, "1. " item numerado, "> " dica;
 * - "**negrito**" e "[texto](https://…)" dentro da linha;
 * - "![legenda](https://…)" sozinho na linha é uma imagem.
 *
 * Os artigos antigos (só parágrafo, "## " e "- ") continuam iguais. Nada vira HTML: o renderizador monta elementos do
 * React a partir destes blocos, e link ou imagem com endereço que não seja https (ou caminho do próprio sistema) fica
 * como texto.
 */

export type Inline =
  { t: "text"; v: string } | { t: "bold"; v: string } | { t: "link"; v: string; href: string };

export type Block =
  | { t: "h2" | "h3" | "p" | "tip"; v: string }
  | { t: "ul" | "ol"; items: string[] }
  | { t: "img"; src: string; alt: string };

const IMAGE = /^!\[([^\]\n]*)\]\((\S+)\)\s*$/;
const ORDERED = /^\d{1,3}[.)]\s+/;

export const safeHref = (href: string) =>
  /^https:\/\/\S+$/i.test(href) || /^\/(?!\/)\S*$/.test(href);
export const safeImage = (src: string) => /^https:\/\/\S+$/i.test(src);

export function parseArticle(text: string): Block[] {
  const out: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) out.push({ t: "p", v: para.join("\n") });
    para = [];
  };
  const pushItem = (t: "ul" | "ol", item: string) => {
    const last = out[out.length - 1];
    if (last && last.t === t) last.items.push(item);
    else out.push({ t, items: [item] });
  };

  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    const lead = line.trimStart();
    if (!lead) {
      flush();
      continue;
    }
    const img = IMAGE.exec(lead);
    if (lead.startsWith("### ") || lead.startsWith("## ")) {
      flush();
      const h3 = lead.startsWith("### ");
      out.push({ t: h3 ? "h3" : "h2", v: lead.slice(h3 ? 4 : 3).trim() });
    } else if (img && safeImage(img[2] ?? "")) {
      flush();
      out.push({ t: "img", src: img[2] ?? "", alt: (img[1] ?? "").trim() });
    } else if (lead.startsWith("- ")) {
      flush();
      pushItem("ul", lead.slice(2));
    } else if (ORDERED.test(lead)) {
      flush();
      pushItem("ol", lead.replace(ORDERED, ""));
    } else if (lead.startsWith(">")) {
      flush();
      const v = lead.replace(/^>\s?/, "");
      const last = out[out.length - 1];
      if (last && last.t === "tip") last.v += `\n${v}`;
      else out.push({ t: "tip", v });
    } else {
      const last = out[out.length - 1];
      // linha que continua um item de lista (sem linha em branco) é parte dele, como antes era parte do parágrafo
      if (!para.length && last && (last.t === "ul" || last.t === "ol") && raw.startsWith(" ")) {
        last.items[last.items.length - 1] += `\n${lead}`;
      } else {
        para.push(line);
      }
    }
  }
  flush();
  return out;
}

const INLINE = /\*\*([^*\n]+?)\*\*|\[([^\]\n]+)\]\(([^)\s]+)\)/g;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ t: "text", v: text.slice(last, at) });
    if (m[1] !== undefined) out.push({ t: "bold", v: m[1] });
    else if (m[2] !== undefined && safeHref(m[3] ?? ""))
      out.push({ t: "link", v: m[2], href: m[3] ?? "" });
    else out.push({ t: "text", v: m[0] });
    last = at + m[0].length;
  }
  if (last < text.length) out.push({ t: "text", v: text.slice(last) });
  return out;
}

// ── barra do editor ─────────────────────────────────────────────────────────────────────────────────────────────

export type LineAction = "h2" | "h3" | "ul" | "ol" | "tip";
export interface Edit {
  value: string;
  start: number;
  end: number;
}

const PREFIX = /^(#{2,3} |- |\d{1,3}[.)] |> ?)/;

/** Título, subtítulo, lista, lista numerada ou dica nas linhas da seleção. Se todas já estão assim, desfaz. */
export function applyLine(value: string, start: number, end: number, action: LineAction): Edit {
  const from = value.lastIndexOf("\n", start - 1) + 1;
  const nl = value.indexOf("\n", end > start && value[end - 1] === "\n" ? end - 1 : end);
  const to = nl === -1 ? value.length : nl;
  const lines = value.slice(from, to).split("\n");
  const has = (l: string) =>
    action === "h2"
      ? l.startsWith("## ")
      : action === "h3"
        ? l.startsWith("### ")
        : action === "ul"
          ? l.startsWith("- ")
          : action === "ol"
            ? ORDERED.test(l)
            : l.startsWith(">");
  const filled = lines.filter((l) => l.trim() !== "");
  const undo = filled.length > 0 && lines.every((l) => l.trim() === "" || has(l));
  let n = 0;
  const next = lines.map((l) => {
    const bare = l.replace(PREFIX, "");
    if (undo) return bare;
    if (l.trim() === "" && lines.length > 1) return l;
    n += 1;
    const p = { h2: "## ", h3: "### ", ul: "- ", ol: `${n}. `, tip: "> " }[action];
    return p + bare;
  });
  const block = next.join("\n");
  // cursor no fim do bloco, para seguir digitando (com a linha selecionada, a próxima tecla ou imagem a apagaria)
  return {
    value: value.slice(0, from) + block + value.slice(to),
    start: from + block.length,
    end: from + block.length,
  };
}

/** Negrito na seleção; sem seleção, um texto de exemplo já selecionado para digitar por cima. */
export function applyBold(value: string, start: number, end: number): Edit {
  const sel = value.slice(start, end) || "texto em negrito";
  const v = `${value.slice(0, start)}**${sel}**${value.slice(end)}`;
  return { value: v, start: start + 2, end: start + 2 + sel.length };
}

/** Link: o texto selecionado vira o texto do link e o endereço fica selecionado para colar. */
export function applyLink(value: string, start: number, end: number): Edit {
  const sel = value.slice(start, end) || "texto do link";
  const href = "https://";
  const v = `${value.slice(0, start)}[${sel}](${href})${value.slice(end)}`;
  const at = start + sel.length + 3;
  return { value: v, start: at, end: at + href.length };
}

/**
 * Imagem em linha própria, com linha em branco antes e depois, DEPOIS da seleção (nunca apaga o texto selecionado). O
 * cursor vai para a legenda.
 */
export function insertImage(value: string, _start: number, end: number, url: string): Edit {
  const before = value.slice(0, end);
  const after = value.slice(end);
  const pre = !before ? "" : before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
  const post = !after
    ? "\n"
    : after.startsWith("\n\n")
      ? ""
      : after.startsWith("\n")
        ? "\n"
        : "\n\n";
  const md = `![](${url})`;
  const v = before + pre + md + post + after;
  const caret = before.length + pre.length + 2;
  return { value: v, start: caret, end: caret };
}
