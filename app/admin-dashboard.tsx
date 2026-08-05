"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";

const ADMIN_EMAIL = "xu.yang2@getein.cn";

const queueStatuses = [
  "pending",
  "awaiting_confirmation",
  "processing",
  "uploaded",
  "needs_review",
  "failed",
  "uncertain",
] as const;

type QueueStatus = (typeof queueStatuses)[number];

type AdminSummary = {
  total_count: number;
  pending_count: number;
  awaiting_confirmation_count: number;
  processing_count: number;
  uploaded_count: number;
  needs_review_count: number;
  failed_count: number;
  uncertain_count: number;
};

type AdminTicket = {
  id: string;
  client_ticket_id: string;
  submitter_name: string;
  submitter_email: string;
  payload: Record<string, unknown>;
  status: QueueStatus;
  target_crm_owner: string;
  created_at: string;
  updated_at: string;
  crm_work_order_number: string | null;
};

const emptySummary: AdminSummary = {
  total_count: 0,
  pending_count: 0,
  awaiting_confirmation_count: 0,
  processing_count: 0,
  uploaded_count: 0,
  needs_review_count: 0,
  failed_count: 0,
  uncertain_count: 0,
};

const statusLabels: Record<QueueStatus, string> = {
  pending: "Pending / 待收集",
  awaiting_confirmation: "Awaiting confirmation / 待确认",
  processing: "Processing / 处理中",
  uploaded: "Uploaded / 已上传 CRM",
  needs_review: "Needs review / 需复核",
  failed: "Failed / 失败",
  uncertain: "Uncertain / 状态待确认",
};

const ticketContentFields = [
  ["employeeId", "Employee ID / 员工编号"],
  ["customer", "Customer / 客户"],
  ["country", "Country / 国家"],
  ["address", "Service address / 服务地址"],
  ["internalRegion", "Internal region / 内部区域"],
  ["distributor", "Distributor / 经销商"],
  ["productCategory", "Product category / 产品分类"],
  ["productName", "Product / 产品"],
  ["modelOrItem", "Model or item / 型号或项目"],
  ["serialNumber", "Serial number / 序列号"],
  ["reagentLot", "Reagent lot / 试剂批号"],
  ["onlineServiceType", "Service type / 服务类型"],
  ["complaintCase", "Complaint case / 投诉类"],
  ["faultLevel", "Fault level / 故障等级"],
  ["severity", "Severity / 严重程度"],
  ["downtimeStatus", "Downtime / 停机状态"],
  ["downtimeHours", "Downtime hours / 停机时长"],
  ["occurredAt", "Occurred at / 发生时间"],
  ["requestedSupportAt", "Requested support / 预约时间"],
  ["attachmentNames", "Attachments / 附件名称"],
] as const;

function payloadText(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  if (Array.isArray(value)) return value.map(String).join(", ");
  if (typeof value === "string" || typeof value === "number") return String(value);
  return "";
}

function statusCount(summary: AdminSummary, status: QueueStatus) {
  return summary[`${status}_count` as keyof AdminSummary] as number;
}

export default function AdminDashboard({ userEmail }: { userEmail: string }) {
  const isAdmin = userEmail.trim().toLowerCase() === ADMIN_EMAIL;
  const [summary, setSummary] = useState<AdminSummary>(emptySummary);
  const [tickets, setTickets] = useState<AdminTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [refreshedAt, setRefreshedAt] = useState("");

  const refresh = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setErrorMessage("");

    const [summaryResult, ticketResult] = await Promise.all([
      supabase.rpc("get_ticket_submission_admin_summary"),
      supabase.rpc("get_ticket_submission_admin_rows", {
        p_limit: 100,
        p_offset: 0,
      }),
    ]);

    setLoading(false);
    if (summaryResult.error || ticketResult.error) {
      setErrorMessage(
        "The protected ticket overview could not be loaded. Please refresh or contact support.",
      );
      return;
    }

    const summaryRow = summaryResult.data?.[0] as AdminSummary | undefined;
    setSummary(summaryRow ?? emptySummary);
    setTickets((ticketResult.data ?? []) as AdminTicket[]);
    setRefreshedAt(new Date().toLocaleString());
  }, [isAdmin]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  if (!isAdmin) return null;

  return (
    <section className="admin-dashboard" aria-labelledby="admin-dashboard-title">
      <div className="admin-dashboard-heading">
        <div>
          <span className="section-kicker">ADMIN · READ ONLY</span>
          <h2 id="admin-dashboard-title">Registered ticket overview</h2>
          <p>登记工单统计与内容 · Only {ADMIN_EMAIL} can access this server data.</p>
        </div>
        <button
          className="button button-export"
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {errorMessage ? (
        <p className="admin-dashboard-error" role="alert">{errorMessage}</p>
      ) : (
        <>
          <div className="admin-summary-grid" aria-label="Ticket counts by status">
            <article className="admin-summary-total">
              <span>All registered / 全部登记</span>
              <strong>{summary.total_count}</strong>
            </article>
            {queueStatuses.map((status) => (
              <article key={status}>
                <span>{statusLabels[status]}</span>
                <strong>{statusCount(summary, status)}</strong>
              </article>
            ))}
          </div>

          <div className="admin-ticket-heading">
            <div>
              <strong>Latest registrations / 最新登记</strong>
              <span>Showing up to 100 newest tickets</span>
            </div>
            <small>{refreshedAt ? `Updated ${refreshedAt}` : "Loading…"}</small>
          </div>

          {loading && tickets.length === 0 ? (
            <div className="admin-dashboard-empty" role="status">Loading registered tickets…</div>
          ) : tickets.length === 0 ? (
            <div className="admin-dashboard-empty">No registered tickets found.</div>
          ) : (
            <div className="admin-ticket-list">
              {tickets.map((ticket) => {
                const issueTitle = payloadText(ticket.payload, "issueTitle") || "Untitled ticket";
                const issueDescription = payloadText(ticket.payload, "issueDescription") || "No issue description recorded.";
                return (
                  <details className="admin-ticket-record" key={ticket.id}>
                    <summary>
                      <div>
                        <strong>{issueTitle}</strong>
                        <span>{ticket.submitter_name} · {ticket.submitter_email}</span>
                      </div>
                      <div className="admin-ticket-meta">
                        <strong>{ticket.client_ticket_id}</strong>
                        <span>{statusLabels[ticket.status]}</span>
                        <small>{new Date(ticket.created_at).toLocaleString()}</small>
                      </div>
                    </summary>
                    <div className="admin-ticket-content">
                      <dl>
                        <div><dt>Reporter / 登记人</dt><dd>{ticket.submitter_name}</dd></div>
                        <div><dt>Email / 邮箱</dt><dd>{ticket.submitter_email}</dd></div>
                        {ticketContentFields.map(([key, label]) => (
                          <div key={key}>
                            <dt>{label}</dt>
                            <dd>{payloadText(ticket.payload, key) || "Not recorded"}</dd>
                          </div>
                        ))}
                        <div><dt>CRM work order / CRM 工单</dt><dd>{ticket.crm_work_order_number || "Not uploaded"}</dd></div>
                      </dl>
                      <div className="admin-ticket-narrative">
                        <strong>Issue content / 工单内容</strong>
                        <p>{issueDescription}</p>
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}
