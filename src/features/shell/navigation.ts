import {
  AlarmClock,
  BarChart3,
  BellRing,
  BookOpen,
  Building2,
  CirclePlus,
  Gauge,
  ScrollText,
  LifeBuoy,
  Palette,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Panel } from "@/api/partners";
import { canHandleTickets } from "@/lib/support";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Quem vê o item. A regra de verdade é do servidor; aqui só se organiza a tela. */
  visible: (panel: Panel) => boolean;
}

const always = () => true;
/** D27: o dono e os administradores do parceiro, e a equipe AG3. */
export const canSeeAudit = (p: Panel) =>
  p.kind === "ag3" || p.member_role === "owner" || p.member_role === "admin";

export const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Carteira", icon: Building2, visible: always },
  // o dashboard do Django Admin, só para a equipe AG3 (adendo lz)
  { to: "/visao-ag3", label: "Visão AG3", icon: Gauge, visible: (p) => p.kind === "ag3" },
  { to: "/chamados", label: "Chamados", icon: LifeBuoy, visible: canHandleTickets },
  { to: "/relatorios-sla", label: "Relatórios de SLA", icon: BarChart3, visible: always },
  { to: "/alertas", label: "Alertas", icon: BellRing, visible: always },
  { to: "/atrasados", label: "Mensalidades em atraso", icon: AlarmClock, visible: always },
  {
    to: "/novo-workspace",
    label: "Novo workspace",
    icon: CirclePlus,
    // servidor antigo não manda `can_create_workspaces`: vale o `can_admin_workspaces` de antes
    visible: (p) => p.can_create_workspaces ?? p.can_admin_workspaces,
  },
  { to: "/equipe", label: "Equipe", icon: Users, visible: (p) => p.kind === "partner" },
  { to: "/marca", label: "Marca", icon: Palette, visible: (p) => p.kind === "partner" },
  { to: "/auditoria", label: "Auditoria", icon: ScrollText, visible: canSeeAudit },
  { to: "/artigos", label: "Artigos de ajuda", icon: BookOpen, visible: always },
  { to: "/conta", label: "Minha conta", icon: UserRound, visible: always },
];

export const visibleNav = (panel: Panel) => NAV_ITEMS.filter((item) => item.visible(panel));

export const canSee = (panel: Panel, path: string) =>
  NAV_ITEMS.find((item) => item.to === path)?.visible(panel) ?? true;
