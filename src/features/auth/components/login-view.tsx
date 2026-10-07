"use client";

import { BarChart3, Hash, Mail, PackageOpen, ReceiptText } from "lucide-react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/providers/theme-toggle";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { landingPath } from "@/lib/rbac/routes";
import { useShake } from "@/lib/motion/use-shake";
import { useStaggerIn } from "@/lib/motion/use-stagger-in";
import { fetchPinUsers, login, type PinUser } from "../api/login";
import { HelpDialog } from "./help-dialog";
import { PasswordForm, type PasswordValues } from "./password-form";
import { PinPad } from "./pin-pad";

const features = [
  { icon: PackageOpen, title: "Inventory Control", text: "Keep track of your stock in real time" },
  { icon: BarChart3, title: "Sales & POS", text: "Fast and simple checkout" },
  { icon: ReceiptText, title: "Reports & Insights", text: "Make data-driven decisions" },
] as const;

/** A `next` target is only honoured when it is a path inside this app. */
function safeNext(next: string | null): string | null {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : null;
}

export function LoginView() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));

  const [mode, setMode] = useState<"password" | "pin">("password");
  const [error, setError] = useState<string | null>(
    params.get("reason") === "revoked" ? "Your access was revoked or your session ended. Sign in again, or ask a Super Admin." : null,
  );
  const [done, setDone] = useState(false);
  const [pinUsers, setPinUsers] = useState<PinUser[]>([]);

  const reveal = useStaggerIn<HTMLDivElement>({ selector: "[data-stagger]", y: 14 });
  const { ref: cardRef, shake } = useShake<HTMLDivElement>();

  useEffect(() => {
    if (mode !== "pin" || pinUsers.length > 0) return;
    fetchPinUsers()
      .then(setPinUsers)
      .catch(() => setError("Couldn’t load the staff list. Check your connection and try again."));
  }, [mode, pinUsers.length]);

  const finish = useCallback(
    (role: keyof typeof landingPath) => {
      setDone(true);
      router.replace(next ?? landingPath[role]);
      router.refresh();
    },
    [router, next],
  );

  const failure = useCallback(
    (e: unknown) => {
      setError(
        e instanceof ApiError
          ? e.message
          : "We couldn’t reach the server. Check your connection and try again.",
      );
      shake();
    },
    [shake],
  );

  async function signInWithPassword(values: PasswordValues) {
    setError(null);
    try {
      const result = await login(values);
      finish(result.role);
    } catch (e) {
      failure(e);
    }
  }

  const signInWithPin = useCallback(
    async (userId: string, pin: string) => {
      setError(null);
      try {
        const result = await login({ userId, pin });
        finish(result.role);
        return true;
      } catch (e) {
        failure(e);
        return false;
      }
    },
    [finish, failure],
  );

  return (
    <main className="grid min-h-dvh lg:grid-cols-[57fr_43fr]">
      {/* Brand panel */}
      <section className="relative hidden overflow-hidden bg-background lg:block">
        <Image
          src="/images/login-hero-light.png"
          alt=""
          width={375}
          height={611}
          priority
          className="absolute inset-y-0 right-0 h-full w-1/2 object-cover object-left [mask-image:linear-gradient(to_right,transparent,black_28%)] dark:hidden"
        />
        <Image
          src="/images/login-hero-dark.png"
          alt=""
          width={375}
          height={587}
          priority
          className="absolute inset-y-0 right-0 hidden h-full w-1/2 object-cover object-left [mask-image:linear-gradient(to_right,transparent,black_28%)] dark:block"
        />
        <div className="relative z-10 flex h-full flex-col px-12 py-9 xl:px-28">
          <Logo size="lg" />
          <h1 className="mt-14 max-w-[9ch] font-display text-[2.5rem] leading-[1.15] font-bold">
            Manage Your Store with Ease
          </h1>
          <p className="mt-6 max-w-[16rem] text-[1.0625rem] leading-relaxed text-text-secondary">
            Track sales, manage inventory and grow your business all in one place.
          </p>
          <ul className="mt-9 flex flex-col gap-5">
            {features.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-center gap-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-kpi-sage-bg text-kpi-forest-fg">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-[0.9375rem] font-semibold">{title}</span>
                  <span className="block text-sm text-text-secondary">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Sign-in panel */}
      <section className="relative flex items-center justify-center bg-background-subtle px-5 pt-20 pb-10 sm:px-10">
        <div className="absolute top-5 right-5 sm:top-6 sm:right-6">
          <ThemeToggle />
        </div>
        <div ref={reveal} className="w-full max-w-[26.5rem]">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <div
            ref={cardRef}
            className="rounded-2xl border bg-card p-8 shadow-soft sm:p-10"
          >
            <div data-stagger>
              <h2 className="font-display text-[1.75rem] leading-tight font-bold">Welcome Back</h2>
              <p className="mt-1.5 text-[0.9375rem] text-text-secondary">
                {mode === "password"
                  ? "Sign in to your account to continue"
                  : "Choose your name and enter your PIN"}
              </p>
            </div>

            <div className="mt-8">
              {mode === "password" ? (
                <PasswordForm onSubmit={signInWithPassword} error={error} done={done} />
              ) : (
                <PinPad users={pinUsers} onSubmit={signInWithPin} error={error} done={done} />
              )}
            </div>

            <div data-stagger className="mt-6 flex items-center gap-4 text-sm text-text-secondary">
              <span className="h-px flex-1 bg-border" />
              or
              <span className="h-px flex-1 bg-border" />
            </div>

            <Button
              data-stagger
              type="button"
              variant="outline"
              size="lg"
              disabled={done}
              onClick={() => {
                setError(null);
                setMode(mode === "password" ? "pin" : "password");
              }}
              className="mt-6 h-12 w-full gap-2"
            >
              {mode === "password" ? (
                <>
                  <Hash aria-hidden="true" /> Sign in with PIN
                </>
              ) : (
                <>
                  <Mail aria-hidden="true" /> Sign in with email
                </>
              )}
            </Button>

            <p data-stagger className="mt-7 text-center text-sm text-text-secondary">
              Need help?{" "}
              <HelpDialog trigger="Contact support" title="Need a hand?">
                Ask your Super Admin first: they can reset your password or PIN, restore your
                access and change your role. For anything else, tell them what you were trying to do
                and they will pass it on.
              </HelpDialog>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
