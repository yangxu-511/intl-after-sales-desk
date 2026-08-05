"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import {
  faultLevelDefinitions,
  formatExportTimestamp,
  normalizeFaultSeverity,
  severityForFaultLevel,
} from "./ticket-utils";
import AuthGate, { AccessUser } from "./auth-gate";
import AdminDashboard from "./admin-dashboard";
import { supabase } from "./supabase";

type TicketForm = {
  employeeName: string;
  employeeId: string;
  email: string;
  country: string;
  address: string;
  internalRegion: string;
  distributor: string;
  customer: string;
  productCategory: string;
  productName: string;
  modelOrItem: string;
  serialNumber: string;
  reagentLot: string;
  issueTitle: string;
  issueDescription: string;
  onlineServiceType: string;
  complaintCase: string;
  faultLevel: string;
  severity: string;
  downtimeStatus: string;
  downtimeHours: string;
  occurredAt: string;
  requestedSupportAt: string;
  attachmentNames: string[];
};

type Submission = TicketForm & {
  ticketId: string;
  submittedAt: string;
  queueStatus?: "pending";
};

type PendingSubmissionRequest = {
  id: string;
  ticketId: string;
};

const DRAFT_KEY = "gbase-after-sales-ticket-draft-v1";
const SUBMISSIONS_KEY = "gbase-after-sales-ticket-submissions-v1";
const PENDING_REQUEST_KEY = "gbase-after-sales-ticket-pending-request-v1";

const initialForm: TicketForm = {
  employeeName: "",
  employeeId: "",
  email: "",
  country: "",
  address: "",
  internalRegion: "",
  distributor: "",
  customer: "",
  productCategory: "",
  productName: "",
  modelOrItem: "",
  serialNumber: "",
  reagentLot: "",
  issueTitle: "",
  issueDescription: "",
  onlineServiceType: "",
  complaintCase: "",
  faultLevel: "",
  severity: "",
  downtimeStatus: "",
  downtimeHours: "",
  occurredAt: "",
  requestedSupportAt: "",
  attachmentNames: [],
};

const requiredFields: Array<keyof TicketForm> = [
  "employeeName",
  "country",
  "address",
  "internalRegion",
  "customer",
  "productCategory",
  "productName",
  "modelOrItem",
  "issueTitle",
  "issueDescription",
  "onlineServiceType",
  "complaintCase",
  "faultLevel",
  "severity",
  "requestedSupportAt",
];

const productCategories = [
  { value: "Hematology instrument", label: "Hematology instrument", crmCode: 1, crmLabel: "血球产品" },
  { value: "Hematology reagent", label: "Hematology reagent", crmCode: 1, crmLabel: "血球产品" },
  { value: "Chemiluminescence instrument", label: "Chemiluminescence instrument", crmCode: 2, crmLabel: "发光仪器" },
  { value: "Coagulation reagent", label: "Coagulation reagent", crmCode: 3, crmLabel: "血凝试剂" },
  { value: "Coagulation instrument", label: "Coagulation instrument", crmCode: 4, crmLabel: "血凝仪器" },
  { value: "Biochemistry & immunoassay automation", label: "Biochemistry & immunoassay automation", crmCode: 5, crmLabel: "生免流水线仪器" },
  { value: "Molecular diagnostics reagent", label: "Molecular diagnostics reagent", crmCode: 6, crmLabel: "分子诊断试剂" },
  { value: "Molecular diagnostics instrument", label: "Molecular diagnostics instrument", crmCode: 7, crmLabel: "分子诊断仪器" },
  { value: "Biochemistry reagent", label: "Biochemistry reagent", crmCode: 8, crmLabel: "生化试剂" },
  { value: "Biochemistry instrument", label: "Biochemistry instrument", crmCode: 9, crmLabel: "生化仪器" },
  { value: "Chemiluminescence reagent", label: "Chemiluminescence reagent", crmCode: 10, crmLabel: "发光试剂" },
  { value: "POCT instrument", label: "POCT instrument", crmCode: 11, crmLabel: "POCT仪器" },
  { value: "POCT reagent", label: "POCT reagent", crmCode: 12, crmLabel: "POCT试剂" },
];

