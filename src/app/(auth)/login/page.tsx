import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginView } from "@/features/auth/components/login-view";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  // useSearchParams (the ?next= redirect target) needs a Suspense boundary.
  return (
    <Suspense>
      <LoginView />
    </Suspense>
  );
}
