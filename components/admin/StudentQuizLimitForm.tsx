"use client";

import { useActionState } from "react";
import { saveStudentQuizQuestionLimitAction, type SignupCodeActionState } from "@/app/admin/actions";

const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700";

export default function StudentQuizLimitForm({ limit }: { limit: number }) {
  const [state, action, pending] = useActionState<SignupCodeActionState, FormData>(saveStudentQuizQuestionLimitAction, {});

  return (
    <form action={action} className="space-y-5 border-y border-slate-200 bg-white py-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <label htmlFor="studentQuizQuestionLimit" className="block text-sm font-medium text-slate-800">
          Questions shown per module
          <select
            id="studentQuizQuestionLimit"
            name="studentQuizQuestionLimit"
            defaultValue={limit}
            className={`mt-2 block w-full border border-slate-300 bg-white px-3 py-2.5 text-sm sm:w-40 ${focus}`}
          >
            {Array.from({ length: 15 }, (_, index) => index + 1).map((count) => (
              <option key={count} value={count}>{count} {count === 1 ? "question" : "questions"}</option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={pending}
          className={`border border-blue-700 bg-blue-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-800 disabled:cursor-wait disabled:opacity-50 ${focus}`}
        >
          {pending ? "Saving..." : "Save settings"}
        </button>
      </div>
      <p className="max-w-2xl text-sm leading-6 text-slate-600">Generated modules can contain up to 15 questions. This setting controls how many are shown to students across all courses; admins can still review the full quiz bank in the course editor.</p>
      {state.success && <p role="status" className="text-sm text-emerald-700">{state.success}</p>}
      {state.error && <p role="alert" className="text-sm text-rose-700">{state.error}</p>}
    </form>
  );
}