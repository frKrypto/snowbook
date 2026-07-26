import { AppShell, type NavItem } from "@/components/app-shell";
import { DashboardIcon, InvoicesIcon, ProjectsIcon } from "@/components/icons";
import { requireClient } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const NAV: NavItem[] = [
  { href: "/portal", label: "Overview", icon: DashboardIcon, exact: true },
  { href: "/portal/projects", label: "Projects", icon: ProjectsIcon },
  { href: "/portal/invoices", label: "Invoices", icon: InvoicesIcon },
];

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { clientId, profile, email } = await requireClient();

  const supabase = await createClient();
  const { data: client } = await supabase
    .from("clients")
    .select("name")
    .eq("id", clientId)
    .maybeSingle();

  return (
    <AppShell
      nav={NAV}
      homeHref="/portal"
      contextLabel="Client portal"
      displayName={client?.name ?? profile.full_name ?? email ?? "Client"}
      email={email}
    >
      {children}
    </AppShell>
  );
}
