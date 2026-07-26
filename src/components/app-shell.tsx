import Link from "next/link";
import type { ReactNode } from "react";

import { signOutAction } from "@/app/auth/actions";
import { Wordmark } from "@/components/brand";
import { SignOutIcon } from "@/components/icons";
import { NavLink } from "@/components/nav-link";
import { ThemeToggle } from "@/components/theme-toggle";
import { initials } from "@/lib/format";

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  exact?: boolean;
}

/**
 * Shared chrome for both the admin console and the client portal: a fixed
 * sidebar on desktop that collapses to a scrollable tab strip on small
 * screens, so no client-side menu state is needed.
 */
export function AppShell({
  nav,
  homeHref,
  contextLabel,
  displayName,
  email,
  children,
}: {
  nav: NavItem[];
  homeHref: string;
  contextLabel: string;
  displayName: string;
  email: string | null;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen lg:flex">
      <header className="border-b border-line bg-surface-sunken/60 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between gap-4 px-4 py-4 lg:px-5">
          <Link href={homeHref} className="min-w-0">
            <Wordmark />
            <span className="mt-0.5 block text-xs tracking-wide text-ink-faint">
              {contextLabel}
            </span>
          </Link>

          {/* Mobile controls — the sidebar footer holding these is hidden there. */}
          <div className="flex items-center gap-2 lg:hidden">
            <ThemeToggle />
            <form action={signOutAction}>
              <button
                type="submit"
                aria-label="Sign out"
                className="rounded-lg p-2 text-ink-muted transition hover:bg-surface hover:text-ink"
              >
                <SignOutIcon className="h-4.5 w-4.5" />
              </button>
            </form>
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-1 lg:flex-col lg:overflow-y-auto lg:px-3 lg:pb-4">
          {nav.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </nav>

        <div className="hidden border-t border-line px-4 py-3 lg:block">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-[11px] font-semibold text-white">
              {initials(displayName) || "—"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">
                {displayName}
              </p>
              {email ? (
                <p className="truncate text-xs text-ink-muted">{email}</p>
              ) : null}
            </div>
          </div>
          <div className="mt-2.5 flex items-center justify-between gap-2">
            <form action={signOutAction}>
              <button
                type="submit"
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-ink-muted transition hover:bg-surface hover:text-ink"
              >
                <SignOutIcon className="h-4 w-4" />
                Sign out
              </button>
            </form>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
          {children}
        </div>
      </main>
    </div>
  );
}
