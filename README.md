# Zitectitute: setup notes

## Run it

```bash
cp .env.example .env.local     # add MONGODB_URI, DEEPSEEK_API_KEY, PAYSTACK_SECRET_KEY
npm install
npm run seed:admin             # set SEED_ADMIN_* in .env.local first
npm run dev                    # http://localhost:3000
```

The seed command creates an admin account or promotes the account with the configured email. It does not replace an existing account's password. Admins can create document-generated courses or video-only courses using YouTube, Vimeo, or direct MP4/WebM/Ogg lesson links. Learners purchase each course separately or redeem a 100% promo code to unlock it.

Verified with `@mastra/core` 1.71 and `@ai-sdk/openai-compatible` 3.0 (the project typechecks with `tsc --noEmit`
and the parser was smoke-tested on a real PDF). Not yet run end to end against MongoDB and the DeepSeek API.

Pages: `/` landing, `/courses` upload + course list, `/courses/[id]` reader with quiz and assistant.
Auth: Auth.js v5, see the Authentication section below.

## Code practice runner

Course admins can enable code practice in a course editor. HTML, CSS, and JavaScript run in a sandboxed browser preview. Python, Java, and C are sent by the app server to a **self-hosted Piston-compatible runner**; student source is not sent to a third-party execution service.

Set `CODE_RUNNER_URL` in the app server environment to the runner's private base URL (for example, `http://piston:2000` when both services share a private container network). The runner must expose `POST /api/v2/execute` and have Python `3.10.0`, Java `15.0.2`, and C `10.2.0` installed. Do not expose the runner publicly or put its URL in a `NEXT_PUBLIC_` variable. When unset, compiled-language runs return a clear configuration error; browser-based HTML/CSS/JavaScript practice remains available.

The app limits each submission to 30,000 characters, bounds execution time and memory in the runner request, and caps returned output. The runner itself must enforce container/process isolation and resource limits; the app's request limits are not a substitute for sandboxing. Restart the app after changing `CODE_RUNNER_URL`.

## Design system

The visual direction and interaction principles are documented in [DESIGN.md](./DESIGN.md). Theme tokens and shared component styling live in `app/globals.css`; the interface uses warm paper and ink, evergreen actions, and restrained ochre annotations.

| Step             | Input                                                           | Output                     |
| ---------------- | --------------------------------------------------------------- | -------------------------- |
| Sanitize / chunk | none (local code)                                               | none                       |
| Outline          | skeleton: ~60-150 chars per 1,200-char block, capped ~24k chars | small JSON                 |
| Module x N       | one module chunk (max ~9k chars) + module titles                | Markdown, max 2,000 tokens |
| Quiz x N         | that module's Markdown                                          | JSON, max 1,500 tokens     |
| Chat             | one module (max 7k chars) + last 6 turns                         | max 400 tokens             |

Extra savings: static agent instructions first (DeepSeek prefix cache), low temperature (fewer rewrites),
local range repair and option shuffling (no repair calls), no vector DB or embeddings.

## Mastra API notes (1.x)

- Agents need an `id`. Structured output is `generate(prompt, { structuredOutput: { schema, jsonPromptInjection: true } })`
  and the parsed value is `res.object`. `jsonPromptInjection` is needed because DeepSeek has no `json_schema` mode.
- Workflows: `mastra.getWorkflow(id).createRun()` then `run.start({ inputData })`; `.foreach(step, { concurrency })`.
- Generation limits use `modelSettings: { maxOutputTokens, temperature }`.
- If you upgrade `@mastra/core`, run `npx tsc --noEmit` first: these APIs have changed between major versions.

## Editing, regenerating, sharing and analytics

Roles: the person who creates a course is its **owner**. An administrator can promote a registered account to **instructor** in `/admin/users`, then assign that instructor a course in `/admin/courses`. Assigned instructors can edit course content; learners can preview a published course, but must pay for that course or redeem its 100% promo code before lessons, quizzes, course media, and study tools are available.

- **Edit** (`/courses/[id]/edit`, course owner, assigned instructor, or admin): edit course details and module titles; write module content in a visual editor with headings, emphasis, lists, preview and ordered text/video sections; add multiple YouTube, Vimeo, or direct video links between text sections; edit quiz questions
  (2-6 options, pick the correct one, explanation), add, delete and reorder modules, delete the course.
- **Regenerate one module**: rewrites the module (from the source excerpt kept for that module, with optional guidance such as "more worked examples")
  or rebuilds the quiz from the module text in the editor. The result comes back as an **unsaved draft**, so nothing is overwritten until you choose Save.
  Courses built before source excerpts were stored rewrite from the current module instead. Cost: one module in, one module or quiz out.
