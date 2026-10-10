import { jwtVerify, SignJWT } from "jose";
import type { Role } from "@/lib/api/types";

/**
 * Signed session (an HS256 JWT in an httpOnly cookie). The proxy reads it to
 * route people to the right pages; the API re-checks the user in the database
 * on every request, so a revoked or re-roled account takes effect at once.
 */
export const SESSION_COOKIE = "rh_session";

export interface Session {
  /** User id (JWT `sub`). */
  sub: string;
  name: string;
  email: string;
  role: Role;
  /** Expiry, seconds since epoch (JWT `exp`). */
  exp: number;
}

const ROLES: Role[] = ["SUPER_ADMIN", "INVENTORY_KEEPER", "CASHIER"];

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error("SESSION_SECRET must be set to a random string of at least 32 characters.");
  }
  return new TextEncoder().encode(value);
}

export async function signSession(session: Session): Promise<string> {
  const { sub, exp, ...claims } = session;
  return new SignJWT(claims).setProtectedHeader({ alg: "HS256" }).setSubject(sub).setExpirationTime(exp).sign(secret());
}

/** The session in a cookie, or null when it's missing, tampered with or expired. */
export async function verifySession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    const { sub, name, email, role, exp } = payload as Partial<Session>;
    if (!sub || !name || !email || !role || !ROLES.includes(role) || typeof exp !== "number") return null;
    return { sub, name, email, role, exp };
  } catch {
    return null;
  }
}
