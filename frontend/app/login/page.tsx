"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { AuthBrand } from "@/components/auth/auth-brand";
import { LoginForm } from "@/components/auth/login-form";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      router.replace("/");
    }
  }, [isLoading, user, router]);

  if (isLoading || user) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Spinner className="size-6" />
      </div>
    );
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center p-6">
      <AuthBrand />
      <LoginForm />
    </div>
  );
}
