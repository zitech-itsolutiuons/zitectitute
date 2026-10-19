"use client";

import { useActionState, useState, type FormEvent } from "react";
import { signInAction, signUpAction } from "@/app/signin/actions";

const focus =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";
const input = `mt-1 block w-full border border-blue-200 bg-white px-3 py-2 text-sm ${focus}`;

export default function AuthForm({ mode, callbackUrl, requireSignupCode = false }: { mode: "signin" | "signup"; callbackUrl: string; requireSignupCode?: boolean }) {
  const [state, action, pending] = useActionState(mode === "signin" ? signInAction : signUpAction, {});
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswordMismatch, setShowPasswordMismatch] = useState(false);
  const signup = mode === "signup";
  const passwordMismatch = signup && confirmPassword.length > 0 && password !== confirmPassword;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (signup && password !== confirmPassword) {
      event.preventDefault();
      setShowPasswordMismatch(true);
    }
  }

  return (
    <form action={action} onSubmit={handleSubmit} className="space-y-4">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      {signup && (
        <div>
          <label htmlFor="name" className="text-sm font-medium">
            Name
          </label>
          <input id="name" name="name" type="text" autoComplete="name" required maxLength={80} className={input} />
        </div>
      )}
      {signup && requireSignupCode && (
        <div>
          <label htmlFor="signupCode" className="text-sm font-medium">
            Signup code
          </label>
          <input
            id="signupCode"
            name="signupCode"
            type="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            required
            maxLength={32}
            aria-describedby="signup-code-hint"
            className={`${input} uppercase`}
          />
          <p id="signup-code-hint" className="mt-1 text-xs text-zinc-500">
            Enter the six-character code provided by your administrator.
          </p>
        </div>
      )}
      <div>
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input id="email" name="email" type="email" autoComplete="email" required className={input} />
      </div>
      <div>
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <div className="password-field">
          <input
            id="password"
            name="password"
            type={passwordVisible ? "text" : "password"}
            autoComplete={signup ? "new-password" : "current-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={signup ? 8 : undefined}
            maxLength={128}
            aria-describedby={signup ? "password-hint" : undefined}
            className={`${input} password-field__input`}
          />
          <button
            type="button"
            className="password-field__toggle"
            aria-label={`${passwordVisible ? "Hide" : "Show"} password`}
            aria-controls="password"
            aria-pressed={passwordVisible}
            onClick={() => setPasswordVisible((visible) => !visible)}
          >
            {passwordVisible ? (
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
                <path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8" />
                <path d="M9.9 5.2A10.8 10.8 0 0112 5c5 0 8.5 4.5 9.5 7-.4 1-1.2 2-2.2 3M6.2 6.2C3.8 7.7 2.6 10 2.5 12c1 2.5 4.5 7 9.5 7 1.3 0 2.5-.3 3.6-.8" />
              </svg>
            ) : (
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
                <path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
                <circle cx="12" cy="12" r="2.5" />
              </svg>
            )}
          </button>
        </div>
        {signup && (
          <p id="password-hint" className="mt-1 text-xs text-zinc-500">
            At least 8 characters.
          </p>
        )}
      </div>
      {signup && (
        <div>
          <label htmlFor="confirmPassword" className="text-sm font-medium">
            Confirm password
          </label>
          <div className="password-field">
            <input
              id="confirmPassword"
              name="confirmPassword"
              type={confirmPasswordVisible ? "text" : "password"}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
                setShowPasswordMismatch(false);
              }}
              required
              minLength={8}
              maxLength={128}
              aria-invalid={showPasswordMismatch && passwordMismatch}
              aria-describedby={showPasswordMismatch && passwordMismatch ? "confirm-password-error" : undefined}
              className={`${input} password-field__input`}
            />
            <button
              type="button"
              className="password-field__toggle"
              aria-label={`${confirmPasswordVisible ? "Hide" : "Show"} confirm password`}
              aria-controls="confirmPassword"
              aria-pressed={confirmPasswordVisible}
              onClick={() => setConfirmPasswordVisible((visible) => !visible)}
            >
              {confirmPasswordVisible ? (
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
                  <path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8" />
                  <path d="M9.9 5.2A10.8 10.8 0 0112 5c5 0 8.5 4.5 9.5 7-.4 1-1.2 2-2.2 3M6.2 6.2C3.8 7.7 2.6 10 2.5 12c1 2.5 4.5 7 9.5 7 1.3 0 2.5-.3 3.6-.8" />
                </svg>
              ) : (
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
                  <path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
                  <circle cx="12" cy="12" r="2.5" />
                </svg>
              )}
            </button>
          </div>
          {showPasswordMismatch && passwordMismatch && (
            <p id="confirm-password-error" role="alert" className="mt-1 text-xs text-rose-700 dark:text-rose-300">
              Passwords don’t match. Enter the same password in both fields.
            </p>
          )}
        </div>
      )}

      {state.error && (
        <p role="alert" className="border-0 border-l border-blue-200 pl-3 text-sm text-blue-700">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className={`min-h-12 w-full border border-blue-700 bg-blue-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-40 hover:bg-blue-800 ${focus}`}
      >
        {pending ? (signup ? "Creating account" : "Signing in") : signup ? "Create account" : "Sign in"}
      </button>
    </form>
  );
}
