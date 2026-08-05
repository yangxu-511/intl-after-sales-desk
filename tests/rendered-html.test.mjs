import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  formatExportTimestamp,
  severityForFaultLevel,
} from "../app/ticket-utils.ts";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("renders the secure access gate before the ticket system", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>International Service Desk<\/title>/i);
  assert.match(html, /Secure access/);
  assert.match(html, /Checking your sign-in status/);
  assert.doesNotMatch(html, /New after-sales ticket/);
  assert.doesNotMatch(html, /Ticket records/);
  assert.doesNotMatch(html, /No SalesEasy CRM write-back/);
  assert.doesNotMatch(html, /Market region/);
  assert.doesNotMatch(html, /Select the internal region/);
  assert.doesNotMatch(html, /codex-preview/);
  assert.doesNotMatch(html, /react-loading-skeleton/);
});

test("keeps the authenticated ticket form and adds the CRM queue fields", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /New after-sales ticket/);
  assert.match(source, /English ticket template/);
  assert.match(source, /Customer issue description/);
  assert.match(source, /Ticket records/);
  assert.match(source, /31 Jul 2026, 14:30/);
  assert.doesNotMatch(source, /Market region/);
  assert.match(source, /Internal service region/);
  assert.match(source, /Online service type/);
  assert.match(source, /Complaint case\?/);
  assert.match(source, /Service address/);
  assert.match(source, /Requested support time \(Beijing time\)/);
  assert.doesNotMatch(source, /Priority/);
  assert.doesNotMatch(source, /Issue \/ service category guide/);
  assert.match(source, /datetime-local/);
  assert.match(source, /ticket_submissions/);
  assert.match(source, /target_crm_owner: "徐阳"/);

  const requiredFields = source.match(
    /const requiredFields: Array<keyof TicketForm> = \[([\s\S]*?)\];/,
  );
  assert.ok(requiredFields);
  assert.doesNotMatch(requiredFields[1], /"employeeId"/);
  assert.match(requiredFields[1], /"address"/);
  assert.match(requiredFields[1], /"onlineServiceType"/);
  assert.match(requiredFields[1], /"complaintCase"/);
  assert.match(requiredFields[1], /"requestedSupportAt"/);
  assert.match(
    source,
    /restoredDraft\.employeeName = reporterDefaults\.employeeName/,
  );
  assert.match(source, /restoredDraft\.email = reporterDefaults\.email/);
  assert.doesNotMatch(requiredFields[1], /"currentResult"/);
  assert.doesNotMatch(source, /Actions & result/);
  assert.doesNotMatch(source, /Troubleshooting \/ actions taken/);
  assert.doesNotMatch(source, /Current result/);
  assert.doesNotMatch(source, /Validation \/ follow-up notes/);
  assert.doesNotMatch(source, /Result and follow-up/);
  assert.match(source, /number="05"\s+title="Evidence"/);
});

test("keeps the approved email access list", async () => {
  const source = await readFile(new URL("../app/auth-gate.tsx", import.meta.url), "utf8");
  assert.match(source, /grel_xu@outlook\.com/);
  assert.match(source, /elephantsimon@163\.com/);
  assert.match(source, /839079040@qq\.com/);
  assert.match(source, /xu\.yang2@getein\.cn/);
  assert.match(source, /m\.rabia@getein\.com\.cn/);
  assert.match(source, /signInWithPassword/);
  assert.match(source, /must_change_password/);
  assert.match(source, /Create a new password/);
  assert.doesNotMatch(source, /signInWithOtp/);
  assert.doesNotMatch(source, /Send sign-in link/);
});

test("adds a server-protected read-only administrator ticket overview", async () => {
  const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const dashboardSource = await readFile(new URL("../app/admin-dashboard.tsx", import.meta.url), "utf8");
  const migrationSource = await readFile(
    new URL("../supabase/migrations/202608050001_add_admin_ticket_dashboard.sql", import.meta.url),
    "utf8",
  );

  assert.match(pageSource, /<AdminDashboard userEmail=\{user\.email\} \/>/);
  assert.match(dashboardSource, /ADMIN_EMAIL = "xu\.yang2@getein\.cn"/);
  assert.match(dashboardSource, /Registered ticket overview/);
  assert.match(dashboardSource, /submitter_name/);
  assert.match(dashboardSource, /submitter_email/);
  assert.match(dashboardSource, /Service address \/ 服务地址/);
  assert.match(dashboardSource, /Attachments \/ 附件名称/);
  assert.match(dashboardSource, /Issue content \/ 工单内容/);
  assert.match(dashboardSource, /get_ticket_submission_admin_summary/);
  assert.match(dashboardSource, /get_ticket_submission_admin_rows/);

  assert.match(migrationSource, /security definer/);
  assert.match(migrationSource, /auth\.jwt\(\) ->> 'email'/);
  assert.match(migrationSource, /<> 'xu\.yang2@getein\.cn'/);
  assert.match(migrationSource, /raise exception 'administrator access required'/);
  assert.match(migrationSource, /revoke all on function public\.get_ticket_submission_admin_rows\(integer, integer\) from public/);
  assert.match(migrationSource, /grant execute on function public\.get_ticket_submission_admin_rows\(integer, integer\) to authenticated/);
  assert.match(migrationSource, /limit least\(greatest\(coalesce\(p_limit, 100\), 1\), 100\)/);
});

test("uses consistent fault levels and date-time export names", () => {
  assert.equal(severityForFaultLevel("Level 1"), "Severe");
  assert.equal(severityForFaultLevel("Level 2"), "Moderate");
  assert.equal(severityForFaultLevel("Level 3"), "Minor");
  assert.equal(
    formatExportTimestamp(new Date(2026, 6, 31, 20, 11, 33)),
    "2026-07-31_20-11-33",
  );
});
