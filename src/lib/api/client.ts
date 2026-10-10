/**
 * The single place the UI talks to the API (Next route handlers under /api,
 * backed by Postgres). The session travels in its httpOnly cookie.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** The parsed error body, for errors that carry detail (e.g. which items were short). */
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (response.status === 401 && typeof window !== "undefined" && !path.startsWith("/api/auth/")) {
    // The account was revoked (or the session ended) while the app was open: sign out and say why.
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    window.location.assign("/login?reason=revoked");
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(body?.message ?? `Request failed (${response.status})`, response.status, body);
  }
  return (await response.json()) as T;
}
