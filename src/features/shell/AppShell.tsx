import { LogOut } from "lucide-react";
import { Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import logoBranco from "@/assets/logo-branco.png";
import { panelOwnerName, panelRoleLabel } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { useAuth, usePanel } from "@/features/auth/AuthProvider";
import { canSee, visibleNav } from "./navigation";

/** Menu lateral no computador; no celular, vira uma faixa rolável no topo. */
export function AppShell() {
  const panel = usePanel();
  const { signOut } = useAuth();
  const items = visibleNav(panel);
  return (
    <div className="min-h-dvh bg-background lg:flex">
      <aside className="dark bg-background text-foreground lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex items-center justify-between gap-3 px-5 py-4 lg:py-6">
          <img src={logoBranco} alt="AG3.AI" width={112} height={26} />
          <button
            type="button"
            onClick={signOut}
            className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm text-white/70 hover:text-white lg:hidden"
          >
            <LogOut className="size-4" aria-hidden="true" />
            Sair
          </button>
        </div>
        <nav
          aria-label="Menu"
          className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-1 lg:flex-col lg:overflow-visible"
        >
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex min-h-11 shrink-0 items-center gap-3 rounded-xl px-3 text-sm font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white",
                  isActive && "bg-white/10 text-white"
                )
              }
            >
              <Icon className="size-[1.125rem]" aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden border-t border-white/10 p-4 lg:block">
          <p className="truncate text-sm font-medium text-white">{panel.user.full_name}</p>
          <p className="truncate text-xs text-white/60">{panel.user.email}</p>
          <button
            type="button"
            onClick={signOut}
            className="mt-3 flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-sm text-white/70 hover:bg-white/5 hover:text-white"
          >
            <LogOut className="size-4" aria-hidden="true" />
            Sair
          </button>
        </div>
      </aside>
      <div className="flex-1 lg:pl-64">
        <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b bg-card px-5 py-3 lg:px-8">
          <span className="font-semibold">{panelOwnerName(panel)}</span>
          {panel.kind === "ag3" && (
            <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-semibold text-brand-foreground">
              AG3
            </span>
          )}
          <span className="text-sm text-muted-foreground">{panelRoleLabel(panel)}</span>
        </header>
        <main className="mx-auto w-full max-w-6xl px-5 py-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/** Rota que esta pessoa não vê no menu volta para a carteira (o servidor recusaria de todo jeito). */
export function RequireNav() {
  const panel = usePanel();
  const { pathname } = useLocation();
  return canSee(panel, pathname) ? <Outlet /> : <Navigate to="/" replace />;
}