- **Share** (`/courses/[id]/students`): turn a join link on or off, or replace it with a new one. Signed-in learners can use a link to add an invitation to their course list, then purchase or redeem a 100% promo code. Turning the link off blocks new invitations; use Remove to revoke an existing learner's access.
- **Analytics** (same page, owner only): students, average completion, average quiz score, assistant questions, per-module completion and best-attempt
  quiz averages (modules under 60% are flagged), the five hardest quiz questions, and a per-student table with last activity and a Remove button.
  Per-question results only use each student's latest attempt made after the quiz was last edited, so edits never mix old answers into new questions.
  The instructor's own activity is not counted.

Access rules, all enforced in the API and the pages: course owners, assigned instructors, and administrators can edit course content; only owners can share courses or view course analytics. Assigned instructors cannot change administrator-only settings or use owner-only course actions. Removing the instructor role also removes the user's course assignments. Owners and assigned instructors can read their courses; learners need verified payment or a redeemed 100% promo code to read modules, take quizzes and use the assistant. Invitations alone do not grant course access. Progress is only accepted for real modules of a course the learner can access.

Administrators can inspect learner profile details, course entitlements, payment attempts and learning activity, restrict or restore a learner's access to individual courses, and reset account passwords. Password resets require at least 12 characters and revoke the user's existing sessions. Administrators can edit any course's title, modules, quizzes and final assessment; course deletion, sharing controls and student analytics remain owner-only.

## Learning features

- **Announcements** (`/admin/announcements`): administrators publish platform-wide announcements to learner accounts. Publishing creates durable in-app notifications; learners see new items in their notification inbox and unread badge. Browser push and email notifications are not enabled.
- **Notifications** (`/notifications`): newly published catalogue courses, announcements, certificate awards, new project submissions, instructor feedback, and peer-review assignments appear in the authenticated inbox. Learners can mark individual items or the inbox as read.
- **Certificates** (`/certificates`): a learner earns one certificate per course after completing every lesson, passing each module quiz when present, and passing the final assessment. Passing uses the existing 65% objective-question threshold; theory responses remain review-only. Each certificate has a public verification page at `/certificates/[serial]` and can be printed or saved as a PDF from the browser.
- **Projects and capstones** (`/courses/[id]/projects`): course owners, assigned instructors, and administrators can publish projects with optional due dates, learner-visible milestones, and scored rubric criteria. Enrolled learners can submit written work, an http/https link, or one PDF, DOCX, TXT, JPG, PNG, or WEBP file up to 5 MB. Instructors can score every rubric criterion and leave feedback. Optional peer review assigns up to five enrolled classmates per submission; the instructor selects the count, and learners receive an in-app review assignment. File submissions are stored in MongoDB and served only to the submitting learner, course editors, or an assigned peer reviewer.

## Admin operations

- **Student import** (`/admin/users/import`): upload CSV with `name,email` and optional `studentId,program,level` columns. Imports are limited to 500 rows. Existing accounts and invalid rows are listed as skipped; a one-time results download contains generated temporary passwords for new accounts. Share that file securely. New students can be added directly to a cohort.
- **Cohorts** (`/admin/cohorts`): create learner rosters, associate courses, and add or remove existing learner accounts. Cohorts are separate from course invite-code groups and can filter admin reports.
- **Reports** (`/admin/reports`): filter transaction, revenue, learner activity, and current completion reports by date, course, and cohort; export filtered data as CSV. Attendance is an activity proxy based on the learner/course record's most recent update, not a physical class check-in. CSV exports are capped at 10,000 rows.
- **Media protection** (`/admin/videos`): embedded course media uses one-hour HMAC-signed, uncached URLs and checks the embedding page's referrer against the app host or `VIDEO_ALLOWED_DOMAINS`. Set the latter to exact comma-separated host names and restart/redeploy. `AUTH_SECRET` signs URLs unless `VIDEO_SIGNING_SECRET` is set. YouTube/Vimeo hosting remains controlled by the video provider; configure the same domain restrictions in provider settings.
- **Audit and backups** (`/admin/audit`): administrator account, course, cohort, report-export, and backup actions are retained in the audit log. Passwords and temporary import credentials are never logged. Configure a separate `BACKUP_ENCRYPTION_KEY` (32+ characters) to download compressed, AES-256-GCM encrypted Extended JSON database snapshots. The decryption key must be stored separately from backup files; downloads are capped at 512 MB uncompressed.

## Course pricing and Paystack

Admins manage per-course prices and promo codes at `/admin/pricing`. Set a price in NGN before learners can purchase that course. A ready, priced course can be purchased from its direct link; **List in catalogue** controls whether learners can discover it in the public course list. Learners with an invitation can also purchase invite-only courses. A 50% code discounts a Paystack checkout; a 100% code grants access without payment. Codes are course-specific and reusable until an admin deactivates them. Each learner receives access once per course, and a confirmed payment is verified with Paystack before access is granted.

## Course categories

