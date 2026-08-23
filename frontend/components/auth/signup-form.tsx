"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const MIN_PASSWORD_LENGTH = 6;

interface FieldErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
}

export function SignupForm() {
  const router = useRouter();
  const { signup } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validate(): boolean {
    const errors: FieldErrors = {};
    if (!email.trim()) {
      errors.email = "Email is required.";
    }
    if (!password) {
      errors.password = "Password is required.";
    } else if (password.length < MIN_PASSWORD_LENGTH) {
      errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    }
    if (confirmPassword !== password) {
      errors.confirmPassword = "Passwords do not match.";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await signup(email.trim(), password);
      router.replace("/");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Sign up</CardTitle>
        <CardDescription>Create an account to start uploading plans</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} noValidate>
          <FieldGroup>
            <Field data-invalid={fieldErrors.email ? true : undefined}>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={fieldErrors.email ? true : undefined}
                disabled={isSubmitting}
              />
              <FieldError errors={fieldErrors.email ? [{ message: fieldErrors.email }] : undefined} />
            </Field>

            <Field data-invalid={fieldErrors.password ? true : undefined}>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-invalid={fieldErrors.password ? true : undefined}
                disabled={isSubmitting}
              />
              <FieldError errors={fieldErrors.password ? [{ message: fieldErrors.password }] : undefined} />
            </Field>

            <Field data-invalid={fieldErrors.confirmPassword ? true : undefined}>
              <FieldLabel htmlFor="confirm-password">Confirm password</FieldLabel>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                aria-invalid={fieldErrors.confirmPassword ? true : undefined}
                disabled={isSubmitting}
              />
              <FieldError errors={fieldErrors.confirmPassword ? [{ message: fieldErrors.confirmPassword }] : undefined} />
            </Field>

            {formError && (
              <Alert variant="destructive">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}

            <Field>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Spinner />}
                Create account
              </Button>
              <FieldDescription>
                Already have an account? <Link href="/login">Log in</Link>
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