const internalRegions = [
  { value: "1", label: "Region 1 / 一区" },
  { value: "2", label: "Region 2 / 二区" },
  { value: "3", label: "Region 3 / 三区" },
  { value: "4", label: "Region 4 / 四区" },
  { value: "5", label: "Region 5 / 五区" },
  { value: "6", label: "Region 6 / 六区" },
  { value: "7", label: "Special region / 特区" },
];

const onlineServiceTypes = [
  { value: "1", label: "Instrument issue / 仪器问题" },
  { value: "2", label: "Reagent issue / 试剂问题" },
  { value: "3", label: "Online installation / 线上装机" },
  { value: "4", label: "Remote service guidance / 远程服务指导" },
  { value: "5", label: "Market refurbishment repair / 市场翻新维修" },
];

const ticketTemplateItems = [
  {
    title: "Issue title",
    example: "[Product / model] — [symptom or error]",
  },
  {
    title: "Issue description",
    example:
      "On [date/time], [customer/site] reported [symptom]. The issue affects [tests, samples, or workflow]. Error message: [exact text].",
  },
];

const crmFieldMap = [
  ["Product category", "产品分类"],
  ["Model / reagent item", "型号 or 试剂项目"],
  ["Online service type", "线上服务类型"],
  ["Complaint case", "是否为投诉类"],
  ["Fault level", "故障等级"],
];

function FieldLabel({
  htmlFor,
  label,
  cn,
  required = false,
}: {
  htmlFor: string;
  label: string;
  cn: string;
  required?: boolean;
}) {
  return (
    <label htmlFor={htmlFor}>
      <span>
        {label} {required && <b aria-hidden="true">*</b>}
      </span>
      <small>{cn}</small>
    </label>
  );
}

function SectionTitle({
  number,
  title,
  subtitle,
}: {
  number: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="section-title">
      <span className="section-number">{number}</span>
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
    </div>
  );
}

function createTicketId(requestId: string) {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `INT-${date}-${time}-${requestId.slice(0, 4).toUpperCase()}`;
}

function getOrCreatePendingRequest(): PendingSubmissionRequest {
  const saved = window.localStorage.getItem(PENDING_REQUEST_KEY);
  if (saved) {
    try {
      const request = JSON.parse(saved) as PendingSubmissionRequest;
      if (request.id && request.ticketId) return request;
    } catch {
      window.localStorage.removeItem(PENDING_REQUEST_KEY);
    }
  }

  const id = window.crypto.randomUUID();
  const request = { id, ticketId: createTicketId(id) };
  window.localStorage.setItem(PENDING_REQUEST_KEY, JSON.stringify(request));
  return request;
}

function csvEscape(value: string | string[]) {
  const text = Array.isArray(value) ? value.join("; ") : value;
  return `"${String(text ?? "").replaceAll('"', '""')}"`;
}

