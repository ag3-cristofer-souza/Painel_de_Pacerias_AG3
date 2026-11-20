import { createContext, useContext } from "react";
import type { PublicBrand } from "@/api/branding";
import { hexToHslTriplet } from "@/lib/color";

/** Sem marca de parceiro, o painel é o de sempre (AG3). */
export const DEFAULT_BRAND: PublicBrand = { is_default: true, product_name: "AG3" };

export const BrandContext = createContext<PublicBrand>(DEFAULT_BRAND);

export const useBrand = () => useContext(BrandContext);

const STYLE_ID = "brand-colors";

/** Título, ícone e cor principal da marca (white label, onda 7). Sem marca, nada muda. */
export function applyBrand(brand: PublicBrand): void {
  if (brand.is_default) return;
  document.title = `Suporte ${brand.product_name}`;
  const icon = brand.favicon ?? brand.app_icon;
  if (icon) {
    document
      .querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="apple-touch-icon"]')
      .forEach((link) => {
        link.href = icon;
        link.removeAttribute("type");
      });
  }
  const light = hexToHslTriplet(brand.color_primary);
  const dark = hexToHslTriplet(brand.color_primary_dark) ?? light;
  if (light) {
    document.getElementById(STYLE_ID)?.remove();
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `:root{--primary:${light};--ring:${light}}.dark{--primary:${dark};--ring:${dark}}`;
    document.head.appendChild(style);
  }
}
