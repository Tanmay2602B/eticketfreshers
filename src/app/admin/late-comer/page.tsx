"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { PageSpinner } from "@/components/ui/spinner";
import type { LateTicketRow } from "@/lib/types";

// ============================================================
// Create Ticket Modal
// ============================================================
function CreateTicketModal({
  onSuccess,
  onClose,
}: {
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [studentId, setStudentId] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successEmail, setSuccessEmail] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/admin/late-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          student_id: studentId.trim() || undefined,
          reason: reason.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create ticket.");
        return;
      }
      setSuccessEmail(email.trim());
      onSuccess();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Create Late Comer Ticket
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              An OTP will be sent to the student&apos;s email immediately
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5 space-y-4">
            {successEmail ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
                  <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-base">Ticket Created!</p>
                  <p className="text-sm text-slate-500 mt-1">
                    An OTP has been sent to{" "}
                    <span className="font-semibold text-slate-700">{successEmail}</span>
                    .<br />
                    The student can access their ticket at{" "}
                    <span className="font-mono text-primary-600">/ticket/late</span>.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                >
                  Close
                </Button>
              </div>
            ) : (
              <>
                {error && (
                  <Alert variant="error" onDismiss={() => setError("")}>
                    {error}
                  </Alert>
                )}

                <Input
                  label="Full Name *"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  required
                  autoFocus
                />
                <Input
                  label="Email Address *"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. rahul@college.edu"
                  helperText="OTP will be sent to this email"
                  required
                />
                <Input
                  label="Student ID (optional)"
                  type="text"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  placeholder="e.g. CS2024001"
                />
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-700">
                    Reason for Late Entry (optional)
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Internet issue, missed deadline..."
                    rows={2}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  />
                </div>
              </>
            )}
          </div>

          {!successEmail && (
            <div className="px-6 py-4 border-t border-slate-100 flex gap-3 justify-end bg-slate-50 rounded-b-2xl">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onClose}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" loading={saving} size="sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Save & Send OTP
              </Button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

// ============================================================
// Status Badge
// ============================================================
function StatusBadge({ ticket }: { ticket: LateTicketRow }) {
  if (ticket.cancelled_at) {
    return <Badge variant="cancelled">Cancelled</Badge>;
  }
  if (ticket.status === "verified") {
    return <Badge variant="used">Verified</Badge>;
  }
  return <Badge variant="offline">Pending OTP</Badge>;
}

// ============================================================
// Main Page
// ============================================================
export default function LateComertPage() {
  const [tickets, setTickets] = useState<LateTicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const loadTickets = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/late-ticket");
      if (res.ok) {
        const data = await res.json();
        setTickets(data.tickets || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  async function handleResend(ticket: LateTicketRow) {
    setResendingId(ticket.id);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/late-ticket/${ticket.id}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Failed to resend." });
        return;
      }
      setMessage({ type: "success", text: `OTP resent to ${ticket.email}` });
    } catch {
      setMessage({ type: "error", text: "Network error." });
    } finally {
      setResendingId(null);
    }
  }

  async function handleCancel(ticket: LateTicketRow) {
    if (!confirm(`Cancel ticket for ${ticket.name} (${ticket.email})?`)) return;
    setCancellingId(ticket.id);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/late-ticket/${ticket.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Failed to cancel." });
        return;
      }
      setMessage({ type: "success", text: `Ticket for ${ticket.name} cancelled.` });
      loadTickets();
    } catch {
      setMessage({ type: "error", text: "Network error." });
    } finally {
      setCancellingId(null);
    }
  }

  function handleCreateSuccess() {
    loadTickets();
  }

  if (loading) return <PageSpinner />;

  const activeTickets = tickets.filter((t) => !t.cancelled_at);
  const cancelledTickets = tickets.filter((t) => t.cancelled_at);

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Late Comer Tickets</h1>
          <p className="text-sm text-slate-500 mt-1">
            Create tickets for students who missed the regular window. They
            receive an OTP to access their ticket.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Ticket
        </Button>
      </div>

      {/* Alert message */}
      {message && (
        <Alert
          variant={message.type}
          className="mb-4"
          onDismiss={() => setMessage(null)}
        >
          {message.text}
        </Alert>
      )}

      {/* How it works */}
      <Card className="mb-6 bg-amber-50 border border-amber-200">
        <div className="flex gap-3">
          <div className="text-amber-500 mt-0.5">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-sm text-amber-800">
            <p className="font-semibold mb-1">How it works</p>
            <ol className="list-decimal ml-4 space-y-1 text-amber-700">
              <li>Click <strong>Create Ticket</strong> and fill in the student&apos;s details.</li>
              <li>An OTP is sent to their email automatically.</li>
              <li>The student visits <span className="font-mono bg-amber-100 px-1 rounded">/ticket/late</span>, enters their email + OTP, and downloads their ticket.</li>
              <li>The ticket QR code is scannable by the regular QR scanner.</li>
            </ol>
          </div>
        </div>
      </Card>

      {/* Active tickets */}
      <Card className="mb-6">
        <CardTitle className="mb-4">
          Active Tickets{" "}
          <span className="ml-2 text-sm font-normal text-slate-400">
            ({activeTickets.length})
          </span>
        </CardTitle>

        {activeTickets.length === 0 ? (
          <div className="text-center py-10">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-700">No late-comer tickets yet</p>
            <p className="text-xs text-slate-400 mt-1">
              Click &ldquo;Create Ticket&rdquo; to generate one for a student
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 px-5 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Student
                  </th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Ticket ID
                  </th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Created
                  </th>
                  <th className="text-right py-2 px-5 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {activeTickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    className="border-t border-slate-50 hover:bg-slate-50 transition-colors"
                  >
                    <td className="py-3 px-5">
                      <p className="font-medium text-slate-900">{ticket.name}</p>
                      <p className="text-xs text-slate-400">{ticket.email}</p>
                      {ticket.student_id && (
                        <p className="text-xs font-mono text-slate-400">
                          {ticket.student_id}
                        </p>
                      )}
                      {ticket.reason && (
                        <p className="text-xs text-slate-400 italic mt-0.5">
                          &ldquo;{ticket.reason}&rdquo;
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-mono text-xs text-slate-600">
                        {ticket.ticket_id || "—"}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge ticket={ticket} />
                      {ticket.accessed_at && (
                        <p className="text-xs text-slate-400 mt-1">
                          Accessed{" "}
                          {new Date(ticket.accessed_at).toLocaleDateString(
                            "en-IN"
                          )}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-3 text-xs text-slate-500">
                      {new Date(ticket.created_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-3 px-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {ticket.status === "pending" && !ticket.cancelled_at && (
                          <button
                            onClick={() => handleResend(ticket)}
                            disabled={resendingId === ticket.id}
                            title="Resend OTP"
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 border border-primary-200 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {resendingId === ticket.id ? (
                              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                            )}
                            Resend OTP
                          </button>
                        )}
                        {!ticket.cancelled_at && (
                          <button
                            onClick={() => handleCancel(ticket)}
                            disabled={cancellingId === ticket.id}
                            title="Cancel ticket"
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {cancellingId === ticket.id ? (
                              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            )}
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Cancelled tickets (collapsible hint) */}
      {cancelledTickets.length > 0 && (
        <p className="text-xs text-slate-400 text-center">
          {cancelledTickets.length} cancelled ticket
          {cancelledTickets.length !== 1 ? "s" : ""} hidden
        </p>
      )}

      {/* Create Ticket Modal */}
      {showCreate && (
        <CreateTicketModal
          onSuccess={handleCreateSuccess}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}
