"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { safePath } from "@/lib/safePath";
import { createUser, SignUpSchema } from "@/lib/users";

export type FormState = { error?: string };

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "");

async function credentialsSignIn(email: string, password: string, redirectTo: string): Promise<FormState> {
  try {
    await signIn("credentials", { email, password, redirectTo, callbackUrl: redirectTo });
  } catch (err) {
    if (err instanceof AuthError) return { error: "Incorrect email or password, or too many attempts. Try again in a few minutes." };
    throw err; // a successful sign-in redirects by throwing NEXT_REDIRECT: let it through
  }

  redirect(redirectTo);
  return {};
}

export async function signInAction(_prev: FormState, fd: FormData): Promise<FormState> {
  return credentialsSignIn(text(fd, "email"), text(fd, "password"), safePath(text(fd, "callbackUrl")));
}

export async function signUpAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const password = text(fd, "password");
  if (password !== text(fd, "confirmPassword")) {
    return { error: "Passwords don’t match. Enter the same password in both fields." };
  }

  const parsed = SignUpSchema.safeParse({ name: text(fd, "name"), email: text(fd, "email"), password });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const created = await createUser(parsed.data, text(fd, "signupCode"));
  if (!created.ok) return { error: created.error };

  return credentialsSignIn(parsed.data.email, parsed.data.password, safePath(text(fd, "callbackUrl")));
}
