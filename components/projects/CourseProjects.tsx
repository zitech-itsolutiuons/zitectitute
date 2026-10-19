"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Milestone = { _id?: string; title: string; description: string };
type RubricCriterion = { criterion: string; description: string; points: number };
type Project = {
  _id: string;
  title: string;
  description: string;
  instructions: string;
  milestones: Milestone[];
  rubric: RubricCriterion[];
  peerReviewEnabled: boolean;
  peerReviewerCount: number;
  dueAt: string | null;
  closedAt: string | null;
};
type FileInfo = { filename: string; size: number } | null;
type Score = { criterionIndex: number; score: number };
type Submission = {
  _id: string;
  projectId: string;
  userId: string;
  writtenResponse: string;
  projectLink: string;
  completedMilestoneIds: string[];
  submittedAt: string | null;
  instructorFeedback: string;
  rubricScores: Score[];
  learner?: { name: string; email: string };
  file: FileInfo;
};
type Review = {
  _id: string;
  projectId: string;
  submissionId: string;
  rubricScores: Score[];
  feedback: string;
  submittedAt: string | null;
};
type AssignedReview = {
  reviewId: string;
  projectId: string;
  submission: { _id: string; writtenResponse: string; projectLink: string; file: FileInfo } | null;
};
type ProjectData = { projects: Project[]; submissions: Submission[]; reviews: Review[]; receivedReviews: Review[]; reviewSubmissions: AssignedReview[] };

const fieldClass = "mt-1.5 block min-h-11 w-full border border-[#b9c3b8] bg-[#fffdf8] px-3 text-sm text-[#26312d] outline-none focus:border-[#355f4c] focus:ring-2 focus:ring-[#355f4c]/20 dark:border-[#59695e] dark:bg-[#1c2922] dark:text-[#f2eee4]";
const textAreaClass = `${fieldClass} min-h-28 py-2.5 leading-6`;
const actionClass = "inline-flex min-h-10 items-center justify-center border border-[#355f4c] bg-[#355f4c] px-4 text-sm font-semibold text-[#fffdf8] hover:bg-[#294a3b] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#355f4c] dark:border-[#9abd9f] dark:bg-[#9abd9f] dark:text-[#17211d] dark:hover:bg-[#b5c9b5]";
const quietActionClass = "inline-flex min-h-10 items-center justify-center border border-[#b9c3b8] px-4 text-sm font-semibold text-[#355f4c] hover:bg-[#e9f0e8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#355f4c] dark:border-[#59695e] dark:text-[#b5c9b5] dark:hover:bg-[#2b3a32]";

function emptyProjectForm() {
  return {
    title: "",
    description: "",
    instructions: "",
    milestones: [] as Milestone[],
    rubric: [{ criterion: "", description: "", points: 100 }] as RubricCriterion[],
    peerReviewEnabled: false,
    peerReviewerCount: 1,
    dueAt: "",
  };
}

function dateLabel(value: string | null) {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "";
}

