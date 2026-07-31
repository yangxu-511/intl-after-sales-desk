import assert from "node:assert/strict";
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

test("renders the international after-sales ticket system", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>International Service Desk<\/title>/i);
  assert.match(html, /New after-sales ticket/);
  assert.match(html, /English ticket template/);
  assert.match(html, /Issue \/ service category guide/);
  assert.match(html, /Level 1/);
  assert.match(html, /Severe/);
  assert.match(html, /Customer issue description/);
  assert.match(html, /Ticket records/);
  assert.match(html, /No SalesEasy CRM write-back/);
  assert.doesNotMatch(html, /Market region/);
  assert.doesNotMatch(html, /Select the internal region/);
  assert.doesNotMatch(html, /codex-preview/);
  assert.doesNotMatch(html, /react-loading-skeleton/);
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
