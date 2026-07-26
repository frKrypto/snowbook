"use client";

import { useSyncExternalStore } from "react";

import { THEME_STORAGE_KEY } from "@/components/theme-script";
import { MonitorIcon, MoonIcon, SunIcon } from "@/components/icons";
import { cn } from "@/components/ui";

type ThemePreference = "light" | "dark" | "system";

const OPTIONS: Array<{
  value: ThemePreference;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}> = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "System", icon: MonitorIcon },
];

/*
 * The preference lives in localStorage, which is an external store rather than
 * React state — so it is read through useSyncExternalStore. That also gives a
 * clean server snapshot, avoiding a hydration mismatch on a value the server
 * cannot know.
 */
const listeners = new Set<() => void>();

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
  } catch {
    // Storage can be blocked entirely; fall through to the default.
  }
  return "system";
}

function prefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyPreference(preference: ThemePreference) {
  const dark =
    preference === "dark" || (preference === "system" && prefersDark());
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
}

function subscribe(onChange: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");

  // Track the OS only while the user is actually on "system".
  const onMediaChange = () => {
    if (readPreference() === "system") applyPreference("system");
    onChange();
  };

  listeners.add(onChange);
  media.addEventListener("change", onMediaChange);
  window.addEventListener("storage", onChange);

  return () => {
    listeners.delete(onChange);
    media.removeEventListener("change", onMediaChange);
    window.removeEventListener("storage", onChange);
  };
}

export function ThemeToggle() {
  const preference = useSyncExternalStore(
    subscribe,
    readPreference,
    () => "system" as ThemePreference,
  );

  function choose(next: ThemePreference) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Preference just won't persist across reloads.
    }
    applyPreference(next);
    for (const listener of listeners) listener();
  }

  return (
    <div
      role="group"
      aria-label="Colour theme"
      className="flex items-center gap-0.5 rounded-lg border border-line bg-surface p-0.5"
    >
      {OPTIONS.map((option) => {
        const active = preference === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => choose(option.value)}
            aria-label={option.label}
            aria-pressed={active}
            title={option.label}
            className={cn(
              "rounded-md p-1.5 transition",
              active
                ? "bg-surface-sunken text-ink"
                : "text-ink-faint hover:text-ink",
            )}
          >
            <option.icon className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}
