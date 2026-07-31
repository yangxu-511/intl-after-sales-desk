"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";

type TicketForm = {
  employeeName: string;
  employeeId: string;
  email: string;
  region: string;
  country: string;
  distributor: string;
  customer: string;
  serviceType: string;
  productCategory: string;
  productName: string;
  modelOrItem: string;
  serialNumber: string;
  reagentLot: string;
  issueTitle: string;
  issueDescription: string;
  complaint: string;
  faultLevel: string;
  severity: string;
  priority: string;
  downtimeStatus: string;
  downtimeHours: string;
  occurredAt: string;
  actionsTaken: string;
  currentResult: string;
  validationNotes: string;
  attachmentNames: string[];
};

type Submission = TicketForm & {
  ticketId: string;
  submittedAt: string;
};

const DRAFT_KEY = "gbase-after-sales-ticket-draft-v1";
const SUBMISSIONS_KEY = "gbase-after-sales-ticket-submissions-v1";

const initialForm: TicketForm = {
  employeeName: "",
  employeeId: "",
  email: "",
  region: "",
  country: "",
  distributor: "",
  customer: "",
  serviceType: "",
  productCategory: "",
  productName: "",
  modelOrItem: "",
  serialNumber: "",
  reagentLot: "",
  issueTitle: "",
  issueDescription: "",
  complaint: "",
  faultLevel: "",
  severity: "",
  priority: "",
  downtimeStatus: "",
  downtimeHours: "",
  occurredAt: "",
  actionsTaken: "",
  currentResult: "",
  validationNotes: "",
  attachmentNames: [],
};

const requiredFields: Array<keyof TicketForm> = [
  "employeeName",
  "employeeId",
  "country",
  "customer",
  "serviceType",
  "productCategory",
  "productName",
  "modelOrItem",
  "issueTitle",
  "issueDescription",
  "complaint",
  "faultLevel",
  "severity",
  "currentResult",
];

const productCategories = [
  "Hematology instrument",
  "Hematology reagent",
  "Chemiluminescence instrument",
  "Chemiluminescence reagent",
  "Coagulation instrument",
  "Coagulation reagent",
  "Biochemistry instrument",
  "Biochemistry reagent",
  "Molecular diagnostics instrument",
  "Molecular diagnostics reagent",
  "POCT instrument",
  "POCT reagent",
  "Biochemistry & immunoassay automation",
];

const serviceTypes = [
  "Instrument issue",
  "Reagent issue",
  "Online installation",
  "Remote service guidance",
  "Market refurbishment / repair",
];

const crmFieldMap = [
  ["Service type", "线上服务类型"],
  ["Product category", "产品分类"],
  ["Model / reagent item", "型号 or 试剂项目"],
  ["Complaint case", "是否为投诉类"],
  ["Fault level", "故障等级"],
  ["Severity", "严重程度"],
  ["Issue description", "客户问题描述"],
  ["Actions taken", "工作描述"],
  ["Validation notes", "验证情况说明"],
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

function createTicketId() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  const time = now.toTimeString().slice(0, 8).replaceAll(":", "");
  return `INT-${date}-${time}`;
}

function csvEscape(value: string | string[]) {
  const text = Array.isArray(value) ? value.join("; ") : value;
  return `"${String(text ?? "").replaceAll('"', '""')}"`;
}

