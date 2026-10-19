"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  archiveCourseAction,
  permanentlyDeleteCourseAction,
  restoreCourseAction,
  type CourseActionState,
} from "@/app/admin/courses/actions";

const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700";
const hiddenCourseId = (courseId: string) => <input type="hidden" name="courseId" value={courseId} />;

export default function CourseManagementActions({
  courseId,
  courseTitle,
  archived,
}: {
  courseId: string;
  courseTitle: string;
  archived: boolean;
}) {
  const [archiveState, archiveAction, archivePending] = useActionState<CourseActionState, FormData>(archiveCourseAction, {});
  const [restoreState, restoreAction, restorePending] = useActionState<CourseActionState, FormData>(restoreCourseAction, {});
  const [deleteState, deleteAction, deletePending] = useActionState<CourseActionState, FormData>(permanentlyDeleteCourseAction, {});
  const router = useRouter();

  useEffect(() => {
    if (archiveState.success || restoreState.success || deleteState.success) router.refresh();
  }, [archiveState.success, restoreState.success, deleteState.success, router]);

  const error = archiveState.error || restoreState.error || deleteState.error;
  const pending = archivePending || restorePending || deletePending;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium">
        {archived ? (
          <form action={restoreAction}>
            {hiddenCourseId(courseId)}
            <button type="submit" disabled={pending} className={`text-blue-700 hover:text-blue-900 disabled:opacity-50 ${focus}`}>
              {restorePending ? "Restoring…" : "Restore"}
            </button>
          </form>
        ) : (
          <form action={archiveAction}>
            {hiddenCourseId(courseId)}
            <button type="submit" disabled={pending} className={`text-blue-700 hover:text-blue-900 disabled:opacity-50 ${focus}`}>
              {archivePending ? "Archiving…" : "Archive"}
            </button>
          </form>
        )}
        <form
          action={deleteAction}
          onSubmit={(event) => {
            if (!window.confirm(`Permanently delete “${courseTitle}”? This removes its modules, media, student notes and progress, quiz data, promo codes and course access. Payment records are retained. This cannot be undone. Consider archiving it instead.`)) {
              event.preventDefault();
            }
          }}
        >
          {hiddenCourseId(courseId)}
          <button type="submit" disabled={pending} className={`text-rose-700 hover:text-rose-900 disabled:opacity-50 ${focus}`}>
            {deletePending ? "Deleting…" : "Delete permanently"}
          </button>
        </form>
      </div>
      {error && <p role="alert" className="max-w-sm text-xs leading-5 text-rose-700">{error}</p>}
      {(archiveState.success || restoreState.success || deleteState.success) && (
        <p role="status" className="text-xs text-emerald-700">{archiveState.success || restoreState.success || deleteState.success}</p>
      )}
    </div>
  );
}
