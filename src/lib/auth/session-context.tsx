"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Session } from "./session";

const SessionContext = createContext<Session | null>(null);

/** Hands the server-verified session to client components. */
export function SessionProvider({ session, children }: { session: Session; children: ReactNode }) {
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession must be used inside <SessionProvider>");
  return session;
}
