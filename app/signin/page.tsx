import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import AuthForm from "@/components/AuthForm";
import SiteHeader from "@/components/SiteHeader";
import { safePath } from "@/lib/safePath";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string; reason?: string }> }) {
  const params = await searchParams;
  const callbackUrl = safePath(params.callbackUrl);
  if ((await auth())?.user) redirect(callbackUrl);

  return (
    <>
      <SiteHeader />
      <main className="auth-page mx-auto py-14 sm:py-20">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in to Zitectitute</h1>
        {params.reason === "inactive" && <p role="status" className="mt-3 border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">You were signed out after 30 minutes of inactivity. Sign in to continue.</p>}
        <p className="mt-3 mb-8 text-sm text-zinc-500">Your courses and quiz results are private to your account.</p>
        <AuthForm mode="signin" callbackUrl={callbackUrl} />
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-5 dark:border-slate-700">
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">New here?</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Create an account to start learning.</p>
          </div>
          <Link
            href={`/signup?callbackUrl=${encodeURIComponent(callbackUrl)}`}
            className="inline-flex min-h-11 items-center justify-center border-2 border-blue-700 bg-white px-5 py-2 text-sm font-semibold text-blue-800 transition-colors hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 dark:border-blue-400 dark:bg-slate-950 dark:text-blue-300 dark:hover:bg-slate-900"
          >
            Create an account
          </Link>
        </div>
      </main>
    </>
  );
}
