import assert from "node:assert/strict";
import test from "node:test";
import {
  beijingDateTimeToMilliseconds,
  decorateTicket,
} from "../scripts/ticket-queue.mjs";

test("converts the submitted Beijing appointment exactly once", () => {
  assert.equal(
    beijingDateTimeToMilliseconds("2026-08-04T13:30"),
    Date.UTC(2026, 7, 4, 5, 30, 0, 0),
  );
});

test("builds a guarded CRM preview with the confirmed owner and option codes", () => {
  const ticket = decorateTicket({
    id: "a7a12ff1-40bb-4d57-9c26-ce80f75b4e3b",
    status: "awaiting_confirmation",
    payload: {
      employeeName: "Test User",
      email: "test@example.com",
      country: "Ghana",
      address: "Test Hospital, Accra",
      customer: "Test Hospital",
      productName: "MAGICL 6000i",
      modelOrItem: "MAGICL 6000i",
      issueTitle: "Test issue",
      issueDescription: "A controlled UAT record.",
      requestedSupportAt: "2026-08-04T13:30",
      complaintCase: "2",
      onlineServiceType: "1",
      productCategoryCrmCode: 2,
      internalRegion: "1",
      faultLevel: "Level 2",
      severity: "Moderate",
      attachmentNames: [],
    },
  });

  assert.deepEqual(ticket.validation_errors, []);
  assert.equal(ticket.crm_preview.busiTypeId, "3632592021996271");
  assert.deepEqual(ticket.crm_preview.owner, {
    id: "3519520896402061",
    name: "徐阳",
  });
  assert.equal(ticket.crm_preview.fields.CPFL__c, 2);
  assert.equal(ticket.crm_preview.fields.customItem100__c, 2);
  assert.equal(ticket.crm_preview.lookups_required.CPMCWM__c, "MAGICL 6000i");
});

test("flags incomplete queue rows instead of inventing CRM values", () => {
  const ticket = decorateTicket({ id: "broken", payload: {} });
  assert.ok(ticket.validation_errors.length >= 8);
  assert.equal(ticket.crm_preview.fields.CPFL__c, null);
  assert.equal(ticket.crm_preview.fields.appointmentStartTime, null);
});
