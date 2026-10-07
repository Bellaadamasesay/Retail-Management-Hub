import { HttpResponse, http } from "msw";
import type { AuditChange, AuditEntry, Role, User } from "../../types";
import { adminIds } from "../../fixtures/users";
import { getDb, mockNow } from "../db";

export const NOW = () => mockNow();

export function actorOf(request: Request) {
  return request.headers.get("x-actor-id") ?? adminIds[0];
}

/** Appends an audit entry attributed to whoever made the request. */
export function audit(request: Request, entry: Omit<AuditEntry, "id" | "at" | "actorId">) {
  const db = getDb();
  db.audit.unshift({
    id: `a-${Date.now().toString(36)}-${db.audit.length}`,
    at: NOW(),
    actorId: actorOf(request),
    ...entry,
  });
}

export const fail = (status: number, message: string) => HttpResponse.json({ message }, { status });

/** The signed-in user making this request, as the API knows them (null when no one is identified). */
export function actorUser(request: Request): User | null {
  const id = request.headers.get("x-actor-id");
  return id ? (getDb().users.find((u) => u.id === id) ?? null) : null;
}

/** The actor if they hold one of the roles; otherwise the error response to return. */
export function requireRole(request: Request, ...roles: Role[]): User | Response {
  const actor = actorUser(request);
  if (!actor) return fail(401, "Sign in to continue.");
  if (!roles.includes(actor.role)) return fail(403, "Your role can’t do that.");
  return actor;
}

type Resolver = Parameters<typeof http.get>[1];

/**
 * Every API route except sign-in goes through this: a request from an account
 * that has been revoked is refused straight away (401), so revoking access
 * takes effect on the very next thing that person does.
 */
function guard(resolver: Resolver): Resolver {
  return (info) => {
    const actor = actorUser(info.request);
    if (actor && !actor.active) return fail(401, "Your access has been revoked. Ask a Super Admin to restore it.");
    return resolver(info);
  };
}

export const route = {
  get: (path: string, resolver: Resolver) => http.get(path, guard(resolver)),
  post: (path: string, resolver: Resolver) => http.post(path, guard(resolver)),
  put: (path: string, resolver: Resolver) => http.put(path, guard(resolver)),
  delete: (path: string, resolver: Resolver) => http.delete(path, guard(resolver)),
};

export type { AuditChange };
