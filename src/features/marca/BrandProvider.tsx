import { useEffect, useState, type ReactNode } from "react";
import { brandingApi, type PublicBrand } from "@/api/branding";
import { applyBrand, BrandContext, DEFAULT_BRAND } from "./brand";

/** A marca vem do endereço da tela (`<slug>-suporte.ag3system.com`), antes do login. Falha = marca padrão. */
export function BrandProvider({ children, host }: { children: ReactNode; host?: string }) {
  const [brand, setBrand] = useState<PublicBrand>(DEFAULT_BRAND);
  const where = host ?? window.location.hostname;

  useEffect(() => {
    let alive = true;
    brandingApi
      .byHost(where)
      .then((found) => {
        if (!alive) return;
        setBrand(found);
        applyBrand(found);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [where]);

  return <BrandContext.Provider value={brand}>{children}</BrandContext.Provider>;
}
