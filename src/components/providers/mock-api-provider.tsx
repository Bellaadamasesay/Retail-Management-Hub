"use client";

import { useEffect, useState, type ReactNode } from "react";

const mockingEnabled = process.env.NEXT_PUBLIC_API_MOCKING === "enabled";

let started: Promise<unknown> | null = null;

/** Start the MSW worker once per page load. React StrictMode runs effects twice in dev, and MSW throws if started twice. */
function startMocking() {
  started ??= import("@/lib/api/mocks/browser").then(({ worker }) =>
    worker.start({ onUnhandledRequest: "bypass", quiet: true }),
  );
  return started;
}

/**
 * Waits for the mock API before rendering children, so no request can race
 * ahead of it. If mocking fails to start the app still renders (with a console
 * warning) rather than staying blank. A no-op once the real backend replaces the mocks.
 */
export function MockApiProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!mockingEnabled);

  useEffect(() => {
    if (!mockingEnabled) return;
    let cancelled = false;
    startMocking()
      .catch((error) => console.warn("Mock API failed to start:", error))
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return ready ? <>{children}</> : null;
}
