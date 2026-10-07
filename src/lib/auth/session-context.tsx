"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { setActor } from "@/lib/api/actor";
import type { Session } from "./session";

const SessionContext = createContext<Session | null>(null);

/** Hands the server-verified session to client components. */
export function SessionProvider({ session, children }: { session: Session; children: ReactNode }) {
  // Children fetch in their own effects, which run before this component's. Setting the actor on the
  // first render means their very first request already says who is asking (the mock API scopes by it).
  useState(() => setActor(session.sub));
  useEffect(() => {
    setActor(session.sub);
    return () => setActor(null);
  }, [session.sub]);

  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession must be used inside <SessionProvider>");
  return session;
}
