import { Lightbulb } from "lucide-react";
import type { ReactNode } from "react";
import { parseArticle, parseInline } from "./format";

/**
 * O artigo como o cliente vê no menu Ajuda do painel (adendo li). Mesmo formato e mesmo desenho do
 * `src/components/help/ArticleBody.tsx` do painel. Tudo vira elemento do React: o que se escreve nunca vira HTML.
 */
function Inline({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((tok, i) =>
        tok.t === "bold" ? (
          <strong key={i} className="font-semibold text-foreground">
            {tok.v}
          </strong>
        ) : tok.t === "link" ? (
          <a
            key={i}
            href={tok.href}
            target={tok.href.startsWith("/") ? undefined : "_blank"}
            rel="noopener noreferrer"
            className="font-medium text-primary underline underline-offset-2"
          >
            {tok.v}
          </a>
        ) : (
          <span key={i}>{tok.v}</span>
        )
      )}
    </>
  );
}

export function ArticleBody({ text }: { text: string }) {
  const out: ReactNode[] = parseArticle(text).map((b, i) => {
    switch (b.t) {
      case "h2":
        return (
          <h3 key={i} className="mt-6 mb-2 text-lg font-semibold text-foreground">
            <Inline text={b.v} />
          </h3>
        );
      case "h3":
        return (
          <h4 key={i} className="mt-4 mb-1.5 text-base font-semibold text-foreground">
            <Inline text={b.v} />
          </h4>
        );
      case "ul":
      case "ol": {
        const Tag = b.t;
        return (
          <Tag
            key={i}
            className={`my-3 space-y-1 pl-6 ${b.t === "ul" ? "list-disc" : "list-decimal"}`}
          >
            {b.items.map((item, j) => (
              <li key={j} className="whitespace-pre-line">
                <Inline text={item} />
              </li>
            ))}
          </Tag>
        );
      }
      case "tip":
        return (
          <div
            key={i}
            className="my-4 flex gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3.5"
          >
            <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <p className="whitespace-pre-line">
              <Inline text={b.v} />
            </p>
          </div>
        );
      case "img":
        return (
          <figure key={i} className="my-4">
            <img
              src={b.src}
              alt={b.alt}
              loading="lazy"
              className="max-h-[32rem] max-w-full rounded-xl border border-border"
            />
            {b.alt && (
              <figcaption className="mt-1.5 text-xs text-muted-foreground">{b.alt}</figcaption>
            )}
          </figure>
        );
      default:
        return (
          <p key={i} className="my-3 whitespace-pre-line">
            <Inline text={b.v} />
          </p>
        );
    }
  });
  return <div className="text-sm leading-relaxed text-foreground/90">{out}</div>;
}
