import { describe, expect, it } from "vitest";
import { applyBold, applyLine, applyLink, insertImage, parseArticle, parseInline } from "./format";

describe("formato dos artigos (adendo li)", () => {
  it("artigo antigo continua igual: parágrafo, título e lista", () => {
    expect(parseArticle("Abra o menu.\nDepois clique.\n\n## Canais\n\n- um\n- dois")).toEqual([
      { t: "p", v: "Abra o menu.\nDepois clique." },
      { t: "h2", v: "Canais" },
      { t: "ul", items: ["um", "dois"] },
    ]);
  });

  it("subtítulo, lista numerada, dica e imagem", () => {
    const url = "https://cdn.ag3.test/geonai/help/p1/a.png";
    expect(
      parseArticle(`### Passo 1\n1. Abra\n2. Clique\n> Dica um\n> continua\n\n![Tela](${url})`)
    ).toEqual([
      { t: "h3", v: "Passo 1" },
      { t: "ol", items: ["Abra", "Clique"] },
      { t: "tip", v: "Dica um\ncontinua" },
      { t: "img", src: url, alt: "Tela" },
    ]);
  });

  it("imagem e link só com https (ou caminho do sistema); o resto fica texto", () => {
    expect(parseArticle("![x](javascript:alert(1))")).toEqual([
      { t: "p", v: "![x](javascript:alert(1))" },
    ]);
    expect(
      parseInline("Veja **isto** em [Canais](/canais) e [site](https://a.b/c) e [x](javascript:1)")
    ).toEqual([
      { t: "text", v: "Veja " },
      { t: "bold", v: "isto" },
      { t: "text", v: " em " },
      { t: "link", v: "Canais", href: "/canais" },
      { t: "text", v: " e " },
      { t: "link", v: "site", href: "https://a.b/c" },
      { t: "text", v: " e " },
      { t: "text", v: "[x](javascript:1)" },
    ]);
  });

  it("barra: título liga e desliga, lista numerada numera, negrito e link selecionam o que digitar", () => {
    const h = applyLine("Intro\nCanais\nFim", 7, 7, "h2");
    expect(h.value).toBe("Intro\n## Canais\nFim");
    expect([h.start, h.end]).toEqual([15, 15]); // cursor no fim da linha
    expect(applyLine(h.value, 8, 8, "h2").value).toBe("Intro\nCanais\nFim");
    expect(applyLine("- a\nb", 0, 5, "ol").value).toBe("1. a\n2. b");
    const b = applyBold("abc", 1, 1);
    expect(b.value).toBe("a**texto em negrito**bc");
    expect(b.value.slice(b.start, b.end)).toBe("texto em negrito");
    const l = applyLink("ver Canais", 4, 10);
    expect(l.value).toBe("ver [Canais](https://)");
    expect(l.value.slice(l.start, l.end)).toBe("https://");
  });

  it("imagem entra em linha própria e o cursor vai para a legenda", () => {
    const e = insertImage("Antes\nDepois", 5, 5, "https://x/y.png");
    expect(e.value).toBe("Antes\n\n![](https://x/y.png)\n\nDepois");
    expect(e.value.slice(0, e.start).endsWith("![")).toBe(true);
    // com texto selecionado (ex.: logo depois de um título), a imagem entra depois dele e não o apaga
    expect(insertImage("## Passo", 0, 8, "https://x/y.png").value).toBe(
      "## Passo\n\n![](https://x/y.png)\n"
    );
  });
});
