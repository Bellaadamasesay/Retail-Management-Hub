import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession, type Session } from "./session";

/** The signed-in session for this request, or null. Server components and route handlers only. */
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}