function TicketDesk({
  user,
  onSignOut,
}: {
  user: AccessUser;
  onSignOut: () => Promise<void>;
}) {
  const reporterDefaults = useMemo(
    () => ({ employeeName: user.displayName, email: user.email }),
    [user.displayName, user.email],
  );
  const [form, setForm] = useState<TicketForm>(() => ({
    ...initialForm,
    ...reporterDefaults,
  }));
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState("Draft not started");
  const [errors, setErrors] = useState<Array<keyof TicketForm>>([]);
  const [successId, setSuccessId] = useState("");
  const [submissionError, setSubmissionError] = useState("");
  const [submittingTicket, setSubmittingTicket] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const savedDraft = window.localStorage.getItem(DRAFT_KEY);
        const savedSubmissions = window.localStorage.getItem(SUBMISSIONS_KEY);
        if (savedDraft) {
          const parsedDraft = JSON.parse(savedDraft) as Partial<TicketForm> & {
            region?: unknown;
            serviceType?: unknown;
            complaint?: unknown;
            priority?: unknown;
            actionsTaken?: unknown;
            currentResult?: unknown;
            validationNotes?: unknown;
          };
          delete parsedDraft.region;
          delete parsedDraft.serviceType;
          delete parsedDraft.complaint;
          delete parsedDraft.priority;
          delete parsedDraft.actionsTaken;
          delete parsedDraft.currentResult;
          delete parsedDraft.validationNotes;
          const restoredDraft = {
            ...initialForm,
            ...parsedDraft,
          } as TicketForm;
          restoredDraft.employeeName = reporterDefaults.employeeName;
          restoredDraft.email = reporterDefaults.email;
          setForm(normalizeFaultSeverity(restoredDraft));
          setSaveState("Draft restored from this device");
        }
        if (savedSubmissions) {
          const restoredSubmissions = JSON.parse(savedSubmissions) as Array<
            Submission & {
              region?: unknown;
              serviceType?: unknown;
              complaint?: unknown;
              priority?: unknown;
              actionsTaken?: unknown;
              currentResult?: unknown;
              validationNotes?: unknown;
            }
          >;
          setSubmissions(
            restoredSubmissions.map((ticket) => {
              delete ticket.region;
              delete ticket.serviceType;
              delete ticket.complaint;
              delete ticket.priority;
              delete ticket.actionsTaken;
              delete ticket.currentResult;
              delete ticket.validationNotes;
              return normalizeFaultSeverity(ticket);
            }),
          );
        }
      } catch {
        setSaveState("Local save is unavailable");
      } finally {
        setLoaded(true);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [reporterDefaults]);

  useEffect(() => {
    if (!loaded) return;
    const hasContent = Object.entries(form).some(([key, value]) => {
      if (key === "attachmentNames") return (value as string[]).length > 0;
      return Boolean(value);
    });
    if (!hasContent) return;

    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
        setSaveState(
          `Saved on this device · ${new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}`,
        );
      } catch {
        setSaveState("Could not save this draft");
      }
    }, 500);

    return () => window.clearTimeout(timer);
  }, [form, loaded]);

  const completedRequired = useMemo(
    () =>
      requiredFields.filter((field) => {
        const value = form[field];
        return Array.isArray(value) ? value.length > 0 : Boolean(value);
      }).length,
    [form],
  );

  const progress = Math.round(
    (completedRequired / requiredFields.length) * 100,
  );

  function updateField(
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) {
    const field = event.target.name as keyof TicketForm;
    const value = event.target.value;
    if (field === "faultLevel") {
      setForm((current) => ({
        ...current,
        faultLevel: value,
        severity: severityForFaultLevel(value),
      }));
      setErrors((current) =>
        current.filter((item) => item !== "faultLevel" && item !== "severity"),
      );
      setSuccessId("");
      setSubmissionError("");
      return;
    }
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => current.filter((item) => item !== field));
    setSuccessId("");
    setSubmissionError("");
  }

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const names = Array.from(event.target.files ?? [])
      .slice(0, 5)
      .map((file) => file.name);
    setForm((current) => ({ ...current, attachmentNames: names }));
  }

  function saveDraft() {
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
      setSaveState("Draft saved on this device");
    } catch {
      setSaveState("Could not save this draft");
    }
  }

  function clearForm() {
    const shouldClear = window.confirm(
      "Clear the current form? This will remove the draft saved on this device.",
    );
    if (!shouldClear) return;
    setForm({ ...initialForm, ...reporterDefaults });
    setErrors([]);
    setSuccessId("");
    setSubmissionError("");
    window.localStorage.removeItem(DRAFT_KEY);
    window.localStorage.removeItem(PENDING_REQUEST_KEY);
    setSaveState("Draft cleared");
  }

  async function submitTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const missing = requiredFields.filter((field) => {
      const value = form[field];
      return Array.isArray(value) ? value.length === 0 : !String(value).trim();
    });

    if (missing.length > 0) {
      setErrors(missing);
      const firstMissing = document.getElementById(String(missing[0]));
      firstMissing?.focus();
      firstMissing?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setSubmittingTicket(true);
    setSubmissionError("");
    let request: PendingSubmissionRequest;
    try {
      request = getOrCreatePendingRequest();
    } catch {
      setSubmittingTicket(false);
      setSubmissionError(
        "This browser cannot create a safe submission reference. Please keep the draft and try again.",
      );
      return;
    }
    const submission: Submission = {
      ...form,
      ticketId: request.ticketId,
      submittedAt: new Date().toISOString(),
      queueStatus: "pending",
    };
    const next = [submission, ...submissions].slice(0, 20);

    const productCategory = productCategories.find(
      (item) => item.value === form.productCategory,
    );
    const payload = {
      ...form,
      productCategoryCrmCode: productCategory?.crmCode ?? null,
      productCategoryCrmLabel: productCategory?.crmLabel ?? form.productCategory,
      reporterUserId: user.id,
    };

    const { error } = await supabase.from("ticket_submissions").upsert(
      {
        id: request.id,
        client_ticket_id: request.ticketId,
        submitter_user_id: user.id,
        submitter_name: form.employeeName,
        submitter_email: user.email,
        payload,
        status: "pending",
        target_crm_owner: "徐阳",
      },
      { onConflict: "id", ignoreDuplicates: true },
    );

    if (error) {
      setSubmittingTicket(false);
      setSubmissionError(
        error.code === "PGRST205"
          ? "The secure ticket queue is not ready yet. Please keep this draft and contact support."
          : "The ticket could not reach the secure queue. Your draft is still saved; please try again.",
      );
      setSaveState("Cloud submission failed · draft preserved");
      return;
    }

    try {
      window.localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(next));
      window.localStorage.removeItem(DRAFT_KEY);
      window.localStorage.removeItem(PENDING_REQUEST_KEY);
      setSubmissions(next);
      setSuccessId(submission.ticketId);
      setForm({ ...initialForm, ...reporterDefaults });
      setErrors([]);
      setSaveState("Ready for a new ticket");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setSuccessId(submission.ticketId);
      setSaveState("Queued securely · local history could not be updated");
    } finally {
      setSubmittingTicket(false);
    }
  }

  function exportCsv() {
    if (submissions.length === 0) return;
    const fields: Array<keyof Submission> = [
      "ticketId",
      "submittedAt",
      "employeeName",
      "employeeId",
      "email",
      "country",
      "address",
      "internalRegion",
      "distributor",
      "customer",
      "productCategory",
      "productName",
      "modelOrItem",
      "serialNumber",
      "reagentLot",
      "issueTitle",
      "issueDescription",
      "onlineServiceType",
      "complaintCase",
      "faultLevel",
      "severity",
      "downtimeStatus",
      "downtimeHours",
      "occurredAt",
      "requestedSupportAt",
      "attachmentNames",
    ];
    const rows = [
      fields.join(","),
      ...submissions.map((ticket) =>
        fields.map((field) => csvEscape(ticket[field] as string | string[])).join(","),
      ),
    ];
    const blob = new Blob([`\uFEFF${rows.join("\n")}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `international-after-sales-tickets-${formatExportTimestamp()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const errorClass = (field: keyof TicketForm) =>
    errors.includes(field) ? "field-error" : "";

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="International Service Desk home">
          <span className="brand-mark">G</span>
          <span>
            <strong>International Service Desk</strong>
            <small>国际售后服务台</small>
          </span>
        </a>
        <div className="topbar-actions">
          <div className="privacy-pill">
            <span aria-hidden="true">●</span>
            Secure cloud queue
          </div>
          <div className="session-pill">
            <span>{user.email}</span>
            <button type="button" onClick={() => void onSignOut()}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="page-shell" id="top">
        <aside className="intro-panel">
          <div className="eyebrow">FIELD SUPPORT INTAKE · V1</div>
          <h1>Report the issue.<br />Keep support moving.</h1>
          <p className="intro-copy">
            A focused form for international service teams. Drafts stay on this
            device; submitted tickets enter a secure review queue before CRM upload.
          </p>

          <div className="progress-card" aria-label={`${progress}% complete`}>
            <div className="progress-topline">
              <span>Required fields</span>
              <strong>{progress}%</strong>
            </div>
            <div className="progress-track">
              <span style={{ width: `${progress}%` }} />
            </div>
            <small>
              {completedRequired} of {requiredFields.length} complete
            </small>
          </div>

          <div className="sidebar-note">
            <span className="note-icon" aria-hidden="true">i</span>
            <div>
              <strong>Before you start</strong>
              <p>
                Use clear English. Include the instrument serial number, error
                message, and what you have already tried whenever available.
              </p>
            </div>
          </div>

          <div className="crm-reference">
            <p>Aligned with SalesEasy CRM</p>
            <ul>
              {crmFieldMap.slice(0, 5).map(([en, cn]) => (
                <li key={en}>
                  <span>{en}</span>
                  <small>{cn}</small>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <section className="form-column">
          <AdminDashboard userEmail={user.email} />

          {successId && (
            <div className="success-banner" role="status">
              <span className="success-check" aria-hidden="true">✓</span>
              <div>
                <strong>Ticket submitted securely</strong>
                <p>
                  Reference <b>{successId}</b> is in the secure queue and awaits
                  review before SalesEasy CRM upload.
                </p>
              </div>
            </div>
          )}

          <div className="form-heading">
            <div>
              <span className="mobile-eyebrow">NEW TICKET</span>
              <h2>New after-sales ticket</h2>
              <p>新建售后工单 · Fields marked * are required</p>
            </div>
            <span className="save-status">{saveState}</span>
          </div>

          <section className="ticket-template" aria-labelledby="template-title">
            <div className="ticket-template-heading">
              <span className="section-kicker">WRITING GUIDE</span>
              <h2 id="template-title">English ticket template</h2>
              <p>
                Use this structure to make the issue clear and easy to hand over.
              </p>
            </div>
            <div className="ticket-template-grid">
              {ticketTemplateItems.map((item) => (
                <article key={item.title}>
                  <strong>{item.title}</strong>
                  <code>{item.example}</code>
                </article>
              ))}
            </div>
          </section>

          {errors.length > 0 && (
            <div className="error-summary" role="alert">
              Please complete the {errors.length} highlighted required
              {errors.length === 1 ? " field" : " fields"}.
            </div>
          )}

          {submissionError && (
            <div className="error-summary" role="alert">
              {submissionError}
            </div>
          )}

          <form onSubmit={submitTicket} noValidate>
            <section className="form-section">
              <SectionTitle
                number="01"
                title="Reporter"
                subtitle="Who is submitting this ticket?"
              />
              <div className="field-grid">
                <div className={`field ${errorClass("employeeName")}`}>
                  <FieldLabel
                    htmlFor="employeeName"
                    label="Full name"
                    cn="员工姓名"
                    required
                  />
                  <input
                    id="employeeName"
                    name="employeeName"
                    value={form.employeeName}
                    onChange={updateField}
                    placeholder="e.g. Daniel Mensah"
                    autoComplete="name"
                  />
                </div>
                <div className="field">
                  <FieldLabel
                    htmlFor="employeeId"
                    label="Employee ID"
                    cn="员工编号"
                  />
                  <input
                    id="employeeId"
                    name="employeeId"
                    value={form.employeeId}
                    onChange={updateField}
                    placeholder="e.g. INT-0248"
                  />
                </div>
                <div className="field field-wide">
                  <FieldLabel htmlFor="email" label="Work email" cn="工作邮箱" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={updateField}
                    placeholder="name@company.com"
                    autoComplete="email"
                  />
                </div>
              </div>
            </section>

            <section className="form-section">
              <SectionTitle
                number="02"
                title="Location & customer"
                subtitle="Where is support needed?"
              />
              <div className="field-grid">
                <div className={`field ${errorClass("country")}`}>
                  <FieldLabel
                    htmlFor="country"
                    label="Country / region"
                    cn="国家 / 地区"
                    required
                  />
                  <input
                    id="country"
                    name="country"
                    value={form.country}
                    onChange={updateField}
                    placeholder="e.g. Ghana"
                    autoComplete="country-name"
                  />
                </div>
                <div className={`field ${errorClass("address")}`}>
                  <FieldLabel
                    htmlFor="address"
                    label="Service address"
                    cn="服务地址"
                    required
                  />
                  <input
                    id="address"
                    name="address"
                    value={form.address}
                    onChange={updateField}
                    placeholder="Hospital, city and detailed address"
                    autoComplete="street-address"
                  />
                </div>
                <div className={`field ${errorClass("internalRegion")}`}>
                  <FieldLabel
                    htmlFor="internalRegion"
                    label="Internal service region"
                    cn="外贸区域"
                    required
                  />
                  <select
                    id="internalRegion"
                    name="internalRegion"
                    value={form.internalRegion}
                    onChange={updateField}
                  >
                    <option value="">Select region</option>
                    {internalRegions.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <FieldLabel
                    htmlFor="distributor"
                    label="Distributor"
                    cn="经销商 / 分销商"
                  />
                  <input
                    id="distributor"
                    name="distributor"
                    value={form.distributor}
                    onChange={updateField}
                    placeholder="Company name"
                  />
                </div>
                <div className={`field ${errorClass("customer")}`}>
                  <FieldLabel
                    htmlFor="customer"
                    label="Customer / hospital"
                    cn="客户 / 医院"
                    required
                  />
                  <input
                    id="customer"
                    name="customer"
                    value={form.customer}
                    onChange={updateField}
                    placeholder="Customer or site name"
                  />
                </div>
              </div>
            </section>

            <section className="form-section">
              <SectionTitle
                number="03"
                title="Product information"
                subtitle="Identify the affected product."
              />
              <div className="field-grid">
                <div className={`field ${errorClass("productCategory")}`}>
                  <FieldLabel
                    htmlFor="productCategory"
                    label="Product category"
                    cn="产品分类"
                    required
                  />
                  <select
                    id="productCategory"
                    name="productCategory"
                    value={form.productCategory}
                    onChange={updateField}
                  >
                    <option value="">Select category</option>
                    {productCategories.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                </div>
                <div className={`field ${errorClass("productName")}`}>
                  <FieldLabel
                    htmlFor="productName"
                    label="Product name"
                    cn="产品名称"
                    required
                  />
                  <input
                    id="productName"
                    name="productName"
                    value={form.productName}
                    onChange={updateField}
                    placeholder="Enter the product name"
                  />
                </div>
                <div className={`field ${errorClass("modelOrItem")}`}>
                  <FieldLabel
                    htmlFor="modelOrItem"
                    label="Model / reagent item"
                    cn="型号 / 试剂项目"
                    required
                  />
                  <input
                    id="modelOrItem"
                    name="modelOrItem"
                    value={form.modelOrItem}
                    onChange={updateField}
                    placeholder="Model or assay name"
                  />
                </div>
                <div className="field">
                  <FieldLabel
                    htmlFor="serialNumber"
                    label="Serial number"
                    cn="仪器序列号"
                  />
                  <input
                    id="serialNumber"
                    name="serialNumber"
                    value={form.serialNumber}
                    onChange={updateField}
                    placeholder="For instrument cases"
                  />
                </div>
                <div className="field">
                  <FieldLabel
                    htmlFor="reagentLot"
                    label="Reagent lot"
                    cn="试剂批号"
                  />
                  <input
                    id="reagentLot"
                    name="reagentLot"
                    value={form.reagentLot}
                    onChange={updateField}
                    placeholder="For reagent cases"
                  />
                </div>
              </div>
            </section>

            <section className="form-section">
              <SectionTitle
                number="04"
                title="Issue & impact"
                subtitle="Describe what happened and the operational impact."
              />
              <div className="field-grid">
                <div className={`field field-wide ${errorClass("issueTitle")}`}>
                  <FieldLabel
                    htmlFor="issueTitle"
                    label="Issue title"
                    cn="问题标题"
                    required
                  />
                  <input
                    id="issueTitle"
                    name="issueTitle"
                    value={form.issueTitle}
                    onChange={updateField}
                    placeholder="A short, specific summary"
                  />
                </div>
                <div className={`field field-wide ${errorClass("issueDescription")}`}>
                  <FieldLabel
                    htmlFor="issueDescription"
                    label="Customer issue description"
                    cn="客户问题描述"
                    required
                  />
                  <textarea
                    id="issueDescription"
                    name="issueDescription"
                    value={form.issueDescription}
                    onChange={updateField}
                    rows={5}
                    placeholder="Include the error message, when it started, frequency, affected tests or samples, and current instrument status."
                  />
                </div>
                <div className={`field ${errorClass("onlineServiceType")}`}>
                  <FieldLabel
                    htmlFor="onlineServiceType"
                    label="Online service type"
                    cn="线上服务类型"
                    required
                  />
                  <select
                    id="onlineServiceType"
                    name="onlineServiceType"
                    value={form.onlineServiceType}
                    onChange={updateField}
                  >
                    <option value="">Select service type</option>
                    {onlineServiceTypes.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                </div>
                <div className={`field ${errorClass("complaintCase")}`}>
                  <FieldLabel
                    htmlFor="complaintCase"
                    label="Complaint case?"
                    cn="是否为投诉类"
                    required
                  />
                  <select
                    id="complaintCase"
                    name="complaintCase"
                    value={form.complaintCase}
                    onChange={updateField}
                  >
                    <option value="">Select</option>
                    <option value="2">No / 否</option>
                    <option value="1">Yes / 是</option>
                  </select>
                </div>
                <div className={`field ${errorClass("faultLevel")}`}>
                  <FieldLabel
                    htmlFor="faultLevel"
                    label="Fault level"
                    cn="故障等级"
                    required
                  />
                  <select
                    id="faultLevel"
                    name="faultLevel"
                    value={form.faultLevel}
                    onChange={updateField}
                    aria-describedby="fault-level-guide"
                  >
                    <option value="">Select</option>
                    {faultLevelDefinitions.map((definition) => (
                      <option key={definition.level} value={definition.level}>
                        {definition.level} — {definition.severity}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={`field ${errorClass("severity")}`}>
                  <FieldLabel
                    htmlFor="severity"
                    label="Severity"
                    cn="严重程度"
                    required
                  />
                  <input
                    id="severity"
                    name="severity"
                    value={form.severity}
                    placeholder="Set automatically by fault level"
                    readOnly
                    className="derived-field"
                  />
                </div>
                <div className="definition-panel field-wide" id="fault-level-guide">
                  <h3>Fault level guide</h3>
                  <div className="fault-level-grid">
                    {faultLevelDefinitions.map((definition) => (
                      <article key={definition.level}>
                        <span className={`level-badge level-${definition.level.slice(-1)}`}>
                          {definition.level}
                        </span>
                        <strong>{definition.severity}</strong>
                        <p>{definition.description}</p>
                      </article>
                    ))}
                  </div>
                </div>
                <div className="field">
                  <FieldLabel
                    htmlFor="downtimeStatus"
                    label="Instrument downtime"
                    cn="仪器停机情况"
                  />
                  <select
                    id="downtimeStatus"
                    name="downtimeStatus"
                    value={form.downtimeStatus}
                    onChange={updateField}
                  >
                    <option value="">Not recorded</option>
                    <option>No downtime</option>
                    <option>Currently stopped</option>
                    <option>Recovered after downtime</option>
                    <option>Not applicable</option>
                  </select>
                </div>
                <div className="field">
                  <FieldLabel
                    htmlFor="downtimeHours"
                    label="Downtime (hours)"
                    cn="停机时长"
                  />
                  <input
                    id="downtimeHours"
                    name="downtimeHours"
                    type="number"
                    min="0"
                    step="0.5"
                    value={form.downtimeHours}
                    onChange={updateField}
                    placeholder="0"
                  />
                </div>
                <div className="field field-wide">
                  <FieldLabel
                    htmlFor="occurredAt"
                    label="When did it occur?"
                    cn="问题发生时间"
                  />
                  <input
                    id="occurredAt"
                    name="occurredAt"
                    type="text"
                    value={form.occurredAt}
                    onChange={updateField}
                    placeholder="e.g. 31 Jul 2026, 14:30"
                  />
                </div>
                <div className={`field field-wide ${errorClass("requestedSupportAt")}`}>
                  <FieldLabel
                    htmlFor="requestedSupportAt"
                    label="Requested support time (Beijing time)"
                    cn="预约开始时间（北京时间）"
                    required
                  />
                  <input
                    id="requestedSupportAt"
                    name="requestedSupportAt"
                    type="datetime-local"
                    value={form.requestedSupportAt}
                    onChange={updateField}
                  />
                </div>
              </div>
            </section>

            <section className="form-section">
              <SectionTitle
                number="05"
                title="Evidence"
                subtitle="Add filenames for photos, logs, or reports."
              />
              <div className="upload-box">
                <input
                  id="attachments"
                  type="file"
                  multiple
                  accept="image/*,.pdf,.txt,.log,.csv,.xlsx"
                  onChange={handleFiles}
                />
                <label htmlFor="attachments">
                  <span className="upload-icon" aria-hidden="true">↑</span>
                  <strong>Choose up to 5 files</strong>
                  <small>
                    Photos, PDF reports, logs, CSV or Excel · 文件仅记录名称
                  </small>
                </label>
              </div>
              {form.attachmentNames.length > 0 && (
                <ul className="file-list">
                  {form.attachmentNames.map((name) => <li key={name}>{name}</li>)}
                </ul>
              )}
              <p className="file-warning">
                This first version records filenames only. The actual files are
                not uploaded or stored.
              </p>
            </section>

            <div className="form-actions">
              <div>
                <button
                  className="button button-primary"
                  type="submit"
                  disabled={submittingTicket}
                >
                  {submittingTicket ? "Submitting…" : "Submit ticket"}
                  <span aria-hidden="true">→</span>
                </button>
                <button className="button button-secondary" type="button" onClick={saveDraft}>
                  Save draft
                </button>
              </div>
              <button className="text-button" type="button" onClick={clearForm}>
                Clear form
              </button>
            </div>
          </form>

          <section className="submissions-panel" aria-labelledby="recent-title">
            <div className="submissions-heading">
              <div>
                <span className="section-kicker">SAVED ON THIS DEVICE</span>
                <h2 id="recent-title">Ticket records</h2>
                <p>
                  {submissions.length} {submissions.length === 1 ? "ticket" : "tickets"} saved locally
                </p>
              </div>
              <button
                className="button button-export"
                type="button"
                onClick={exportCsv}
                disabled={submissions.length === 0}
              >
                Export CSV
              </button>
            </div>
            {submissions.length === 0 ? (
              <div className="empty-state">
                <span aria-hidden="true">⌁</span>
                <p>No saved tickets on this device yet.</p>
              </div>
            ) : (
              <div className="ticket-list">
                {submissions.map((ticket) => (
                  <details key={ticket.ticketId} className="ticket-record">
                    <summary className="ticket-row">
                      <div className="ticket-status" aria-hidden="true" />
                      <div className="ticket-main">
                        <strong>{ticket.issueTitle}</strong>
                        <p>
                          {ticket.customer} · {ticket.productName} · {ticket.country}
                        </p>
                        <span className={`level-badge level-${ticket.faultLevel.slice(-1)}`}>
                          {ticket.faultLevel} · {ticket.severity}
                        </span>
                      </div>
                      <div className="ticket-meta">
                        <strong>{ticket.ticketId}</strong>
                        <span>{new Date(ticket.submittedAt).toLocaleString()}</span>
                        <small>
                          {ticket.queueStatus === "pending"
                            ? "Awaiting CRM review"
                            : "Saved before cloud queue"}
                        </small>
                      </div>
                    </summary>
                    <div className="ticket-details">
                      <dl>
                        <div>
                          <dt>Reporter</dt>
                          <dd>
                            {ticket.employeeId
                              ? `${ticket.employeeName} · ${ticket.employeeId}`
                              : ticket.employeeName}
                          </dd>
                        </div>
                        <div>
                          <dt>Email</dt>
                          <dd>{ticket.email || "Not recorded"}</dd>
                        </div>
                        <div>
                          <dt>Product / model</dt>
                          <dd>{ticket.productName} · {ticket.modelOrItem}</dd>
                        </div>
                      </dl>
                      <div className="ticket-narrative">
                        <strong>Issue description</strong>
                        <p>{ticket.issueDescription}</p>
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            )}
          </section>

          <footer>
            <strong>International Service Desk</strong>
            <span>Secure intake queue · CRM upload requires confirmation</span>
          </footer>
        </section>
      </div>
    </main>
  );
}

export default function Home() {
  return (
    <AuthGate>
      {(user, signOut) => (
        <TicketDesk user={user} onSignOut={signOut} />
      )}
    </AuthGate>
  );
}
