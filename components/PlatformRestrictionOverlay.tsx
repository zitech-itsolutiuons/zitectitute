import RestrictedSignOutButton from "@/components/RestrictedSignOutButton";

export default function PlatformRestrictionOverlay() {
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-[2px]">
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="platform-restriction-title"
        aria-describedby="platform-restriction-description"
        className="w-full max-w-md border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.24)] dark:border-slate-700 dark:bg-slate-900 sm:p-8"
      >
        <div className="mb-5 flex h-11 w-11 items-center justify-center border border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5">
            <rect x="5" y="10" width="14" height="11" rx="1" stroke="currentColor" strokeWidth="1.7" />
            <path d="M8 10V7a4 4 0 1 1 8 0v3M12 14v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        </div>
        <h1 id="platform-restriction-title" className="text-xl font-semibold text-slate-950 dark:text-white">
          Your account has been restricted
        </h1>
        <p id="platform-restriction-description" className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
          An administrator has restricted your access to Zitectitute. Courses and other platform features are unavailable while this restriction is active.
        </p>
        <div className="mt-6">
          <RestrictedSignOutButton />
        </div>
      </section>
    </div>
  );
}
