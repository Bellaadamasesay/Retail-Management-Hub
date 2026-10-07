import { NextResponse } from "next/server";
import { z } from "zod";
import { encodeSession, SESSION_COOKIE, type Session } from "@/lib/auth/session";

const body = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().min(1),
  role: z.enum(["SUPER_ADMIN", "INVENTORY_KEEPER", "CASHIER"]),
  remember: z.boolean().optional(),
});

const HOUR = 60 * 60;

/**
 * Mock only. The browser-side mock API has already checked the credentials
 * (POST /api/auth/verify); this route turns that result into the httpOnly
 * session cookie, which a browser-side mock cannot set. The real backend does
 * both steps in one sign-in call and signs the token.
 */
export async function POST(request: Request) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Missing sign-in details." }, { status: 400 });

  const { id, name, email, role, remember } = parsed.data;
  const lifetime = remember ? 30 * 24 * HOUR : 12 * HOUR;
  const session: Session = { sub: id, name, email, role, exp: Math.floor(Date.now() / 1000) + lifetime };

  const response = NextResponse.json({ role, name });
  response.cookies.set(SESSION_COOKIE, encodeSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // "Remember me" persists the cookie; otherwise it ends with the browser session.
    ...(remember ? { maxAge: lifetime } : {}),
  });
  return response;
}
