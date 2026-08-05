import { pathToFileURL } from "node:url";

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? "https://mesbcospesuhuojhftxs.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TABLE_URL = `${SUPABASE_URL}/rest/v1/ticket_submissions`;
const CRM_BUSINESS_TYPE_ID = "3632592021996271";
const CRM_BUSINESS_TYPE_API_KEY = "businessType12__c";
const CRM_OWNER_ID = "3519520896402061";
const CRM_OWNER_NAME = "徐阳";

const transitions = {
  "mark-processing": {
    from: "awaiting_confirmation",
    to: "processing",
    fields: () => ({
      processing_started_at: new Date().toISOString(),
      attempt_count_increment: true,
      last_error: null,
    }),
  },
  "mark-needs-review": {
    from: "awaiting_confirmation",
    to: "needs_review",
    fields: ([message]) => ({ last_error: required(message, "review reason") }),
  },
  "mark-failed": {
    from: "processing",
    to: "failed",
    fields: ([message]) => ({ last_error: required(message, "failure reason") }),
  },
  "mark-uncertain": {
    from: "processing",
    to: "uncertain",
    fields: ([message]) => ({ last_error: required(message, "uncertainty reason") }),
  },
};

function required(value, label) {
  if (!value) throw new Error(`Missing ${label}.`);
  return value;
}

function headers(prefer) {
  if (!SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is missing. Configure config/ticket-queue.env on this Mac.",
    );
  }
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    ...(prefer ? { Prefer: prefer } : {}),
  };
}

async function request(path, options = {}) {
  const response = await fetch(`${TABLE_URL}${path}`, {
    ...options,
    headers: { ...headers(options.prefer), ...options.headers },
  });
  const body = await response.text();
  let parsed = null;
  try {
    parsed = body ? JSON.parse(body) : null;
  } catch {
    parsed = body;
  }
  if (!response.ok) {
    throw new Error(parsed?.message ?? `Supabase request failed (${response.status}).`);
  }
  return parsed;
}

export function beijingDateTimeToMilliseconds(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value ?? "")) {
    throw new Error("Requested support time is missing or invalid.");
  }
  const timestamp = Date.parse(`${value.length === 16 ? `${value}:00` : value}+08:00`);
  if (!Number.isFinite(timestamp)) throw new Error("Requested support time is invalid.");
  return timestamp;
}

export function buildDescription(payload) {
  const lines = [
    payload.issueTitle ?? "",
    payload.issueDescription ?? "",
    "",
    `Reporter: ${payload.employeeName ?? "Not recorded"} <${payload.email ?? "Not recorded"}>`,
    payload.employeeId ? `Employee ID: ${payload.employeeId}` : null,
    `Customer: ${payload.customer ?? "Not recorded"}`,
    `Country / region: ${payload.country ?? "Not recorded"}`,
    payload.distributor ? `Distributor: ${payload.distributor}` : null,
    payload.serialNumber ? `Serial number: ${payload.serialNumber}` : null,
    payload.reagentLot ? `Reagent lot: ${payload.reagentLot}` : null,
    payload.occurredAt ? `Occurred at: ${payload.occurredAt}` : null,
    payload.downtimeStatus ? `Downtime: ${payload.downtimeStatus}` : null,
    payload.downtimeHours ? `Downtime hours: ${payload.downtimeHours}` : null,
    payload.attachmentNames?.length
      ? `Attachment filenames only: ${payload.attachmentNames.join(", ")}`
      : null,
  ];
  return lines.filter((line) => line !== null).join("\n");
}

function optionCode(value, allowed, label, errors) {
  const code = Number(value);
  if (!Number.isInteger(code) || !allowed.includes(code)) {
    errors.push(`${label} is missing or invalid.`);
    return null;
  }
  return code;
}

