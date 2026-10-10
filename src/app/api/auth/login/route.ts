import { NextResponse } from "next/server";
import { SESSION_COOKIE, signSession } from "@/lib/auth/session";
import { handle, readJson } from "@/server/http";
import { verifyLogin, type LoginBody } from "@/server/users";

const HOUR = 60 * 60;

/** Sign in with email + password, or (shared till) staff id + PIN. Sets the signed session cookie. */
export const POST = handle(async (request) => {
  const body = await readJson<LoginBody>(request);
  const user = await verifyLogin(body);
  const remember = "remember" in body && body.remember === true;
  const lifetime = remember ? 30 * 24 * HOUR : 12 * HOUR;
  const token = await signSession({
    sub: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + lifetime,
  });
  const response = NextResponse.json({ role: user.role, name: user.name });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // "Remember me" keeps the cookie; otherwise it ends with the browser session.
    ...(remember ? { maxAge: lifetime } : {}),
  });
  return response;
});
