"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RemoveStudentButton({ courseId, userId, label }: { courseId: string; userId: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!confirm(`Remove ${label} from this course? Their access and progress will be deleted.`)) return;
    setBusy(true);
    await fetch(`/api/courses/${courseId}/students/${encodeURIComponent(userId)}`, { method: "DELETE" }).catch(() => {});
    router.refresh();
    setBusy(false);
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={busy}
      className="border border-blue-200 bg-white px-2 py-1 text-xs text-blue-700 hover:bg-blue-50 disabled:opacity-40"
    >
      Remove
    </button>
  );
}
