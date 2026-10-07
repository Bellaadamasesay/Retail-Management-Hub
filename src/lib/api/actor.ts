/**
 * Who is making the request, for the audit trail. The real API reads this from
 * the JWT; the mock API (which runs in the browser and cannot see the httpOnly
 * cookie) reads it from a header the client adds.
 */
let actorId: string | null = null;

export function setActor(id: string | null) {
  actorId = id;
}

export function actorHeaders(): Record<string, string> {
  return actorId ? { "x-actor-id": actorId } : {};
}