Admins manage course categories at `/admin/categories`. Create a category before creating a document-based or coming-soon course; a category is required for new courses. Existing courses can be assigned or reassigned from the Category column in `/admin/courses`. Categories organize the published homepage course list, and a category cannot be deleted while courses are assigned to it.

Set `PAYSTACK_SECRET_KEY` in the server environment. Never expose it in a `NEXT_PUBLIC_` variable or commit it. Use a Paystack test key during integration testing, and replace it with a live key only when ready to accept real payments. Configure the Paystack webhook URL as `{your-origin}/api/payments/webhook`; transaction callbacks are verified server-side before course access is created. If using a payment test key, use the matching Paystack test payment methods.

Tested end to end with `next dev`, a local Mongo-compatible database (FerretDB) and a mock model server: the full background build through the real Mastra workflow,
every edit, reorder, add and delete (including validation errors), regeneration returning drafts without saving, sharing on/off/reset, student vs owner
permissions on every route and page, progress and assistant counters, the dashboard numbers (also unit-tested), removing students and course deletion.
Not tested: a real DeepSeek response (prompts and validation are exercised, but not real model output), the browser UI (forms and editor interactions),
and MongoDB proper.

Known limits: regeneration is one synchronous request (up to 2 minutes) with no per-user cooldown, so add rate limiting before opening it up;
the dashboard reads up to 1,000 students; reordering is not atomic if interrupted midway (modules still sort correctly and the next reorder repairs it);
students can't leave a course themselves yet; there is no CSV export.

## Background builds

`POST /api/courses` validates the upload, creates the course, returns `202`, and runs `buildCourse()` via Next's `after()`.
Progress (stage, modules done) is stored on the Course document; `/courses/[id]` polls
`GET /api/courses/[id]/status` every 2 seconds and switches to the reader when the build finishes.

- Model calls retry up to 3 times with backoff. A module whose quiz keeps failing ships without a quiz.
- A build with no progress for 10 minutes is reported as interrupted (server restart or timeout).
- Limits: the job runs inside the web process and the uploaded file is held in memory, so a restart loses in-flight builds.
  On serverless hosts `maxDuration` (300s) also caps the build. For heavy traffic move `buildCourse()` into a queue worker
  (BullMQ, Inngest, QStash) and store the upload in object storage; the status endpoint and progress screen stay the same.

## Authentication (Auth.js v5)

Users can sign up and sign in with **email and password**, and optionally with Google and/or GitHub. Sessions are JWTs.

Setup:

1. `npx auth secret` and put the value in `AUTH_SECRET`. Email/password also needs `MONGODB_URI`.
2. Optional OAuth: create an OAuth app per provider, register `{origin}/api/auth/callback/google` and/or `/github`
   (`http://localhost:3000` in dev), and set `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` and/or `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET`.
   A provider button only appears when its id is set.
3. Self-hosting behind a proxy: also set `AUTH_TRUST_HOST=true`.

Pages: `/signin`, `/signup`. New accounts receive a generated, read-only Student ID shown on `/profile`; administrators can use it to find the learner in activity reports. Wiring: `auth.config.ts` (edge-safe half, used by `middleware.ts`), `auth.ts` (adds the email/password
provider, Node only), `lib/users.ts` (sign-up, credential check), `lib/password.ts` (scrypt hashing), `lib/auth.ts` (`getUserId()`).
Pages redirect to `/signin` and API routes return `401` on their own too, and every course, module and chat request is checked against the owner.

Password handling: scrypt (N=2^15) with a random salt, stored as `scrypt$N$r$p$salt$hash`. After 5 wrong passwords an account is locked for
15 minutes. Failures look identical for unknown email, wrong password and locked account, and a dummy hash is verified for unknown emails so timing does not reveal them.

Tested: typecheck, plus against a local Mongo-compatible database (FerretDB): sign-up validation, duplicate and concurrent sign-ups (exactly one wins),
login with case-insensitive email, lockout and recovery, and through the real Auth.js endpoints: wrong password rejected, correct password creates a
session, `/courses` works only with that session, and an upload by that user reaches the background build and fails cleanly when the model is unreachable.
Not tested: OAuth logins (need your provider credentials), the browser form submit, and MongoDB proper (FerretDB is close but not identical).

Known gaps:

- No email verification and no password reset (both need an email service). Anyone can register any email address.
- Sign-up says when an email is already registered, which reveals that it has an account. Lockout lets someone deliberately lock a known email for 15 minutes.
  Add per-IP rate limiting on `/signin` and `/signup` before going public.
- The user id is the ObjectId (email users) or the provider account id (OAuth users), so one person using several methods gets separate accounts.
- JWT sessions cannot be revoked server-side until you add a database session strategy.

## Production TODOs

Add per-user rate limiting on `/api/chat` and log token usage per course.
