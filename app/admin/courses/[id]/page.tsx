import Link from "next/link";
import { notFound } from "next/navigation";
import { isValidObjectId } from "mongoose";
import BuildProgress from "@/components/BuildProgress";
import UploadForm from "@/components/UploadForm";
import { connectDB } from "@/lib/db";
import { Course } from "@/lib/models/Course";

export const dynamic = "force-dynamic";

export default async function AdminCourseMaterialsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isValidObjectId(id)) notFound();

  await connectDB();
  const course = await Course.findOne({ _id: id, catalogVisible: true, archivedAt: null }).lean();
  if (!course) notFound();

  return (
    <section aria-labelledby="materials-heading" className="mx-auto max-w-3xl">
      <Link href="/admin" className="text-sm font-medium text-blue-700 hover:text-blue-900">Back to admin</Link>
      <div className="mb-7 mt-4">
        <p className="text-xs font-semibold uppercase text-blue-700">Course materials</p>
        <h2 id="materials-heading" className="mt-1 text-2xl font-semibold text-slate-950">{course.title}</h2>
        {course.description && <p className="mt-2 text-sm leading-6 text-slate-600">{course.description}</p>}
      </div>

      {course.status === "processing" ? (
        <BuildProgress
          courseId={id}
          initial={{
            status: course.status,
            stage: course.stage ?? "queued",
            title: course.title,
            totalChapters: course.totalChapters ?? 0,
            lecturesDone: course.lecturesDone ?? 0,
            quizzesDone: course.quizzesDone ?? 0,
            error: course.error ?? undefined,
          }}
        />
      ) : course.status === "ready" ? (
        <div className="border-y border-emerald-200 py-5">
          <p className="font-medium text-emerald-800">Study materials are ready for students.</p>
          <Link href={`/courses/${id}`} className="mt-3 inline-block text-sm font-medium text-blue-700 hover:text-blue-900">
            View course
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {course.status === "failed" && (
            <p role="alert" className="border-y border-rose-200 py-4 text-sm text-rose-800">
              {course.error ?? "The course materials could not be processed. Upload a new document to try again."}
            </p>
          )}
          <p className="text-sm text-slate-600">Upload the study document when it is ready. Students will see the course as Coming soon until it finishes building.</p>
          <UploadForm courseId={id} />
        </div>
      )}
    </section>
  );
}