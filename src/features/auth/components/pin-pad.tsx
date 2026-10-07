"use client";

import { Check, Delete } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useShake } from "@/lib/motion/use-shake";
import { cn, initials } from "@/lib/utils";
import type { PinUser } from "../api/login";

const PIN_LENGTH = 4;
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

interface PinPadProps {
  users: PinUser[];
  /** Resolves true when the PIN was accepted. */
  onSubmit: (userId: string, pin: string) => Promise<boolean>;
  error?: string | null;
  done?: boolean;
}

/** Big, tactile PIN entry for shared cashier tablets: pick your name, tap four digits. */
export function PinPad({ users, onSubmit, error, done }: PinPadProps) {
  const [userId, setUserId] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const { ref: dotsRef, shake } = useShake<HTMLDivElement>();

  const submit = useCallback(
    async (id: string, value: string) => {
      setBusy(true);
      const ok = await onSubmit(id, value);
      setBusy(false);
      if (!ok) {
        shake();
        setPin("");
      }
    },
    [onSubmit, shake],
  );

  const press = useCallback(
    (digit: string) => {
      if (busy || done || !userId || pin.length >= PIN_LENGTH) return;
      const next = pin + digit;
      setPin(next);
      if (next.length === PIN_LENGTH) void submit(userId, next);
    },
    [busy, done, userId, pin, submit],
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (/^\d$/.test(event.key)) press(event.key);
      else if (event.key === "Backspace") setPin((p) => p.slice(0, -1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press]);

  return (
    <div className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">Who&apos;s signing in?</legend>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Staff member">
          {users.map((user) => {
            const selected = user.id === userId;
            return (
              <button
                key={user.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => {
                  setUserId(user.id);
                  setPin("");
                }}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                  selected
                    ? "border-primary bg-primary-subtle"
                    : "border-border bg-input-background hover:border-ring",
                )}
              >
                <Avatar className="size-9">
                  <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
                    {initials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium">{user.name}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div
        ref={dotsRef}
        role="group"
        aria-label={`PIN, ${pin.length} of ${PIN_LENGTH} digits entered`}
        className="flex justify-center gap-4 py-1"
      >
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <span
            key={i}
            className={cn(
              "size-4 rounded-full border-2 transition-colors",
              i < pin.length ? "border-primary bg-primary" : "border-border",
              error && pin.length === 0 && "border-destructive",
            )}
          />
        ))}
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3.5 py-2.5 text-center text-sm text-destructive">
          {error}
        </p>
      ) : done ? (
        <p role="status" className="flex items-center justify-center gap-2 text-sm font-medium text-success">
          <Check className="size-4" aria-hidden="true" /> Signed in
        </p>
      ) : (
        <p className="text-center text-sm text-text-secondary">
          {userId ? "Enter your 4-digit PIN" : "Choose your name first"}
        </p>
      )}

      <div className="mx-auto grid w-full max-w-72 grid-cols-3 gap-3">
        {KEYS.map((key) => (
          <PadKey key={key} disabled={!userId || busy || done} onClick={() => press(key)}>
            {key}
          </PadKey>
        ))}
        <span />
        <PadKey disabled={!userId || busy || done} onClick={() => press("0")}>
          0
        </PadKey>
        <PadKey
          label="Delete last digit"
          disabled={pin.length === 0 || busy || done}
          onClick={() => setPin((p) => p.slice(0, -1))}
        >
          <Delete className="size-5" aria-hidden="true" />
        </PadKey>
      </div>
    </div>
  );
}

function PadKey({
  children,
  label,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  label?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid h-14 place-items-center rounded-xl border border-border bg-card text-xl font-medium outline-none transition-[transform,background-color] hover:bg-surface-hover focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95 disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  );
}
