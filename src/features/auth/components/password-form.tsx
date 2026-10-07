"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Eye, EyeOff, Loader2, Mail } from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { HelpDialog } from "./help-dialog";

const schema = z.object({
  email: z.string().trim().min(1, "Enter your email address.").email("That doesn’t look like an email address."),
  password: z.string().min(1, "Enter your password."),
  remember: z.boolean(),
});

export type PasswordValues = z.infer<typeof schema>;

interface PasswordFormProps {
  onSubmit: (values: PasswordValues) => Promise<void>;
  /** Server-side failure, e.g. wrong password. */
  error?: string | null;
  /** Show the check mark once the sign-in succeeded and we're redirecting. */
  done?: boolean;
}

export function PasswordForm({ onSubmit, error, done }: PasswordFormProps) {
  const [visible, setVisible] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<PasswordValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", remember: true },
  });
  const remember = useWatch({ control, name: "remember" });

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-5"
      aria-describedby={error ? "login-error" : undefined}
    >
      <div data-stagger className="flex flex-col gap-2">
        <Label htmlFor="email" className="text-sm font-semibold">
          Email Address
        </Label>
        <div className="relative">
          <Mail
            className="pointer-events-none absolute top-1/2 left-3.5 size-[1.1rem] -translate-y-1/2 text-text-secondary"
            aria-hidden="true"
          />
          <Input
            id="email"
            type="email"
            autoComplete="username"
            placeholder="you@retailhub.com"
            aria-invalid={Boolean(errors.email) || Boolean(error)}
            aria-describedby={errors.email ? "email-error" : undefined}
            className="h-12 pl-11 text-sm"
            {...register("email")}
          />
        </div>
        {errors.email ? (
          <p id="email-error" role="alert" className="text-sm text-destructive">
            {errors.email.message}
          </p>
        ) : null}
      </div>

      <div data-stagger className="flex flex-col gap-2">
        <Label htmlFor="password" className="text-sm font-semibold">
          Password
        </Label>
        <div className="relative">
          <Input
            id="password"
            type={visible ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Enter your password"
            aria-invalid={Boolean(errors.password) || Boolean(error)}
            aria-describedby={errors.password ? "password-error" : undefined}
            className="h-12 pr-12 text-sm"
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Hide password" : "Show password"}
            aria-pressed={visible}
            className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-text-secondary outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {visible ? <EyeOff className="size-[1.1rem]" /> : <Eye className="size-[1.1rem]" />}
          </button>
        </div>
        {errors.password ? (
          <p id="password-error" role="alert" className="text-sm text-destructive">
            {errors.password.message}
          </p>
        ) : null}
      </div>

      <div data-stagger className="flex items-center justify-between gap-3 text-sm">
        <label className="flex cursor-pointer items-center gap-2.5 text-text-secondary">
          <Checkbox
            checked={remember}
            onCheckedChange={(checked) => setValue("remember", checked === true)}
            aria-label="Remember me"
          />
          Remember me
        </label>
        <HelpDialog trigger="Forgot password?" title="Forgot your password?">
          Passwords and PINs are reset by a Super Admin. Ask them to open Users, choose your
          name and reset your password, then sign in with the new one.
        </HelpDialog>
      </div>

      {error ? (
        <p
          id="login-error"
          role="alert"
          className="rounded-lg bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      <Button
        data-stagger
        type="submit"
        size="lg"
        disabled={isSubmitting || done}
        className={cn("h-12 w-full text-[0.9375rem] font-medium", done && "disabled:opacity-100")}
      >
        {done ? (
          <>
            <Check aria-hidden="true" /> Signed in
          </>
        ) : isSubmitting ? (
          <>
            <Loader2 className="animate-spin" aria-hidden="true" /> Signing in…
          </>
        ) : (
          "Sign In"
        )}
      </Button>
    </form>
  );
}
