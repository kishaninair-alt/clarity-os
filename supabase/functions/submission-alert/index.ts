// Emails Kishan whenever a row is inserted into public.submissions.
//
// Called by a Supabase Database Webhook (Database > Webhooks) on INSERT.
// The webhook payload is never trusted: the function looks the row up by id
// with the project's built in service credentials and only alerts for a row
// that really exists and was created in the last 15 minutes. So a forged or
// replayed call can't send fake or repeated emails, and no shared webhook
// secret is needed.
//
// Secrets (set in Dashboard > Edge Functions > Secrets, never in this file):
//   RESEND_API_KEY   Resend API key (required)
//   ALERT_TO_EMAIL   optional, defaults to Kishan's address below
//   ALERT_FROM_EMAIL optional, a sender on a domain verified in Resend;
//                    the default onboarding@resend.dev only delivers to the
//                    Resend account owner's own address
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by Supabase.
//
// Privacy: the email carries only score, band, domain, gut check, the three
// feedback chips and whether a note exists. The note text itself stays in the
// database (datenschutz.html promises this; keep the two in sync).

type Submission = {
  id: string;
  ts: string;
  total: number;
  band: string;
  gc: number | null;
  domain_key: string | null;
  approach_style: string | null;
  dq: { straightLine?: boolean; medianMsPerQ?: number | null } | null;
  feedback: { ease?: string | null; accurate?: string | null; wouldReturn?: string | null; note?: string } | null;
};

const DEFAULT_TO = "kishaninair@gmail.com";
const DEFAULT_FROM = "Clarity OS <onboarding@resend.dev>";
const MAX_AGE_MS = 15 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function loadRow(id: string): Promise<Submission | null> {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("missing_supabase_env");
  const res = await fetch(
    `${url}/rest/v1/submissions?id=eq.${id}&select=id,ts,total,band,gc,domain_key,approach_style,dq,feedback`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  if (!res.ok) throw new Error(`lookup_failed_${res.status}`);
  const rows = await res.json();
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return json(500, { error: "missing_resend_key" });

  let payload: { type?: string; table?: string; record?: { id?: string } };
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: "bad_json" });
  }
  const id = payload.record?.id;
  if (payload.type !== "INSERT" || payload.table !== "submissions" || !id || !UUID.test(id)) {
    return json(200, { skipped: true });
  }

  let r: Submission | null;
  try {
    r = await loadRow(id);
  } catch (e) {
    console.error(String(e));
    return json(502, { error: "lookup_failed" });
  }
  if (!r) return json(404, { error: "no_such_row" });
  if (Date.now() - new Date(r.ts).getTime() > MAX_AGE_MS) return json(200, { skipped: "too_old" });

  const fb = r.feedback ?? {};
  const hasNote = typeof fb.note === "string" && fb.note.trim().length > 0;
  const flags: string[] = [];
  if (r.dq?.straightLine) flags.push("same answer on every question");
  if (r.dq?.medianMsPerQ != null && r.dq.medianMsPerQ < 900) flags.push("answered very fast");

  const lines = [
    `New Clarity OS submission`,
    ``,
    `Score: ${r.total} (${r.band})`,
    `Area: ${r.domain_key ?? "?"}`,
    `Gut check: ${r.gc ?? "?"}`,
    `Approach style: ${r.approach_style ?? "?"}`,
    `Easy to understand: ${fb.ease ?? "no answer"}`,
    `Felt accurate: ${fb.accurate ?? "no answer"}`,
    `Would use again: ${fb.wouldReturn ?? "no answer"}`,
    `Note written: ${hasNote ? "yes, read it in Supabase" : "no"}`,
    flags.length ? `Data quality: ${flags.join(", ")}` : `Data quality: ok`,
    ``,
    `Submitted: ${r.ts}`,
    `Row id: ${r.id}`,
    `Table: https://supabase.com/dashboard/project/owjhkmkflqgoqdpiohxr/editor`,
  ];

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: Deno.env.get("ALERT_FROM_EMAIL") || DEFAULT_FROM,
      to: [Deno.env.get("ALERT_TO_EMAIL") || DEFAULT_TO],
      subject: `Clarity OS: new submission, ${r.total} ${r.band}`,
      text: lines.join("\n"),
    }),
  });

  if (!res.ok) {
    console.error("resend_failed", res.status, await res.text());
    return json(502, { error: "resend_failed", status: res.status });
  }
  return json(200, { sent: true });
});