export function decorateTicket(ticket) {
  const payload = ticket.payload;
  const validationErrors = [];
  const faultCode = optionCode(
    payload.faultLevel?.match(/\d+/)?.[0],
    [1, 2, 3],
    "Fault level",
    validationErrors,
  );
  const severityCode = optionCode(
    { Severe: 1, Moderate: 2, Minor: 3 }[payload.severity],
    [1, 2, 3],
    "Severity",
    validationErrors,
  );
  let appointmentStartTime = null;
  try {
    appointmentStartTime = beijingDateTimeToMilliseconds(
      payload.requestedSupportAt,
    );
  } catch (error) {
    validationErrors.push(error.message);
  }
  const complaintCode = optionCode(
    payload.complaintCase,
    [1, 2],
    "Complaint case",
    validationErrors,
  );
  const serviceTypeCode = optionCode(
    payload.onlineServiceType,
    [1, 2, 3, 4, 5],
    "Online service type",
    validationErrors,
  );
  const productCategoryCode = optionCode(
    payload.productCategoryCrmCode,
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    "Product category",
    validationErrors,
  );
  const regionCode = optionCode(
    payload.internalRegion,
    [1, 2, 3, 4, 5, 6, 7],
    "Internal region",
    validationErrors,
  );
  for (const [label, value] of [
    ["Service address", payload.address],
    ["Issue description", payload.issueDescription],
    ["Model / reagent item", payload.modelOrItem],
    ["Product name", payload.productName],
  ]) {
    if (!String(value ?? "").trim()) validationErrors.push(`${label} is missing.`);
  }
  return {
    ...ticket,
    validation_errors: validationErrors,
    crm_preview: {
      entity: "fieldJob",
      busiTypeId: CRM_BUSINESS_TYPE_ID,
      busiTypeApiKey: CRM_BUSINESS_TYPE_API_KEY,
      owner: { id: CRM_OWNER_ID, name: CRM_OWNER_NAME },
      fields: {
        ownerId: CRM_OWNER_ID,
        address: payload.address,
        appointmentStartTime,
        description: buildDescription(payload),
        SFWTSL__c: complaintCode,
        XSFWLX__c: serviceTypeCode,
        CPFL__c: productCategoryCode,
        XHSJXM__c: payload.modelOrItem,
        wmqy__c: regionCode,
        customItem100__c: faultCode,
        KHWTMS__c: payload.issueDescription,
        YZCD__c: severityCode,
        serialNumber: payload.serialNumber || undefined,
        SJPH__c: payload.reagentLot || undefined,
      },
      lookups_required: {
        CPMCWM__c: payload.productName,
        fCountry: payload.country,
      },
    },
  };
}

async function getTicket(id) {
  const records = await request(
    `?id=eq.${encodeURIComponent(id)}&select=*&limit=1`,
  );
  if (!records[0]) throw new Error(`Ticket ${id} was not found.`);
  return records[0];
}

async function patchTicket(id, expectedStatus, fields) {
  const attemptIncrement = fields.attempt_count_increment;
  delete fields.attempt_count_increment;
  if (attemptIncrement) {
    const current = await getTicket(id);
    fields.attempt_count = current.attempt_count + 1;
  }

  const records = await request(
    `?id=eq.${encodeURIComponent(id)}&status=eq.${expectedStatus}&select=*`,
    {
      method: "PATCH",
      prefer: "return=representation",
      body: JSON.stringify(fields),
    },
  );
  if (!records[0]) {
    const current = await getTicket(id);
    throw new Error(
      `Ticket ${id} is ${current.status}; expected ${expectedStatus}. No change was made.`,
    );
  }
  return records[0];
}

async function collect() {
  const pending = await request(
    "?status=eq.pending&select=*&order=created_at.asc&limit=50",
  );
  const collected = [];
  for (const ticket of pending) {
    const records = await request(
      `?id=eq.${ticket.id}&status=eq.pending&select=*`,
      {
        method: "PATCH",
        prefer: "return=representation",
        body: JSON.stringify({
          status: "awaiting_confirmation",
          collected_at: new Date().toISOString(),
        }),
      },
    );
    if (records[0]) collected.push(records[0]);
  }
  return collected.map(decorateTicket);
}

async function list(status = "awaiting_confirmation") {
  const records = await request(
    `?status=eq.${encodeURIComponent(status)}&select=*&order=created_at.asc&limit=100`,
  );
  return records.map(decorateTicket);
}

async function markUploaded(id, [crmRecordId, crmNumber, crmOwner], from = "processing") {
  return patchTicket(id, from, {
    status: "uploaded",
    crm_record_id: required(crmRecordId, "CRM record ID"),
    crm_work_order_number: required(crmNumber, "CRM work-order number"),
    crm_owner: required(crmOwner, "CRM owner"),
    uploaded_at: new Date().toISOString(),
    last_error: null,
  });
}

async function main() {
  const [command = "help", id, ...args] = process.argv.slice(2);
  let result;

  if (command === "collect") result = await collect();
  else if (command === "list") result = await list(id);
  else if (command === "get") {
    result = decorateTicket(await getTicket(required(id, "ticket ID")));
  } else if (command === "mark-uploaded") {
    result = await markUploaded(required(id, "ticket ID"), args);
  } else if (command === "resolve-uploaded") {
    result = await markUploaded(required(id, "ticket ID"), args, "uncertain");
  } else if (transitions[command]) {
    const transition = transitions[command];
    result = await patchTicket(required(id, "ticket ID"), transition.from, {
      status: transition.to,
      ...transition.fields(args),
    });
  } else {
    throw new Error(
      "Usage: collect | list [status] | get <id> | mark-processing <id> | mark-needs-review <id> <reason> | mark-failed <id> <reason> | mark-uncertain <id> <reason> | mark-uploaded <id> <crmId> <number> <owner> | resolve-uploaded <id> <crmId> <number> <owner>",
    );
  }

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
