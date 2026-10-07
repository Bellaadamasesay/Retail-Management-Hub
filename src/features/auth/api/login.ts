import { api } from "@/lib/api/client";
import type { Role } from "@/lib/api/types";

export interface LoginResult {
  role: Role;
  name: string;
}

export type LoginInput =
  | { email: string; password: string; remember: boolean }
  | { userId: string; pin: string };

interface VerifiedUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

/** Check the credentials, then start the session (the cookie is set server-side). */
export async function login(input: LoginInput): Promise<LoginResult> {
  const user = await api<VerifiedUser>("/api/auth/verify", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return api<LoginResult>("/api/auth/session", {
    method: "POST",
    body: JSON.stringify({ ...user, remember: "remember" in input ? input.remember : false }),
  });
}

export interface PinUser {
  id: string;
  name: string;
}

export function fetchPinUsers() {
  return api<PinUser[]>("/api/auth/pin-users");
}
