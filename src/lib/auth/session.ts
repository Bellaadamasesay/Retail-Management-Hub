import type { Role } from "@/lib/api/types";

/**
 * Mock JWT session. The token is an unsigned three-part JWT-shaped string with
 * the role claim the PRD describes; the real backend will issue signed tokens
 * and the proxy/API will verify them. UI checks are UX only.
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

const b64url = {
  encode: (value: string) =>
    btoa(String.fromCharCode(...new TextEncoder().encode(value)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, ""),
  decode: (value: string) => {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
    return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
  },
};

export function encodeSession(session: Session): string {
  const header = b64url.encode(JSON.stringify({ alg: "none", typ: "JWT" }));
  return `${header}.${b64url.encode(JSON.stringify(session))}.mock`;
}

/** Returns null for a malformed, tampered-shape or expired token. */
export function decodeSession(token: string | undefined, nowSeconds = Date.now() / 1000): Session | null {
  if (!token) return null;
  try {
    const [, payload] = token.split(".");
    const claims = JSON.parse(b64url.decode(payload)) as Partial<Session>;
    const validRole =
      claims.role === "SUPER_ADMIN" ||
      claims.role === "INVENTORY_KEEPER" ||
      claims.role === "CASHIER";
    if (!claims.sub || !claims.name || !claims.email || !validRole) return null;
    if (typeof claims.exp !== "number" || claims.exp <= nowSeconds) return null;
    return claims as Session;
  } catch {
    return null;
  }
}
