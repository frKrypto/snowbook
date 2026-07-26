import { CheckIcon } from "@/components/icons";
import { cn } from "@/components/ui";
import type { ProjectStatus } from "@/lib/database.types";
import { PROJECT_TIMELINE, projectStatusMeta } from "@/lib/statuses";

/**
 * Horizontal stepper through the project stages. Shown to admins and, in the
 * portal, to clients — it is the main "where are we at" signal they get.
 */
export function ProjectTimeline({ status }: { status: ProjectStatus }) {
  const currentIndex = PROJECT_TIMELINE.indexOf(status);

  return (
    <ol className="flex items-start gap-1 overflow-x-auto px-5 py-5">
      {PROJECT_TIMELINE.map((stage, index) => {
        const complete = index < currentIndex;
        const current = index === currentIndex;
        const last = index === PROJECT_TIMELINE.length - 1;

        return (
          <li
            key={stage}
            className={cn("flex min-w-0 flex-1 items-start gap-1", last && "flex-none")}
          >
            <div className="flex min-w-16 flex-col items-center gap-2">
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition",
                  complete && "border-brand bg-brand text-white",
                  current && "border-accent bg-accent-soft text-accent",
                  !complete && !current && "border-line bg-surface text-ink-faint",
                )}
                aria-hidden="true"
              >
                {complete ? <CheckIcon className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <span
                className={cn(
                  "text-center text-xs leading-tight whitespace-nowrap",
                  current ? "font-medium text-ink" : "text-ink-muted",
                )}
              >
                {projectStatusMeta(stage).label}
              </span>
            </div>

            {!last ? (
              <span
                aria-hidden="true"
                className={cn(
                  "mt-3.5 h-px min-w-4 flex-1",
                  index < currentIndex ? "bg-brand" : "bg-line",
                )}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
