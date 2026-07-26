"use client";

import { Button } from "@/components/ui";

/**
 * Opens the browser's print dialog, where "Save as PDF" is the usual
 * destination. Deliberately not server-side PDF generation: that would mean
 * running a headless browser on every request for output the client already
 * knows how to produce.
 */
export function PrintButton({ label = "Print / Save PDF" }: { label?: string }) {
  return (
    <Button type="button" onClick={() => window.print()}>
      {label}
    </Button>
  );
}
