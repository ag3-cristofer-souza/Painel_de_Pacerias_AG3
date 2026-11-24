import {
  AlarmClock,
  BellRing,
  BookOpen,
  Building2,
  CirclePlus,
  Palette,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Panel } from "@/api/partners";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Quem vê o item. A regra de verdade é do servidor; aqui só se organiza a tela. */
  visible: (panel: Panel) => boolean;
}

const always = () => true;

export const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Carteira", icon: Building2, visible: always },
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
  { to: "/artigos", label: "Artigos de ajuda", icon: BookOpen, visible: always },
  { to: "/conta", label: "Minha conta", icon: UserRound, visible: always },
];

export const visibleNav = (panel: Panel) => NAV_ITEMS.filter((item) => item.visible(panel));

export const canSee = (panel: Panel, path: string) =>
  NAV_ITEMS.find((item) => item.to === path)?.visible(panel) ?? true;
