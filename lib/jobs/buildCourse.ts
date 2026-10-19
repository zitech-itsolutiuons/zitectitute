import { connectDB } from "../db";
import { parseDocumentWithMedia } from "../ingestion/parser";
import { Course, Chapter, CourseFinalAssessment, CourseMedia, Quiz } from "../models/Course";
import { notifyLearnersAboutCourse } from "../courseNotifications";
import { mastra } from "../../mastra";
import { setProgress } from "./progress";
import { writeFinalAssessment } from "../../mastra/generation";

const GENERIC_ERROR = "Something went wrong while writing the course. Upload the document again.";

const fail = (courseId: string, error: string) =>
  setProgress(courseId, { status: "failed", stage: "failed", error });

/**
 * Runs after the upload response has been sent (see POST /api/courses).
 * Never throws: every outcome is written to the Course document instead.
 * The file buffer only lives in memory for the duration of the job.
 */
export async function buildCourse(courseId: string, buffer: Buffer, mimeType: string, preserveCourseDetails = false) {
  try {
    await connectDB();
    const existingCourse = preserveCourseDetails
      ? await Course.findById(courseId).select("title description").lean()
      : null;
    await setProgress(courseId, { stage: "parsing" });

    let parsed: Awaited<ReturnType<typeof parseDocumentWithMedia>>;
    try {
      parsed = await parseDocumentWithMedia(buffer, mimeType);
    } catch (err) {
      // Parser messages are written for users ("unsupported type", "scanned PDF").
      return await fail(courseId, (err as Error).message);
    }

    await setProgress(courseId, { stage: "outline" });
    const run = await mastra.getWorkflow("courseBuilder").createRun();
    const result = await run.start({ inputData: { text: parsed.text, courseId } });
    if (result.status !== "success") throw new Error(`Workflow ended with status ${result.status}`);
    const chapters = result.result;
    let finalAssessment = null;
    try {
      finalAssessment = await writeFinalAssessment({
        courseTitle: chapters[0].courseTitle,
        chapters: chapters.map((chapter) => ({ title: chapter.title, contentMd: chapter.contentMd })),
      });
    } catch (err) {
      console.warn(`[final-assessment] course ${courseId} skipped`, err);
    }

    await setProgress(courseId, { stage: "saving" });
    // Idempotent: a re-run replaces any partial output.
    await Quiz.deleteMany({ courseId });
    await CourseFinalAssessment.deleteOne({ courseId });
    await Chapter.deleteMany({ courseId });
    await CourseMedia.deleteMany({ courseId, index: { $gte: 0 } });
    if (parsed.images.length) {
      await CourseMedia.insertMany(parsed.images.map((image) => ({ ...image, courseId })));
    }
    const docs = await Chapter.insertMany(
      chapters.map((c) => ({
        courseId,
        index: c.index,
        title: c.title,
        summary: c.summary,
        contentMd: c.contentMd,
        sourceText: c.sourceText,
      }))
    );
    await Quiz.insertMany(docs.map((d, i) => ({ courseId, chapterId: d._id, questions: chapters[i].quiz })));
    if (finalAssessment) await CourseFinalAssessment.create({ courseId, ...finalAssessment });

    await Course.updateOne(
      { _id: courseId },
      {
        $set: {
          title: existingCourse?.title ?? chapters[0].courseTitle,
          description: existingCourse?.description || chapters[0].courseDescription,
          topics: chapters[0].topics,
          learningOutcomes: chapters[0].learningOutcomes,
          prerequisites: chapters[0].prerequisites,
          skills: chapters[0].skills,
          tools: chapters[0].tools,
          careerBenefits: chapters[0].careerBenefits,
          jobRoles: chapters[0].jobRoles,
          chapterCount: chapters.length,
          status: "ready",
          stage: "ready",
        },
      }
    );

    const publishedCourse = await Course.findOne({
      _id: courseId,
      status: "ready",
      catalogVisible: true,
      archivedAt: null,
    }).select("title").lean();
    if (publishedCourse) {
      try {
        await notifyLearnersAboutCourse(courseId, publishedCourse.title);
      } catch (err) {
        console.error("[course-notifications]", courseId, err);
      }
    }
  } catch (err) {
    console.error("[buildCourse]", courseId, err);
    await fail(courseId, GENERIC_ERROR);
  }
}
