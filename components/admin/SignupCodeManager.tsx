"use client";

import { useActionState, useState } from "react";
import {
  generateSignupCodeAction,
  revokeSignupCodeAction,
  saveSignupCodeRequirementAction,
  type SignupCodeActionState,
} from "@/app/admin/actions";

const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700";

export default function SignupCodeManager({
  requireSignupCode,
  codes,
}: {
  requireSignupCode: boolean;
  codes: { id: string; code: string | null; active: boolean; createdAt: string; users: { id: string; name: string; email: string; createdAt: string }[] }[];
}) {
  const [settingsState, settingsAction, settingsPending] = useActionState<SignupCodeActionState, FormData>(saveSignupCodeRequirementAction, {});
  const [codeState, generateAction, generatePending] = useActionState<SignupCodeActionState, FormData>(generateSignupCodeAction, {});

  return (
    <section aria-labelledby="signup-codes-heading" className="space-y-5 border border-slate-200 bg-white p-5 md:p-6">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h2 id="signup-codes-heading" className="text-lg font-semibold text-slate-900">Signup access</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">Control whether new accounts need an administrator-issued code.</p>
        </div>
        <span className={`inline-flex w-fit items-center gap-2 border px-2.5 py-1.5 text-xs font-semibold ${requireSignupCode ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-300 bg-slate-50 text-blue-900"}`}>
          <span aria-hidden="true" className={`h-1.5 w-1.5 ${requireSignupCode ? "bg-emerald-600" : "bg-slate-400"}`} />
          {requireSignupCode ? "Code required" : "Open registration"}
        </span>
      </header>

      <form action={settingsAction} className="flex flex-col justify-between gap-4 border-y border-slate-200 py-4 sm:flex-row sm:items-center">
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input type="checkbox" name="requireSignupCode" defaultChecked={requireSignupCode} className="mt-0.5 h-4 w-4 shrink-0 accent-blue-700" />
          <span>
            <span className="block font-medium text-slate-800">Require a signup code</span>
            <span className="mt-1 block text-xs leading-5 text-slate-500">When off, anyone can create an account without a code.</span>
          </span>
        </label>
        <button type="submit" disabled={settingsPending} className={`w-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-50 sm:w-auto ${focus}`}>
          {settingsPending ? "Saving changes..." : "Save changes"}
        </button>
      </form>
      {settingsState.success && <p role="status" className="-mt-3 text-sm text-emerald-700">{settingsState.success}</p>}
      {settingsState.error && <p role="alert" className="-mt-3 text-sm text-rose-700">{settingsState.error}</p>}

      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Signup codes</h3>
          <p className="mt-1 text-xs text-slate-500">Six letters or numbers. {codes.filter((code) => code.active).length} active of {codes.length} total.</p>
        </div>
        <form action={generateAction}>
          <div className="flex items-end gap-2">
            <label className="text-xs font-medium text-slate-700">
              Number of codes
              <input type="number" name="quantity" min={1} max={25} defaultValue={1} required className={`mt-1 block w-24 border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 ${focus}`} />
            </label>
            <button type="submit" disabled={generatePending} className={`border border-blue-700 bg-blue-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-800 disabled:cursor-wait disabled:opacity-50 ${focus}`}>
              {generatePending ? "Generating..." : "Generate codes"}
            </button>
          </div>
        </form>
      </div>

      {codeState.success && <p role="status" className="text-sm text-emerald-700">{codeState.success}</p>}
      {codeState.error && <p role="alert" className="text-sm text-rose-700">{codeState.error}</p>}

      <div className="border-t border-slate-200 pt-4">
        <h3 className="sr-only">Active signup codes</h3>
        {codes.length > 0 ? (
          <ul className="divide-y divide-slate-200">
            {codes.map((code) => (
              <li key={code.id} className="space-y-3 py-4 first:pt-0">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {code.code ? (
                        <>
                          <code className="break-all font-mono text-sm font-semibold text-slate-900">{code.code}</code>
                          {code.active && <CopyCodeButton code={code.code} />}
                        </>
                      ) : (
                        <span className="text-sm text-slate-500">Code unavailable; revoke and generate a replacement.</span>
                      )}
                      <span className={`border px-2 py-1 text-xs font-medium ${code.active ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-300 bg-slate-50 text-blue-900"}`}>
                        {code.active ? "Active" : "Revoked"}
                      </span>
                    </div>
                    <time dateTime={code.createdAt} className="mt-1 block text-xs text-slate-500">
                      Created {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(code.createdAt))}
                    </time>
                  </div>
                  {code.active && (
                    <form action={revokeSignupCodeAction}>
                      <input type="hidden" name="codeId" value={code.id} />
                      <button type="submit" className={`border border-rose-200 px-3 py-2 text-sm font-medium text-rose-800 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-900 ${focus}`}>Revoke code</button>
                    </form>
                  )}
                </div>
                <details className="text-sm">
                  <summary className="w-fit cursor-pointer text-blue-800 hover:text-blue-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
                    {code.users.length} {code.users.length === 1 ? "signup" : "signups"}
                  </summary>
                  {code.users.length ? (
                    <ul className="mt-2 divide-y divide-slate-100 border-y border-slate-200">
                      {code.users.map((user) => (
                        <li key={user.id} className="flex flex-col justify-between gap-1 py-2 sm:flex-row sm:gap-4">
                          <span className="font-medium text-slate-800">{user.name} <span className="font-normal text-slate-600">{user.email}</span></span>
                          <time dateTime={user.createdAt} className="shrink-0 text-xs text-slate-500">{new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(user.createdAt))}</time>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-slate-500">No one has signed up with this code yet.</p>
                  )}
                </details>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-1 text-sm text-slate-500">No active codes. Generate one to invite new users.</p>
        )}
      </div>
    </section>
  );
}

function CopyCodeButton({ code }: { code: string }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" onClick={copyCode} className={`border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 ${focus}`}>
        {copyState === "copied" ? "Copied" : "Copy"}
      </button>
      {copyState === "error" && <span role="status" className="text-xs text-rose-700">Could not copy</span>}
    </span>
  );
}