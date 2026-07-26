import { AppShell, type NavItem } from "@/components/app-shell";
import {
  ClientsIcon,
  DashboardIcon,
  InvoicesIcon,
  ProjectsIcon,
} from "@/components/icons";
import { requireAdmin } from "@/lib/auth";

const NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: DashboardIcon, exact: true },
  { href: "/admin/clients", label: "Clients", icon: ClientsIcon },
  { href: "/admin/projects", label: "Projects", icon: ProjectsIcon },
  { href: "/admin/invoices", label: "Invoices", icon: InvoicesIcon },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile, email } = await requireAdmin();

  return (
    <AppShell
      nav={NAV}
      homeHref="/admin"
      contextLabel="Studio console"
      displayName={profile.full_name ?? email ?? "Studio"}
      email={email}
    >
      {children}
    </AppShell>
  );
}
