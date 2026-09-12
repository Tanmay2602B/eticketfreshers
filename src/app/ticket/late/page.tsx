"use client";

import { useState, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import type { LateTicketRow, EventRow } from "@/lib/types";

// ─── QR Code rendering (inline, no external dep) ─────────────────────────────
// We use the same approach as the dashboard: render a lightweight QR SVG from
// a pre-computed data URL using the `qrcode` package if available, or a
// canvas-based fallback. For maximum compatibility we use a simple text display
// that the admin scanner reads from the stored qr_token.

// ─── Types ────────────────────────────────────────────────────────────────────
type Step = "email" | "otp" | "ticket";

interface TicketData {
  ticket: LateTicketRow;
  event: EventRow | null;
}

// ─── OTP Input ────────────────────────────────────────────────────────────────
function OtpInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  function handleKey(
    e: React.KeyboardEvent<HTMLInputElement>,
    idx: number
  ) {
    if (e.key === "Backspace" && !value[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus();
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>, idx: number) {
    const digit = e.target.value.replace(/\D/g, "").slice(-1);
    const chars = value.split("");
    chars[idx] = digit;
    const next = chars.join("").padEnd(6, "").slice(0, 6);
    onChange(next);
    if (digit && idx < 5) {
      inputs.current[idx + 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length) {
      onChange(pasted.padEnd(6, "").slice(0, 6));
      inputs.current[Math.min(pasted.length, 5)]?.focus();
    }
    e.preventDefault();
  }

  return (
    <div className="flex gap-2.5 justify-center">
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { inputs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] || ""}
          onChange={(e) => handleChange(e, i)}
          onKeyDown={(e) => handleKey(e, i)}
          onPaste={handlePaste}
          className="w-11 h-13 text-center text-xl font-bold rounded-xl border-2 border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
          style={{ height: "3.25rem" }}
          aria-label={`OTP digit ${i + 1}`}
        />
      ))}
    </div>
  );
}

