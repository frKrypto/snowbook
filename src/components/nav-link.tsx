"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/components/ui";

export function NavLink({
  href,
  label,
  icon: IconComponent,
  exact = false,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  exact?: boolean;
}) {
  const pathname = usePathname();
  const active = exact
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition",
        active
          ? "bg-surface text-ink shadow-[0_1px_2px_rgba(25,28,25,0.05)] ring-1 ring-line"
          : "text-ink-muted hover:bg-surface/70 hover:text-ink",
      )}
    >
      <IconComponent className={cn("h-4 w-4", active && "text-accent")} />
      {label}
    </Link>
  );
}
