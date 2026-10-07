import { cookies } from "next/headers";
import { decodeSession, SESSION_COOKIE, type Session } from "./session";

/** The signed-in session for this request, or null. Server components and route handlers only. */
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return decodeSession(store.get(SESSION_COOKIE)?.value);
}
