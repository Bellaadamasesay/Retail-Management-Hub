import { api } from "@/lib/api/client";
import type { Role } from "@/lib/api/types";

export interface LoginResult {
  role: Role;
  name: string;
}

export type LoginInput =
  | { email: string; password: string; remember: boolean }
  | { userId: string; pin: string };

/** Checks the credentials and starts the session (the server sets the signed cookie). */
export function login(input: LoginInput): Promise<LoginResult> {
  return api<LoginResult>("/api/auth/login", { method: "POST", body: JSON.stringify(input) });
}

export interface PinUser {
  id: string;
  name: string;
}

export function fetchPinUsers() {
  return api<PinUser[]>("/api/auth/pin-users");
}
