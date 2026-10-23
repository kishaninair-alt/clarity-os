# Submission alert

`functions/submission-alert` emails Kishan through Resend whenever a row is inserted into
`public.submissions` (project `clarity-os`, ref `owjhkmkflqgoqdpiohxr`).

Status (2026-10-23): function deployed from the dashboard with "Verify JWT" off, and the
Database Webhook `submission_alert` (public.submissions, Insert, POST to
`https://owjhkmkflqgoqdpiohxr.supabase.co/functions/v1/submission-alert`) is created.

The only missing piece is the Resend key. Dashboard, Edge Functions, Secrets, add
`RESEND_API_KEY`. Optional: `ALERT_FROM_EMAIL` on a domain verified in Resend (without it the
sender is `onboarding@resend.dev`, which only delivers to the Resend account owner's own
address) and `ALERT_TO_EMAIL` (defaults to kishaninair@gmail.com).

The function trusts nothing in the webhook payload except the row id: it reads the row back with
the built in service credentials and only alerts for a real row created in the last 15 minutes.
No shared webhook secret is needed.

To redeploy after editing `index.ts`, paste it into Dashboard, Edge Functions, submission-alert,
Code, or use `npx supabase functions deploy submission-alert --project-ref owjhkmkflqgoqdpiohxr --no-verify-jwt`.

The email deliberately leaves out the free text note (the privacy policy says so). Read notes in
the table editor.