export default function Home() {
  const [form, setForm] = useState<TicketForm>(initialForm);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState("Draft not started");
  const [errors, setErrors] = useState<Array<keyof TicketForm>>([]);
  const [successId, setSuccessId] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const savedDraft = window.localStorage.getItem(DRAFT_KEY);
        const savedSubmissions = window.localStorage.getItem(SUBMISSIONS_KEY);
        if (savedDraft) {
          setForm({ ...initialForm, ...JSON.parse(savedDraft) });
          setSaveState("Draft restored from this device");
        }
        if (savedSubmissions) {
          setSubmissions(JSON.parse(savedSubmissions));
        }
      } catch {
        setSaveState("Local save is unavailable");
      } finally {
        setLoaded(true);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

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
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => current.filter((item) => item !== field));
    setSuccessId("");
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
    setForm(initialForm);
    setErrors([]);
    setSuccessId("");
    window.localStorage.removeItem(DRAFT_KEY);
    setSaveState("Draft cleared");
  }

  function submitTicket(event: FormEvent<HTMLFormElement>) {
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

    const submission: Submission = {
      ...form,
      ticketId: createTicketId(),
      submittedAt: new Date().toISOString(),
    };
    const next = [submission, ...submissions].slice(0, 20);

    try {
      window.localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(next));
      window.localStorage.removeItem(DRAFT_KEY);
      setSubmissions(next);
      setSuccessId(submission.ticketId);
      setForm(initialForm);
      setErrors([]);
      setSaveState("Ready for a new ticket");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setSaveState("Submission could not be saved on this device");
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
      "region",
      "country",
      "distributor",
      "customer",
      "serviceType",
      "productCategory",
      "productName",
      "modelOrItem",
      "serialNumber",
      "reagentLot",
      "issueTitle",
      "issueDescription",
      "complaint",
      "faultLevel",
      "severity",
      "priority",
      "downtimeStatus",
      "downtimeHours",
      "occurredAt",
      "actionsTaken",
      "currentResult",
      "validationNotes",
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
    link.download = `international-after-sales-tickets-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
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
        <div className="privacy-pill">
          <span aria-hidden="true">●</span>
          Local-only data
        </div>
      </header>

      <div className="page-shell" id="top">
        <aside className="intro-panel">
          <div className="eyebrow">FIELD SUPPORT INTAKE · V1</div>
          <h1>Report the issue.<br />Keep support moving.</h1>
          <p className="intro-copy">
            A focused form for international service teams. Your draft and
            submissions stay in this browser until you export them.
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
          {successId && (
            <div className="success-banner" role="status">
              <span className="success-check" aria-hidden="true">✓</span>
              <div>
                <strong>Ticket saved on this device</strong>
                <p>
                  Reference <b>{successId}</b>. Export the record before moving
                  to another browser or device.
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

          {errors.length > 0 && (
            <div className="error-summary" role="alert">
              Please complete the {errors.length} highlighted required
              {errors.length === 1 ? " field" : " fields"}.
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
                <div className={`field ${errorClass("employeeId")}`}>
                  <FieldLabel
                    htmlFor="employeeId"
                    label="Employee ID"
                    cn="员工编号"
                    required
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
                <div className="field">
                  <FieldLabel htmlFor="region" label="Market region" cn="区域" />
                  <select
                    id="region"
                    name="region"
                    value={form.region}
                    onChange={updateField}
                  >
                    <option value="">Select the internal region</option>
                    {["Region 1", "Region 2", "Region 3", "Region 4", "Region 5", "Region 6", "Special Region"].map(
                      (item) => <option key={item}>{item}</option>,
                    )}
                  </select>
                </div>
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
                title="Product"
                subtitle="Identify the affected product."
              />
              <div className="field-grid">
                <div className={`field ${errorClass("serviceType")}`}>
                  <FieldLabel
                    htmlFor="serviceType"
                    label="Service type"
                    cn="线上服务类型"
                    required
                  />
                  <select
                    id="serviceType"
                    name="serviceType"
                    value={form.serviceType}
                    onChange={updateField}
                  >
                    <option value="">Select service type</option>
                    {serviceTypes.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </div>
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
                      <option key={item}>{item}</option>
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
                <div className={`field ${errorClass("complaint")}`}>
                  <FieldLabel
                    htmlFor="complaint"
                    label="Complaint case?"
                    cn="是否为投诉类"
                    required
                  />
                  <select
                    id="complaint"
                    name="complaint"
                    value={form.complaint}
                    onChange={updateField}
                  >
                    <option value="">Select</option>
                    <option>No</option>
                    <option>Yes</option>
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
                  >
                    <option value="">Select</option>
                    <option>Level 1</option>
                    <option>Level 2</option>
                    <option>Level 3</option>
                  </select>
                </div>
                <div className={`field ${errorClass("severity")}`}>
                  <FieldLabel
                    htmlFor="severity"
                    label="Severity"
                    cn="严重程度"
                    required
                  />
                  <select
                    id="severity"
                    name="severity"
                    value={form.severity}
                    onChange={updateField}
                  >
                    <option value="">Select</option>
                    <option>Minor</option>
                    <option>Moderate</option>
                    <option>Severe</option>
                  </select>
                </div>
                <div className="field">
                  <FieldLabel htmlFor="priority" label="Priority" cn="优先级" />
                  <select
                    id="priority"
                    name="priority"
                    value={form.priority}
                    onChange={updateField}
                  >
                    <option value="">Select</option>
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                    <option>Highest</option>
                  </select>
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
                    type="datetime-local"
                    value={form.occurredAt}
                    onChange={updateField}
                  />
                </div>
              </div>
            </section>

            <section className="form-section">
              <SectionTitle
                number="05"
                title="Actions & result"
                subtitle="Record what has already been done."
              />
              <div className="field-grid">
                <div className="field field-wide">
                  <FieldLabel
                    htmlFor="actionsTaken"
                    label="Troubleshooting / actions taken"
                    cn="已采取的处理措施"
                  />
                  <textarea
                    id="actionsTaken"
                    name="actionsTaken"
                    value={form.actionsTaken}
                    onChange={updateField}
                    rows={4}
                    placeholder="List the checks, settings, replacements, remote guidance, or coordination already completed."
                  />
                </div>
                <div className={`field field-wide ${errorClass("currentResult")}`}>
                  <FieldLabel
                    htmlFor="currentResult"
                    label="Current result"
                    cn="当前处理结果"
                    required
                  />
                  <select
                    id="currentResult"
                    name="currentResult"
                    value={form.currentResult}
                    onChange={updateField}
                  >
                    <option value="">Select current result</option>
                    <option>Resolved and verified</option>
                    <option>Temporary solution provided</option>
                    <option>Pending customer verification</option>
                    <option>Pending spare parts</option>
                    <option>Pending R&D / quality support</option>
                    <option>Unresolved</option>
                  </select>
                </div>
                <div className="field field-wide">
                  <FieldLabel
                    htmlFor="validationNotes"
                    label="Validation / follow-up notes"
                    cn="验证情况与后续事项"
                  />
                  <textarea
                    id="validationNotes"
                    name="validationNotes"
                    value={form.validationNotes}
                    onChange={updateField}
                    rows={3}
                    placeholder="How was recovery confirmed? What still needs to happen?"
                  />
                </div>
              </div>
            </section>

            <section className="form-section">
              <SectionTitle
                number="06"
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
                <button className="button button-primary" type="submit">
                  Save ticket
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
                <span className="section-kicker">THIS DEVICE</span>
                <h2 id="recent-title">Recent submissions</h2>
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
                  <article key={ticket.ticketId} className="ticket-row">
                    <div className="ticket-status" aria-hidden="true" />
                    <div className="ticket-main">
                      <strong>{ticket.issueTitle}</strong>
                      <p>
                        {ticket.customer} · {ticket.productName} · {ticket.country}
                      </p>
                    </div>
                    <div className="ticket-meta">
                      <strong>{ticket.ticketId}</strong>
                      <span>
                        {new Date(ticket.submittedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <footer>
            <strong>International Service Desk</strong>
            <span>Standalone browser prototype · No SalesEasy CRM write-back</span>
          </footer>
        </section>
      </div>
    </main>
  );
}
