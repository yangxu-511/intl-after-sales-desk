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

test("keeps the authenticated ticket form and removes market region", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /New after-sales ticket/);
  assert.match(source, /English ticket template/);
  assert.match(source, /Issue \/ service category guide/);
  assert.match(source, /Customer issue description/);
  assert.match(source, /Ticket records/);
  assert.doesNotMatch(source, /Market region/);
  assert.doesNotMatch(source, /Select the internal region/);
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
