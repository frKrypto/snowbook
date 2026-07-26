"use client";

import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { FormError } from "@/components/ui";

/**
 * PayPal Smart Buttons for a single invoice.
 *
 * Both callbacks go through our own API: the browser never states an amount,
 * it only names the invoice, and the server reads the price from the database.
 */
export function PayPalCheckout({
  invoiceId,
  clientId,
  currency,
}: {
  invoiceId: string;
  clientId: string;
  currency: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [settling, setSettling] = useState(false);

  return (
    <div className="space-y-3">
      <FormError message={error} />

      {settling ? (
        <p className="text-sm text-ink-muted">Confirming your payment…</p>
      ) : null}

      <PayPalScriptProvider
        options={{
          clientId,
          currency,
          intent: "capture",
          components: "buttons",
        }}
      >
        <PayPalButtons
          style={{ layout: "vertical", shape: "rect", label: "pay", height: 44 }}
          disabled={settling}
          createOrder={async () => {
            setError(null);
            const response = await fetch("/api/paypal/create-order", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ invoiceId }),
            });
            const data = await response.json();
            if (!response.ok) {
              throw new Error(data.error ?? "Could not start the payment.");
            }
            return data.orderId as string;
          }}
          onApprove={async (data) => {
            setSettling(true);
            try {
              const response = await fetch("/api/paypal/capture-order", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ invoiceId, orderId: data.orderID }),
              });
              const result = await response.json();

              if (!response.ok) {
                setError(result.error ?? "We couldn't confirm the payment.");
                return;
              }

              // Pull the freshly-paid invoice from the server.
              router.refresh();
            } catch {
              setError(
                "Your payment may have gone through but we couldn't confirm it. Refresh in a moment, or contact the studio.",
              );
            } finally {
              setSettling(false);
            }
          }}
          onError={() => {
            setError("PayPal couldn't process that. Please try again.");
            setSettling(false);
          }}
          onCancel={() => {
            setError(null);
            setSettling(false);
          }}
        />
      </PayPalScriptProvider>
    </div>
  );
}
