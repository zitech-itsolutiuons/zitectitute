import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import AuthForm from "@/components/AuthForm";
import SiteHeader from "@/components/SiteHeader";
import { safePath } from "@/lib/safePath";
import { isSignupCodeRequired } from "@/lib/signupCodes";

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const callbackUrl = safePath((await searchParams).callbackUrl);
  if ((await auth())?.user) redirect(callbackUrl);
  const requireSignupCode = await isSignupCodeRequired();

  return (
    <>
      <SiteHeader />
      <main className="auth-page mx-auto py-14 sm:py-20">
        <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="mt-3 mb-8 text-sm text-zinc-500">Turn your first document into a course in a few minutes.</p>
        <AuthForm mode="signup" callbackUrl={callbackUrl} requireSignupCode={requireSignupCode} />
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-5 dark:border-slate-700">
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Already have an account?</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Continue with your existing sign-in.</p>
          </div>
          <Link
            href={`/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`}
            className="inline-flex min-h-11 items-center justify-center border-2 border-blue-700 bg-white px-5 py-2 text-sm font-semibold text-blue-800 transition-colors hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 dark:border-blue-400 dark:bg-slate-950 dark:text-blue-300 dark:hover:bg-slate-900"
          >
            Sign in
          </Link>
        </div>
      </main>
    </>
  );
}
