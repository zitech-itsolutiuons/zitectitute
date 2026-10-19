# Zitectitute product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Instructors who create and share courses, and learners who purchase courses or redeem a promo code to study and demonstrate their understanding.

## Product Purpose

Provide an instructor-led learning management system focused on web design, HTML, CSS, JavaScript, and computer science. Success means instructors can publish and manage learning materials while learners can study, assess their understanding, and track progress.

## Positioning

Instructors can turn teaching documents into structured lectures with notes and quizzes, then share web-development and computer-science courses with learners in a guided study workspace.

## Operating Context

Instructors upload source documents, manage generated course content, set course prices, invite learners with share links, and review course analytics. Learners sign in, purchase individual courses through Paystack or redeem course-specific promo codes, then study lectures, take quizzes and assessments, ask questions with the course assistant, save notes, and track completion.

## Capabilities and Constraints

- The application has instructor/owner, learner/student, and administrator access roles.
- Administrators can review profile, payment, entitlement and learning activity; restrict individual learners from courses; reset account passwords; and edit any course's content without inheriting course-owner sharing or analytics rights.
- Learners need a verified Paystack payment, a redeemed 100% course promo code, or membership in a cohort assigned to the course to access course content; course invitations only identify courses, they do not unlock them.
- Learners added to a cohort can open its assigned courses and participate in member-only topic discussions and replies.
- Cohort administrators can review learner sign-ins, estimated active time, and course, lesson, assessment, and discussion actions. Learners are informed about monitoring; answer and discussion contents are not included. Cohort activity data is retained for 90 days.
- Signed-in learners can contact administrators through a private, ongoing support conversation in their dashboard. Administrators reply from the support inbox; unread replies are badged for learners when they return. Signed-out users cannot access support conversations.
- Learners and instructors build login streaks through successful sign-ins on consecutive UTC calendar days. A missed day resets the current streak while preserving the best streak.
- Administrators can enable or disable achievement badges platform-wide. When enabled, learners see tiers earned from their longest login streak, total completed modules, and course certificates; disabling badges hides them without deleting learning progress.
- Course prices are set independently in NGN. Admin-created promo codes apply to one course and may discount 50% or 100%; codes remain reusable until deactivated.
- Administrators can create video-only courses from lesson titles and YouTube, Vimeo, or direct MP4/WebM/Ogg links, alongside document-generated courses.
- Existing capabilities include course creation from documents, lecture and quiz editing, content regeneration, course sharing, learner progress, notes, an assistant, assessments, and instructor analytics.
- Enforce course entitlements on the page, content APIs, assessments, media, and study assistant.
- The product is positioned as an LMS for web design, web development, and computer-science courses rather than a single institution- or course-specific workspace.
- The current seeded homepage content and any institution-specific course data may still contain FUTO cybersecurity references; verify before changing factual course content.
- Courses are built with AI-backed workflows; generated material and quiz availability depend on course processing status.

## Evidence on Hand

- Existing implementation: `app/`, `components/`, and `lib/`.
- Product and operational documentation: `README.md`.
- No customer testimonials, external endorsements, or verified outcome statistics were established; do not invent them.

## Product Principles

- Make instructor and learner workflows clear without conflating their permissions.
- Help learners resume study and understand their progress.
- Keep generated learning content reviewable and editable by instructors.
- Present course materials and assessments as the focus of the learning experience.
- Preserve clear, trustworthy access and sharing expectations.
