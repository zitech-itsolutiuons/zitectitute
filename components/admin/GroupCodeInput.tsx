"use client";

export default function GroupCodeInput({ code }: { code: string }) {
  return (
    <input
      readOnly
      value={code}
      onFocus={(event) => event.currentTarget.select()}
      className="mt-1 block min-h-10 w-full border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900"
      aria-label="Group code"
    />
  );
}
