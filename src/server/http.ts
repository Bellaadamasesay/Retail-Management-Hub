import { NextResponse } from "next/server";

/** An expected failure: becomes `{ message }` (or a richer body) with this status. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** Replaces `{ message }` when the client needs detail (e.g. which items ran short). */
    readonly body?: unknown,
  ) {
    super(message);
  }
}

export const fail = (status: number, message: string, body?: unknown) => new HttpError(status, message, body);

/** Postgres error codes we turn into friendly answers. */
const PG_UNIQUE = "23505";
const PG_CHECK = "23514";

export function pgCode(error: unknown): string | undefined {
  const cause = (error as { cause?: { code?: string } })?.cause;
  return (error as { code?: string })?.code ?? cause?.code;
}

export const isUniqueViolation = (error: unknown) => pgCode(error) === PG_UNIQUE;

type Handler<C> = (request: Request, context: C) => Promise<unknown>;

/**
 * Wraps a route handler: returns plain values as JSON (201 for `created()`),
 * HttpErrors as their status, and anything unexpected as a logged 500.
 */
export function handle<C = unknown>(fn: Handler<C>) {
  return async (request: Request, context: C): Promise<Response> => {
    try {
      const result = await fn(request, context);
      if (result instanceof Response) return result;
      if (result instanceof Created) return NextResponse.json(result.body, { status: 201 });
      return NextResponse.json(result);
    } catch (error) {
      if (error instanceof HttpError) {
        return NextResponse.json(error.body ?? { message: error.message }, { status: error.status });
      }
      if (pgCode(error) === PG_CHECK) {
        return NextResponse.json({ message: "That would take stock below zero. Refresh and try again." }, { status: 409 });
      }
      console.error(`[api] ${request.method} ${new URL(request.url).pathname}`, error);
      return NextResponse.json({ message: "Something went wrong on our side. Try again in a moment." }, { status: 500 });
    }
  };
}

class Created {
  constructor(readonly body: unknown) {}
}

/** Respond 201 with this body. */
export const created = (body: unknown) => new Created(body);

/** The request body as JSON, or a 400 when it isn't. */
export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw fail(400, "That request wasn’t valid. Reload the page and try again.");
  }
}

/** Route params, awaited (Next passes them as a promise). */
export type Params<K extends string> = { params: Promise<Record<K, string>> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: unknown): value is string => typeof value === "string" && UUID.test(value);

/** An id from the URL; anything that isn't one of ours is simply "not found". */
export function idParam(value: string, what: string): string {
  if (!isUuid(value)) throw fail(404, `${what} not found`);
  return value;
}