function formatBytes(size: number) {
  return size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function toLocalDateTime(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export default function CourseProjects({ courseId, courseTitle, canEdit }: { courseId: string; courseTitle: string; canEdit: boolean }) {
  const [data, setData] = useState<ProjectData>({ projects: [], submissions: [], reviews: [], receivedReviews: [], reviewSubmissions: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [savingMilestone, setSavingMilestone] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [peerAssignments, setPeerAssignments] = useState<Record<string, number>>({});
  const [editingProjectId, setEditingProjectId] = useState("");
  const [form, setForm] = useState(emptyProjectForm);
  const [submissionText, setSubmissionText] = useState<Record<string, string>>({});
  const [submissionLink, setSubmissionLink] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const response = await fetch(`/api/courses/${courseId}/projects`, { cache: "no-store" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error ?? "Projects could not be loaded.");
    const nextData = {
      projects: result.projects as Project[],
      submissions: result.submissions as Submission[],
      reviews: (result.reviews ?? []) as Review[],
      receivedReviews: (result.receivedReviews ?? []) as Review[],
      reviewSubmissions: (result.reviewSubmissions ?? []) as AssignedReview[],
    };
    setData(nextData);
    setSubmissionText(Object.fromEntries(nextData.submissions.map((submission) => [submission.projectId, submission.writtenResponse ?? ""])));
    setSubmissionLink(Object.fromEntries(nextData.submissions.map((submission) => [submission.projectId, submission.projectLink ?? ""])));
  }, [courseId]);

  useEffect(() => {
    let active = true;
    fetch(`/api/courses/${courseId}/projects`, { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error ?? "Projects could not be loaded.");
        if (!active) return;
        const nextData = {
          projects: result.projects as Project[],
          submissions: result.submissions as Submission[],
          reviews: (result.reviews ?? []) as Review[],
          receivedReviews: (result.receivedReviews ?? []) as Review[],
          reviewSubmissions: (result.reviewSubmissions ?? []) as AssignedReview[],
        };
        setData(nextData);
        setSubmissionText(Object.fromEntries(nextData.submissions.map((submission) => [submission.projectId, submission.writtenResponse ?? ""])));
        setSubmissionLink(Object.fromEntries(nextData.submissions.map((submission) => [submission.projectId, submission.projectLink ?? ""])));
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Projects could not be loaded.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [courseId]);

  const submissionsByProject = useMemo(
    () => new Map(data.submissions.map((submission) => [submission.projectId, submission])),
    [data.submissions]
  );

  async function saveProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`/api/courses/${courseId}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          projectId: editingProjectId || undefined,
          dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : null,
          peerReviewerCount: form.peerReviewEnabled ? Number(form.peerReviewerCount) : 0,
          milestones: form.milestones.filter((milestone) => milestone.title.trim()),
          rubric: form.rubric.filter((criterion) => criterion.criterion.trim()).map((criterion) => ({ ...criterion, points: Number(criterion.points) })),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Project could not be saved.");
      await load();
      setForm(emptyProjectForm());
      setEditingProjectId("");
      setSuccess(editingProjectId ? "Project changes saved." : "Project published.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Project could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  function editProject(project: Project) {
    setEditingProjectId(project._id);
    setForm({
      title: project.title,
      description: project.description,
      instructions: project.instructions,
      milestones: project.milestones.map((milestone) => ({ ...milestone, _id: String(milestone._id ?? "") })),
      rubric: project.rubric.map((criterion) => ({ ...criterion })),
      peerReviewEnabled: project.peerReviewEnabled,
      peerReviewerCount: project.peerReviewerCount || 1,
      dueAt: project.dueAt ? toLocalDateTime(project.dueAt) : "",
    });
    setSuccess("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function toggleProject(project: Project) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/courses/${courseId}/projects`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project._id, closed: !project.closedAt }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Project status could not be changed.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Project status could not be changed.");
    } finally {
      setBusy(false);
    }
  }

  async function saveMilestones(project: Project, completedIds: string[]) {
    setSavingMilestone(project._id);
    setError("");
    try {
      const response = await fetch(`/api/projects/${project._id}/milestones`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completedMilestoneIds: completedIds }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Milestone progress could not be saved.");
      setData((previous) => ({
        ...previous,
        submissions: previous.submissions.map((submission) => submission.projectId === project._id
          ? { ...submission, completedMilestoneIds: result.completedMilestoneIds }
          : submission),
      }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Milestone progress could not be saved.");
    } finally {
      setSavingMilestone("");
    }
  }

  async function submitProject(event: React.FormEvent<HTMLFormElement>, project: Project) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const formData = new FormData(formElement);
    const file = formData.get("file");
    if (file instanceof File && file.size > 5 * 1024 * 1024) {
      setError("Choose a file smaller than 5 MB.");
      return;
    }
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`/api/projects/${project._id}/submissions`, { method: "POST", body: formData });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Project work could not be submitted.");
      setPeerAssignments((previous) => ({ ...previous, [project._id]: result.assignedReviewCount }));
      await load();
      setSuccess(project.peerReviewEnabled
        ? `Project submitted. ${result.assignedReviewCount} peer ${result.assignedReviewCount === 1 ? "reviewer was" : "reviewers were"} assigned.`
        : "Project submitted.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Project work could not be submitted.");
    } finally {
      setBusy(false);
    }
  }

  async function submitReview(event: React.FormEvent<HTMLFormElement>, project: Project, assignment: AssignedReview) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const rubricScores = project.rubric.map((criterion, criterionIndex) => ({
      criterionIndex,
      score: Number(values.get(`score-${criterionIndex}`)),
    }));
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/projects/${project._id}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: assignment.submission?._id,
          rubricScores,
          feedback: values.get("feedback"),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Peer review could not be submitted.");
      await load();
      setSuccess("Peer feedback submitted.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Peer review could not be submitted.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-9">
      <div className="border-b border-[#d9d5ca] pb-5 dark:border-[#394941]">
        <Link href={`/courses/${courseId}`} className="text-xs font-semibold text-[#355f4c] underline underline-offset-4 dark:text-[#b5c9b5]">Return to course</Link>
        <h1 className="mt-3 font-serif text-3xl font-semibold tracking-[-0.025em] text-[#26312d] dark:text-[#f2eee4]">Projects & capstones</h1>
        <p className="mt-2 max-w-[65ch] text-sm leading-6 text-[#59685e] dark:text-[#c0c8bf]">{courseTitle} · Plan milestones, review the rubric, and submit work in one place.</p>
      </div>
      {error && <p role="alert" className="border-y border-red-300 py-3 text-sm font-semibold text-red-800 dark:border-red-800 dark:text-red-300">{error}</p>}
      {success && <p role="status" className="border-y border-[#d3dfd2] py-3 text-sm font-semibold text-[#355f4c] dark:border-[#44604b] dark:text-[#b5c9b5]">{success}</p>}

      {canEdit && (
        <section aria-labelledby="project-editor-heading" className="border-y border-[#d9d5ca] py-6 dark:border-[#394941]">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="project-editor-heading" className="font-serif text-2xl font-semibold text-[#26312d] dark:text-[#f2eee4]">{editingProjectId ? "Edit project" : "Create a project"}</h2>
              <p className="mt-1 text-sm leading-6 text-[#59685e] dark:text-[#c0c8bf]">Set expectations, break the work into milestones, and define how it will be assessed.</p>
            </div>
            {editingProjectId && <button type="button" className={quietActionClass} onClick={() => { setForm(emptyProjectForm()); setEditingProjectId(""); }}>Cancel editing</button>}
          </div>
          <form onSubmit={saveProject} className="mt-5 grid gap-x-6 gap-y-4 lg:grid-cols-2">
            <label className="text-sm font-semibold text-[#26312d] dark:text-[#f2eee4] lg:col-span-2">Project title
              <input className={fieldClass} required minLength={3} maxLength={160} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
            </label>
            <label className="text-sm font-semibold text-[#26312d] dark:text-[#f2eee4] lg:col-span-2">What will learners make?
              <textarea className={textAreaClass} required minLength={3} maxLength={5000} rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
            </label>
            <label className="text-sm font-semibold text-[#26312d] dark:text-[#f2eee4] lg:col-span-2">Instructions and resources
              <textarea className={textAreaClass} maxLength={20_000} rows={5} value={form.instructions} onChange={(event) => setForm({ ...form, instructions: event.target.value })} placeholder="Explain the task, submission expectations, and any resources learners need." />
            </label>
            <label className="text-sm font-semibold text-[#26312d] dark:text-[#f2eee4]">Due date (optional)
              <input type="datetime-local" className={fieldClass} value={form.dueAt} onChange={(event) => setForm({ ...form, dueAt: event.target.value })} />
            </label>
            <div className="text-sm font-semibold text-[#26312d] dark:text-[#f2eee4]">
              Peer review
              <label className="mt-2 flex min-h-11 items-center gap-2 font-normal">
                <input type="checkbox" checked={form.peerReviewEnabled} onChange={(event) => setForm({ ...form, peerReviewEnabled: event.target.checked })} className="h-4 w-4 accent-[#355f4c]" />
                Assign classmates to review submissions
              </label>
              {form.peerReviewEnabled && (
                <label className="mt-2 block text-sm font-normal">Reviewers per submission
                  <select className={fieldClass} value={form.peerReviewerCount} onChange={(event) => setForm({ ...form, peerReviewerCount: Number(event.target.value) })}>
                    {[1, 2, 3, 4, 5].map((count) => <option key={count} value={count}>{count} {count === 1 ? "reviewer" : "reviewers"}</option>)}
                  </select>
                </label>
              )}
            </div>

            <fieldset className="space-y-3 border-t border-[#d9d5ca] pt-4 dark:border-[#394941] lg:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <legend className="font-serif text-lg font-semibold">Milestones</legend>
                <button type="button" className={quietActionClass} onClick={() => setForm({ ...form, milestones: [...form.milestones, { title: "", description: "" }] })}>Add milestone</button>
              </div>
              <p className="text-xs leading-5 text-[#59685e] dark:text-[#c0c8bf]">List checkpoints learners can mark complete as they work.</p>
              {form.milestones.map((milestone, index) => (
                <div key={milestone._id || index} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto]">
                  <label className="text-xs font-semibold">Milestone {index + 1}<input required className={fieldClass} value={milestone.title} maxLength={120} onChange={(event) => setForm({ ...form, milestones: form.milestones.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item) })} /></label>
                  <label className="text-xs font-semibold">What counts as done?<input className={fieldClass} value={milestone.description} maxLength={2000} onChange={(event) => setForm({ ...form, milestones: form.milestones.map((item, itemIndex) => itemIndex === index ? { ...item, description: event.target.value } : item) })} /></label>
                  <button type="button" aria-label={`Remove milestone ${index + 1}`} className={`${quietActionClass} self-end`} onClick={() => setForm({ ...form, milestones: form.milestones.filter((_, itemIndex) => itemIndex !== index) })}>Remove</button>
                </div>
              ))}
            </fieldset>

            <fieldset className="space-y-3 border-t border-[#d9d5ca] pt-4 dark:border-[#394941] lg:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <legend className="font-serif text-lg font-semibold">Assessment rubric</legend>
                <button type="button" className={quietActionClass} onClick={() => setForm({ ...form, rubric: [...form.rubric, { criterion: "", description: "", points: 10 }] })}>Add criterion</button>
              </div>
              <p className="text-xs leading-5 text-[#59685e] dark:text-[#c0c8bf]">Give learners clear criteria and a maximum point value for each one.</p>
              {form.rubric.map((criterion, index) => (
                <div key={index} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_7rem_auto]">
                  <label className="text-xs font-semibold">Criterion {index + 1}<input required className={fieldClass} value={criterion.criterion} maxLength={160} onChange={(event) => setForm({ ...form, rubric: form.rubric.map((item, itemIndex) => itemIndex === index ? { ...item, criterion: event.target.value } : item) })} /></label>
                  <label className="text-xs font-semibold">Description<input className={fieldClass} value={criterion.description} maxLength={2000} onChange={(event) => setForm({ ...form, rubric: form.rubric.map((item, itemIndex) => itemIndex === index ? { ...item, description: event.target.value } : item) })} /></label>
                  <label className="text-xs font-semibold">Maximum points<input type="number" min={1} max={100} required className={fieldClass} value={criterion.points} onChange={(event) => setForm({ ...form, rubric: form.rubric.map((item, itemIndex) => itemIndex === index ? { ...item, points: Number(event.target.value) } : item) })} /></label>
                  <button type="button" disabled={form.rubric.length === 1} aria-label={`Remove criterion ${index + 1}`} className={`${quietActionClass} self-end`} onClick={() => setForm({ ...form, rubric: form.rubric.filter((_, itemIndex) => itemIndex !== index) })}>Remove</button>
                </div>
              ))}
            </fieldset>
            <div className="flex flex-wrap items-center gap-3 lg:col-span-2">
              <button type="submit" disabled={busy} className={actionClass}>{busy ? "Saving…" : editingProjectId ? "Save project changes" : "Publish project"}</button>
              {success && <span role="status" className="text-sm font-medium text-[#355f4c] dark:text-[#b5c9b5]">{success}</span>}
            </div>
          </form>
        </section>
      )}

      {loading ? (
        <p role="status" className="py-8 text-sm text-[#59685e] dark:text-[#c0c8bf]">Loading course projects…</p>
      ) : data.projects.length === 0 ? (
        <div className="border-y border-[#d9d5ca] py-8 dark:border-[#394941]">
          <h2 className="font-serif text-xl font-semibold">No projects published</h2>
          <p className="mt-2 text-sm leading-6 text-[#59685e] dark:text-[#c0c8bf]">{canEdit ? "Create a project above to give learners a practical way to apply what they have learned." : "Your instructor has not added a project to this course yet."}</p>
        </div>
      ) : (
        <section aria-labelledby="course-project-list-heading">
          <div className="border-b border-[#d9d5ca] pb-3 dark:border-[#394941]">
            <h2 id="course-project-list-heading" className="font-serif text-2xl font-semibold text-[#26312d] dark:text-[#f2eee4]">{canEdit ? "Published projects" : "Your project work"}</h2>
            <p className="mt-1 text-sm text-[#59685e] dark:text-[#c0c8bf]">{data.projects.length} {data.projects.length === 1 ? "project" : "projects"} in this course.</p>
          </div>
          <ol className="divide-y divide-[#d9d5ca] dark:divide-[#394941]">
            {data.projects.map((project) => {
              const submission = submissionsByProject.get(project._id);
              const completeIds = submission?.completedMilestoneIds ?? [];
              const assignedReviews = data.reviewSubmissions.filter((item) => item.projectId === project._id);
              const authoredReviews = data.receivedReviews.filter((review) => review.projectId === project._id);
              return (
                <li key={project._id} id={`project-${project._id}`} className="py-7">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <h3 className="font-serif text-2xl font-semibold text-[#26312d] dark:text-[#f2eee4]">{project.title}</h3>
                        <span className={`text-xs font-semibold uppercase tracking-[0.1em] ${project.closedAt ? "text-[#758278]" : "text-[#456b55] dark:text-[#b5c9b5]"}`}>{project.closedAt ? "Closed" : "Open"}</span>
                      </div>
                      <p className="mt-2 max-w-[75ch] whitespace-pre-wrap text-sm leading-6 text-[#46564c] dark:text-[#d0d8d0]">{project.description}</p>
                      {project.dueAt && <p className="mt-2 text-xs font-semibold text-[#59685e] dark:text-[#c0c8bf]">Due {dateLabel(project.dueAt)}</p>}
                    </div>
                    {canEdit && <div className="flex gap-2">
                      <button type="button" className={quietActionClass} onClick={() => editProject(project)}>Edit</button>
                      <button type="button" disabled={busy} className={quietActionClass} onClick={() => void toggleProject(project)}>{project.closedAt ? "Reopen" : "Close"}</button>
                    </div>}
                  </div>

                  {project.instructions && <div className="mt-5 max-w-[78ch] border-t border-[#d9d5ca] pt-4 dark:border-[#394941]"><h4 className="text-sm font-semibold">Instructions and resources</h4><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#46564c] dark:text-[#d0d8d0]">{project.instructions}</p></div>}
                  {project.milestones.length > 0 && (
                    <fieldset className="mt-5 max-w-3xl border-t border-[#d9d5ca] pt-4 dark:border-[#394941]">
                      <legend className="font-serif text-lg font-semibold">Milestones</legend>
                      <ul className="mt-3 space-y-3">
                        {project.milestones.map((milestone) => {
                          const milestoneId = String(milestone._id);
                          const checked = completeIds.includes(milestoneId);
                          return (
                            <li key={milestoneId} className="flex items-start gap-3">
                              {!canEdit && <input type="checkbox" checked={checked} disabled={savingMilestone === project._id} onChange={(event) => void saveMilestones(project, event.target.checked ? [...completeIds, milestoneId] : completeIds.filter((id) => id !== milestoneId))} className="mt-1 h-4 w-4 shrink-0 accent-[#355f4c]" aria-label={`Mark ${milestone.title} ${checked ? "incomplete" : "complete"}`} />}
                              <div className="min-w-0">
                                <p className={`text-sm font-semibold ${checked && !canEdit ? "text-[#355f4c] dark:text-[#b5c9b5]" : "text-[#26312d] dark:text-[#f2eee4]"}`}>{milestone.title}{checked && !canEdit ? " · Complete" : ""}</p>
                                {milestone.description && <p className="mt-0.5 text-sm leading-5 text-[#59685e] dark:text-[#c0c8bf]">{milestone.description}</p>}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </fieldset>
                  )}

                  <section className="mt-5 max-w-4xl border-t border-[#d9d5ca] pt-4 dark:border-[#394941]">
                    <h4 className="font-serif text-lg font-semibold">Assessment rubric</h4>
                    <div className="mt-2 overflow-x-auto">
                      <table className="w-full border-collapse text-left text-sm">
                        <thead><tr className="border-b border-[#b9c3b8] text-xs uppercase tracking-[0.08em] text-[#59685e] dark:border-[#59695e] dark:text-[#c0c8bf]"><th className="py-2 pr-4 font-semibold">Criterion</th><th className="py-2 pr-4 font-semibold">What your instructor looks for</th><th className="py-2 text-right font-semibold">Points</th></tr></thead>
                        <tbody>{project.rubric.map((criterion, index) => <tr key={index} className="border-b border-[#e4e2da] dark:border-[#303f37]"><th scope="row" className="py-2 pr-4 font-semibold">{criterion.criterion}</th><td className="py-2 pr-4 text-[#59685e] dark:text-[#c0c8bf]">{criterion.description || "See the project instructions."}</td><td className="py-2 text-right tabular-nums">{criterion.points}</td></tr>)}</tbody>
                      </table>
                    </div>
                  </section>

                  {canEdit ? (
                    <div className="mt-6 border-t border-[#d9d5ca] pt-4 dark:border-[#394941]">
                      <h4 className="font-serif text-lg font-semibold">Learner submissions</h4>
                      {data.submissions.filter((item) => item.projectId === project._id && item.submittedAt).length === 0 ? (
                        <p className="mt-2 text-sm text-[#59685e] dark:text-[#c0c8bf]">Submissions will appear here as learners send in their work.</p>
                      ) : (
                        <ol className="mt-2 divide-y divide-[#e4e2da] dark:divide-[#303f37]">
                          {data.submissions.filter((item) => item.projectId === project._id && item.submittedAt).map((item) => (
                            <li key={item._id} id={`submission-${item._id}`} className="py-5">
                              <div className="flex flex-wrap justify-between gap-3">
                                <div><p className="font-semibold">{item.learner?.name ?? "Learner"}</p><p className="text-xs text-[#59685e] dark:text-[#c0c8bf]">{item.learner?.email} · Submitted {dateLabel(item.submittedAt)}</p></div>
                                {item.file && <a className="text-sm font-semibold text-[#355f4c] underline underline-offset-4 dark:text-[#b5c9b5]" href={`/api/project-submissions/${item._id}/file`}>Download {item.file.filename} ({formatBytes(item.file.size)})</a>}
                              </div>
                              {item.writtenResponse && <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{item.writtenResponse}</p>}
                              {item.projectLink && <a href={item.projectLink} target="_blank" rel="noreferrer" className="mt-2 inline-block break-all text-sm font-semibold text-[#355f4c] underline underline-offset-4 dark:text-[#b5c9b5]">Open project link</a>}
                              <InstructorFeedbackForm project={project} submission={item} onSaved={async () => { await load(); setSuccess("Instructor feedback saved."); }} setError={setError} />
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  ) : (
                    <section id={`project-${project._id}-work`} className="mt-6 border-t border-[#d9d5ca] pt-4 dark:border-[#394941]">
                      <h4 className="font-serif text-lg font-semibold">Your submission</h4>
                      {submission?.submittedAt && <p className="mt-1 text-xs text-[#59685e] dark:text-[#c0c8bf]">Last submitted {dateLabel(submission.submittedAt)}</p>}
                      {submission?.file && <p className="mt-2 text-sm"><a href={`/api/project-submissions/${submission._id}/file`} className="font-semibold text-[#355f4c] underline underline-offset-4 dark:text-[#b5c9b5]">Download your file: {submission.file.filename}</a> <span className="text-[#59685e] dark:text-[#c0c8bf]">({formatBytes(submission.file.size)})</span></p>}
                      {submission?.instructorFeedback && <div className="mt-4 border-y border-[#d9d5ca] py-3 dark:border-[#394941]"><h5 className="text-sm font-semibold">Instructor feedback</h5><p className="mt-1 whitespace-pre-wrap text-sm leading-6">{submission.instructorFeedback}</p></div>}
                      {submission?.rubricScores.length ? <p className="mt-2 text-xs font-semibold text-[#59685e] dark:text-[#c0c8bf]">Instructor rubric: {submission.rubricScores.map((score) => `${project.rubric[score.criterionIndex]?.criterion ?? "Criterion"} ${score.score}/${project.rubric[score.criterionIndex]?.points ?? "—"}`).join(" · ")}</p> : null}
                      {authoredReviews.map((review) => <div key={review._id} className="mt-3 border-y border-[#d9d5ca] py-3 dark:border-[#394941]"><h5 className="text-sm font-semibold">Peer feedback</h5><p className="mt-1 whitespace-pre-wrap text-sm leading-6">{review.feedback}</p><p className="mt-1 text-xs text-[#59685e] dark:text-[#c0c8bf]">{review.rubricScores.map((score) => `${project.rubric[score.criterionIndex]?.criterion ?? "Criterion"}: ${score.score}`).join(" · ")}</p></div>)}
                      {!project.closedAt && (
                        <form onSubmit={(event) => void submitProject(event, project)} className="mt-4 grid gap-4 lg:grid-cols-2">
                          <label className="text-sm font-semibold lg:col-span-2">Written response
                            <textarea name="writtenResponse" maxLength={20_000} rows={5} className={textAreaClass} value={submissionText[project._id] ?? ""} onChange={(event) => setSubmissionText({ ...submissionText, [project._id]: event.target.value })} placeholder="Describe your approach or include written project work." />
                          </label>
                          <label className="text-sm font-semibold">Project link
                            <input name="projectLink" type="url" maxLength={2048} className={fieldClass} value={submissionLink[project._id] ?? ""} onChange={(event) => setSubmissionLink({ ...submissionLink, [project._id]: event.target.value })} placeholder="https://…" />
                          </label>
                          <label className="text-sm font-semibold">Attach a file (up to 5 MB)
                            <input name="file" type="file" accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,image/jpeg,image/png,image/webp" className={`${fieldClass} py-2 file:mr-3 file:border-0 file:bg-[#e9f0e8] file:px-3 file:py-1 file:text-xs file:font-semibold file:text-[#355f4c] dark:file:bg-[#2b3a32] dark:file:text-[#b5c9b5]`} />
                          </label>
                          <div className="flex flex-wrap items-center gap-3 lg:col-span-2">
                            <button type="submit" disabled={busy} className={actionClass}>{busy ? "Submitting…" : submission?.submittedAt ? "Update submission" : "Submit project"}</button>
                            {peerAssignments[project._id] !== undefined && <span className="text-sm text-[#59685e] dark:text-[#c0c8bf]">{peerAssignments[project._id]} peer reviewers assigned.</span>}
                          </div>
                        </form>
                      )}
                    </section>
                  )}

                  {assignedReviews.map((assignedReview) => assignedReview.submission && (
                    <PeerReviewForm key={assignedReview.reviewId} project={project} assignment={assignedReview} submitted={data.reviews.some((review) => review._id === assignedReview.reviewId && review.submittedAt)} busy={busy} onSubmit={submitReview} />
                  ))}
                </li>
              );
            })}
          </ol>
        </section>
      )}
      {!canEdit && data.reviewSubmissions.some((item) => !data.projects.some((project) => project._id === item.projectId)) && (
        <p className="text-sm text-[#59685e] dark:text-[#c0c8bf]">Some review assignments belong to a project that is no longer available.</p>
      )}
    </div>
  );
}

function PeerReviewForm({
  project,
  assignment,
  submitted,
  busy,
  onSubmit,
}: {
  project: Project;
  assignment: AssignedReview;
  submitted: boolean;
  busy: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>, project: Project, assignment: AssignedReview) => Promise<void>;
}) {
  if (!assignment.submission) return null;
  return (
    <section id={`review-${assignment.reviewId}`} className="mt-7 border-y border-[#d9d5ca] py-5 dark:border-[#394941]">
      <h4 className="font-serif text-lg font-semibold">Review a classmate’s work</h4>
      <p className="mt-1 text-sm leading-6 text-[#59685e] dark:text-[#c0c8bf]">Use the same rubric your instructor will apply. Keep feedback specific and respectful.</p>
      {assignment.submission.writtenResponse && <p className="mt-4 whitespace-pre-wrap text-sm leading-6">{assignment.submission.writtenResponse}</p>}
      {assignment.submission.projectLink && <a href={assignment.submission.projectLink} target="_blank" rel="noreferrer" className="mt-3 inline-block break-all text-sm font-semibold text-[#355f4c] underline underline-offset-4 dark:text-[#b5c9b5]">Open submitted project</a>}
      {assignment.submission.file && <a href={`/api/project-submissions/${assignment.submission._id}/file`} className="mt-3 block text-sm font-semibold text-[#355f4c] underline underline-offset-4 dark:text-[#b5c9b5]">Download {assignment.submission.file.filename}</a>}
      {submitted ? (
        <p className="mt-4 text-sm font-semibold text-[#355f4c] dark:text-[#b5c9b5]">Your review has been submitted.</p>
      ) : (
        <form onSubmit={(event) => void onSubmit(event, project, assignment)} className="mt-4 space-y-4">
          {project.rubric.map((criterion, index) => (
            <label key={index} className="block max-w-md text-sm font-semibold">{criterion.criterion} <span className="font-normal text-[#59685e] dark:text-[#c0c8bf]">(max {criterion.points})</span>
              <input name={`score-${index}`} type="number" required min={0} max={criterion.points} defaultValue={0} className={fieldClass} />
              {criterion.description && <span className="mt-1 block text-xs font-normal leading-5 text-[#59685e] dark:text-[#c0c8bf]">{criterion.description}</span>}
            </label>
          ))}
          <label className="block max-w-3xl text-sm font-semibold">Feedback
            <textarea name="feedback" required minLength={3} maxLength={5000} rows={4} className={textAreaClass} placeholder="Share one strength and one practical suggestion." />
          </label>
          <button type="submit" disabled={busy} className={actionClass}>{busy ? "Sending…" : "Submit peer review"}</button>
        </form>
      )}
    </section>
  );
}

function InstructorFeedbackForm({
  project,
  submission,
  onSaved,
  setError,
}: {
  project: Project;
  submission: Submission;
  onSaved: () => Promise<void>;
  setError: (error: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(submission.instructorFeedback);
  const [scores, setScores] = useState(project.rubric.map((_, index) => submission.rubricScores.find((score) => score.criterionIndex === index)?.score ?? 0));
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/projects/${project._id}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: submission._id,
          feedback,
          rubricScores: scores.map((score, criterionIndex) => ({ criterionIndex, score })),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Instructor feedback could not be saved.");
      await onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Instructor feedback could not be saved.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save} className="mt-4 grid gap-3 border-t border-[#e4e2da] pt-4 dark:border-[#303f37] md:grid-cols-2">
      <h5 className="font-semibold md:col-span-2">Instructor assessment</h5>
      {project.rubric.map((criterion, index) => <label key={index} className="text-xs font-semibold">{criterion.criterion} (max {criterion.points})
        <input type="number" required min={0} max={criterion.points} value={scores[index] ?? 0} onChange={(event) => setScores((previous) => previous.map((score, scoreIndex) => scoreIndex === index ? Number(event.target.value) : score))} className={fieldClass} />
      </label>)}
      <label className="text-sm font-semibold md:col-span-2">Feedback for learner
        <textarea required minLength={3} maxLength={10_000} rows={4} value={feedback} onChange={(event) => setFeedback(event.target.value)} className={textAreaClass} />
      </label>
      <button type="submit" disabled={busy} className={`${actionClass} w-fit`}>{busy ? "Saving…" : "Save assessment"}</button>
    </form>
  );
}