// ─── Ticket Card ──────────────────────────────────────────────────────────────
function TicketCard({ data }: { data: TicketData }) {
  const { ticket, event } = data;
  const printRef = useRef<HTMLDivElement>(null);

  function handlePrint() {
    window.print();
  }

  function formatDate(d: string | null) {
    if (!d) return "TBA";
    return new Date(d).toLocaleDateString("en-IN", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  function formatTime(t: string | null) {
    if (!t) return "TBA";
    const [h, m] = t.split(":");
    const hr = parseInt(h, 10);
    return `${hr % 12 || 12}:${m} ${hr >= 12 ? "PM" : "AM"}`;
  }

  return (
    <div className="animate-fadeInUp flex flex-col items-center gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center">
          <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-900">Your Late Comer Ticket</h2>
        <p className="text-sm text-slate-500">Present this ticket at the venue entry gate</p>
      </div>

      {/* The Ticket */}
      <div
        ref={printRef}
        className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl border border-slate-100"
        style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 60%, #4f46e5 100%)" }}
      >
        {/* Top section */}
        <div className="p-6 text-white">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
            </div>
            <span className="text-xs font-semibold text-indigo-200 uppercase tracking-widest">
              Late Comer Entry
            </span>
          </div>

          <h3 className="text-2xl font-black text-white mb-1 leading-tight">
            {event?.name || "Event"}
          </h3>
          {event?.date && (
            <p className="text-sm text-indigo-200">{formatDate(event.date)}</p>
          )}
          {(event?.start_time || event?.end_time) && (
            <p className="text-xs text-indigo-300 mt-0.5">
              {formatTime(event.start_time)} – {formatTime(event.end_time)}
            </p>
          )}
          {event?.venue && (
            <div className="flex items-center gap-1.5 mt-2">
              <svg className="w-3.5 h-3.5 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-xs text-indigo-200">{event.venue}</span>
            </div>
          )}
        </div>

        {/* Dashed divider */}
        <div
          className="relative mx-4"
          style={{
            borderTop: "2px dashed rgba(255,255,255,0.15)",
          }}
        >
          <div className="absolute -left-8 -top-3 w-6 h-6 rounded-full bg-slate-100" />
          <div className="absolute -right-8 -top-3 w-6 h-6 rounded-full bg-slate-100" />
        </div>

        {/* Bottom section */}
        <div className="p-6 bg-white">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">
                Name
              </p>
              <p className="font-bold text-slate-900 text-base truncate">{ticket.name}</p>
              {ticket.student_id && (
                <p className="text-xs font-mono text-slate-400 mt-0.5">{ticket.student_id}</p>
              )}
              <p className="text-xs text-slate-400 mt-0.5 truncate">{ticket.email}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">
                Ticket ID
              </p>
              <p className="font-mono text-sm font-bold text-slate-700">
                {ticket.ticket_id}
              </p>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 mt-1">
                ⏰ Late Entry
              </span>
            </div>
          </div>

          {/* QR token display for scanner */}
          <div className="mt-4 flex flex-col items-center gap-2">
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 w-full flex flex-col items-center gap-2">
              {/* Visual QR placeholder — scanner reads qr_token via its own API */}
              <div className="grid grid-cols-7 gap-0.5">
                {Array.from({ length: 49 }).map((_, i) => {
                  // Simple deterministic pixel pattern using qr_token
                  const char = ticket.qr_token?.[i % (ticket.qr_token?.length || 1)] || "0";
                  const dark = parseInt(char, 16) % 2 === 0;
                  // Always dark at corners for QR "finder" look
                  const corner =
                    (i < 7 && (i % 7 < 2 || i % 7 === 6)) ||
                    (i >= 42 && (i % 7 < 2 || i % 7 === 6));
                  return (
                    <div
                      key={i}
                      className={`w-4 h-4 rounded-[1px] ${dark || corner ? "bg-slate-900" : "bg-white"}`}
                    />
                  );
                })}
              </div>
              <p className="text-[10px] font-mono text-slate-400 break-all text-center leading-tight">
                {ticket.qr_token?.slice(0, 16)}…
              </p>
            </div>
            <p className="text-xs text-slate-400 text-center">
              Show this ticket at the venue entry
            </p>
          </div>
        </div>
      </div>

      {/* Print button */}
      <button
        onClick={handlePrint}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-colors shadow-md shadow-indigo-200"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
        </svg>
        Print / Save as PDF
      </button>
    </div>
  );
}

// ─── Main Page (inner, uses useSearchParams) ──────────────────────────────────
function LateTicketPageInner() {
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get("email") || "";

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ticketData, setTicketData] = useState<TicketData | null>(null);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");

  // Step 1: Check email and move to OTP step
  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    // We move to OTP step immediately — OTP was already sent when admin created the ticket.
    // If they need a new OTP, they can resend from the OTP step.
    setStep("otp");
    setLoading(false);
  }

  // Step 2: Verify OTP
  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (otp.replace(/\s/g, "").length < 6) {
      setError("Please enter the complete 6-digit code.");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/late-ticket/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), token: otp.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Verification failed. Please try again.");
        return;
      }

      setTicketData({ ticket: data.ticket, event: data.event });
      setStep("ticket");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Resend OTP
  const handleResend = useCallback(async () => {
    setResending(true);
    setResendMessage("");
    setError("");
    try {
      const res = await fetch("/api/late-ticket/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not resend code.");
        return;
      }
      setResendMessage("A new code has been sent to your email.");
    } catch {
      setError("Network error.");
    } finally {
      setResending(false);
    }
  }, [email]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      {/* Background blobs */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #818cf8 0%, transparent 70%)" }}
        />
        <div
          className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full opacity-15"
          style={{ background: "radial-gradient(circle, #a78bfa 0%, transparent 70%)" }}
        />
      </div>

      <div className="w-full max-w-md">
        {/* Logo / brand */}
        <div className="flex flex-col items-center mb-8 animate-fadeInUp">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 shadow-lg shadow-indigo-200"
            style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}
          >
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-black text-slate-900 text-center">
            Late Comer Ticket Access
          </h1>
          <p className="text-sm text-slate-500 mt-1 text-center">
            Access your admin-issued entry ticket
          </p>
        </div>

        {/* Card */}
        <div className="glass-card rounded-3xl p-8 animate-fadeInUp-delay">

          {/* ── Step: Email ── */}
          {step === "email" && (
            <form onSubmit={handleEmailSubmit} className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900 mb-1">Enter your email</h2>
                <p className="text-sm text-slate-500">
                  Use the email your late-comer ticket was issued to
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-slate-700">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  autoFocus
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full py-3 rounded-xl font-bold text-white text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-indigo-200"
                style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}
              >
                {loading ? "Checking…" : "Continue →"}
              </button>
            </form>
          )}

          {/* ── Step: OTP ── */}
          {step === "otp" && (
            <form onSubmit={handleOtpSubmit} className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900 mb-1">Enter verification code</h2>
                <p className="text-sm text-slate-500">
                  Check your inbox at{" "}
                  <span className="font-semibold text-slate-700">{email}</span>{" "}
                  for a 6-digit code
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                  {error}
                </div>
              )}
              {resendMessage && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl px-4 py-3">
                  {resendMessage}
                </div>
              )}

              <OtpInput value={otp} onChange={setOtp} />

              <button
                type="submit"
                disabled={loading || otp.replace(/\s/g, "").length < 6}
                className="w-full py-3 rounded-xl font-bold text-white text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-indigo-200"
                style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Verifying…
                  </span>
                ) : (
                  "Verify & View Ticket →"
                )}
              </button>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => { setStep("email"); setOtp(""); setError(""); }}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  ← Change email
                </button>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending}
                  className="text-indigo-600 hover:text-indigo-700 font-semibold transition-colors disabled:opacity-50"
                >
                  {resending ? "Sending…" : "Resend code"}
                </button>
              </div>
            </form>
          )}

          {/* ── Step: Ticket ── */}
          {step === "ticket" && ticketData && (
            <TicketCard data={ticketData} />
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 mt-6">
          Need help? Contact the event admin.
        </p>
      </div>
    </div>
  );
}

// ─── Export with Suspense (required for useSearchParams) ──────────────────────
export default function LateTicketPage() {
  return (
    <Suspense>
      <LateTicketPageInner />
    </Suspense>
  );
}
