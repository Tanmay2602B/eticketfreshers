"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { PageSpinner } from "@/components/ui/spinner";
import { createClient } from "@/lib/supabase/client";
import type { StudentDashboardData } from "@/lib/types";
import { formatDate, formatTime } from "@/lib/utils";

export default function StudentDashboard() {
  const router = useRouter();
  const [data, setData] = useState<StudentDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  // Load dashboard data
  useEffect(() => {
    fetch("/api/student/dashboard")
      .then((r) => {
        if (r.status === 401) { router.push("/"); return null; }
        return r.json();
      })
      .then((d) => { if (d) setData(d); })
      .catch(() => setError("Failed to load dashboard data."))
      .finally(() => setLoading(false));
  }, [router]);

  // Generate QR code whenever ticket changes
  useEffect(() => {
    if (!data?.ticket?.qr_token) { setQrDataUrl(null); return; }
    import("qrcode").then((QRCode) => {
      QRCode.toDataURL(data.ticket!.qr_token, {
        width: 300,
        margin: 2,
        color: { dark: "#1e1b4b", light: "#ffffff" },
        errorCorrectionLevel: "H",
      }).then(setQrDataUrl).catch(console.error);
    });
  }, [data?.ticket?.qr_token]);

  // Generate ticket
  const handleGenerateTicket = useCallback(async () => {
    setGenerating(true);
    setError("");
    try {
      const res = await fetch("/api/student/ticket", { method: "POST" });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || "Failed to generate ticket.");
        return;
      }
      // Refresh full dashboard
      const dashRes = await fetch("/api/student/dashboard");
      if (dashRes.ok) setData(await dashRes.json());
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setGenerating(false);
    }
  }, []);

  // Download PDF
  const handleDownload = useCallback(async () => {
    if (!data?.ticket || !data?.event || !data?.student) return;
    setDownloading(true);
    setError("");
    try {
      const { generateTicketPDF } = await import("@/components/student/ticket-pdf");
      await generateTicketPDF(data.event, data.student, data.ticket);
      await fetch("/api/student/ticket", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket_id: data.ticket.id }),
      });
      const res = await fetch("/api/student/dashboard");
      if (res.ok) setData(await res.json());
    } catch (err: unknown) {
      console.error("PDF download error:", err);
      const message = err instanceof Error ? err.message : String(err);
      setError(`PDF download failed: ${message}. You can still screenshot your ticket above.`);
    } finally {
      setDownloading(false);
    }
  }, [data]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  };

  if (loading) return <PageSpinner />;

  if (!data || !data.student) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="text-center max-w-sm w-full">
          <p className="text-slate-500 mb-4">Unable to load your information.</p>
          <Button onClick={() => router.push("/")} variant="secondary">Go to Login</Button>
        </Card>
      </div>
    );
  }

  const { student, event, ticket, ticketAvailable } = data;

  return (
    <div className="min-h-screen pb-10">
      {/* Header */}
      <div className="gradient-hero">
        <div className="max-w-lg mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-bold text-white">My E-Ticket</h1>
            <button onClick={handleLogout} className="text-white/70 hover:text-white text-sm font-medium transition-colors">
              Logout
            </button>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
            <p className="text-white font-semibold text-lg">{student.name}</p>
            <p className="text-white/70 text-sm">{student.student_id} • {student.course || "N/A"}</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-4 space-y-4">
        {error && (
          <Alert variant="error" onDismiss={() => setError("")}>{error}</Alert>
        )}

        {/* ── Ticket not available ── */}
        {!ticketAvailable && !ticket && (
          <Card glass className="animate-fadeInUp text-center py-8">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="font-bold text-slate-900 mb-1">Ticket Window Closed</h3>
            <p className="text-sm text-slate-500">The e-ticket system is currently closed. Please check back later.</p>
          </Card>
        )}

        {/* ── Generate button ── */}
        {ticketAvailable && !ticket && (
          <Card glass className="animate-fadeInUp text-center py-6">
            <div className="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center mx-auto mb-3">
              <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
            </div>
            <h3 className="font-bold text-slate-900 mb-1">Get Your E-Ticket</h3>
            <p className="text-sm text-slate-500 mb-5">Click below to generate your entry pass with QR code.</p>
            <Button size="lg" className="w-full" onClick={handleGenerateTicket} loading={generating}>
              🎟️ Generate E-Ticket
            </Button>
          </Card>
        )}

        {/* ── ON-SCREEN TICKET with QR code ── */}
        {ticket && ticket.status === "ACTIVE" && (
          <>
            {/* Visual Ticket Card */}
            <div className="animate-fadeInUp">
              <p className="text-xs text-slate-400 text-center mb-2 font-medium uppercase tracking-wider">
                📸 Screenshot to save your ticket
              </p>
              {/* Ticket visual */}
              <div
                id="ticket-card"
                style={{
                  background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
                  borderRadius: "20px",
                  padding: "0",
                  overflow: "hidden",
                  boxShadow: "0 20px 60px rgba(79,70,229,0.4)",
                }}
              >
                {/* Top bar */}
                <div style={{ padding: "18px 20px 14px", background: "rgba(0,0,0,0.15)" }}>
                  <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "10px", fontWeight: 600, letterSpacing: "2px", textTransform: "uppercase", marginBottom: "2px" }}>
                    E-TICKET • VALID ENTRY PASS
                  </p>
                  <p style={{ color: "#fff", fontSize: "18px", fontWeight: 700 }}>
                    {event?.name || "College Induction"}
                  </p>
                </div>

                {/* Main body */}
                <div style={{ display: "flex", padding: "16px 20px", gap: "16px", alignItems: "flex-start" }}>
                  {/* Left — student & event details */}
                  <div style={{ flex: 1 }}>
                    <TicketField label="Name" value={student.name} />
                    <TicketField label="Student ID" value={student.student_id} />
                    <TicketField label="Course" value={student.course || "N/A"} />
                    <div style={{ height: "1px", background: "rgba(255,255,255,0.15)", margin: "10px 0" }} />
                    <TicketField label="Date" value={formatDate(event?.date ?? null)} />
                    <TicketField label="Time" value={event ? `${formatTime(event.start_time)}${event.end_time ? ` – ${formatTime(event.end_time)}` : ""}` : "TBA"} />
                    <TicketField label="Venue" value={event?.venue || "TBA"} />
                    {event?.attire && <TicketField label="Attire" value={event.attire} />}
                  </div>

                  {/* Dashed divider */}
                  <div style={{ width: "1px", alignSelf: "stretch", borderLeft: "2px dashed rgba(255,255,255,0.25)", flexShrink: 0 }} />

                  {/* Right — QR Code */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                    {qrDataUrl ? (
                      <div style={{ background: "#fff", borderRadius: "12px", padding: "8px", boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={qrDataUrl} alt="QR Code" width={110} height={110} style={{ display: "block", borderRadius: "6px" }} />
                      </div>
                    ) : (
                      <div style={{ width: 126, height: 126, background: "rgba(255,255,255,0.1)", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "11px" }}>Loading QR…</span>
                      </div>
                    )}
                    <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "9px", fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase" }}>
                      Scan to Verify
                    </p>
                  </div>
                </div>

                {/* Footer */}
                <div style={{ background: "rgba(0,0,0,0.2)", padding: "10px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "9px", fontFamily: "monospace", letterSpacing: "1px" }}>
                    {ticket.ticket_id}
                  </span>
                  <span style={{ background: "#10b981", color: "#fff", fontSize: "9px", fontWeight: 700, padding: "2px 8px", borderRadius: "20px", letterSpacing: "1px" }}>
                    ● ACTIVE
                  </span>
                </div>
              </div>
            </div>

            {/* Download PDF button */}
            <Card glass className="animate-fadeInUp-delay">
              <Button size="lg" className="w-full" onClick={handleDownload} loading={downloading}>
                📥 Download as PDF
              </Button>
              {ticket.downloaded_at && (
                <p className="text-xs text-slate-400 text-center mt-2">
                  Last downloaded: {new Date(ticket.downloaded_at).toLocaleString("en-IN")}
                </p>
              )}
            </Card>
          </>
        )}

        {/* ── Used ticket ── */}
        {ticket?.status === "USED" && (
          <Card glass className="animate-fadeInUp text-center py-6">
            <Badge variant="used" className="mb-3">TICKET USED</Badge>
            <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-3">
              <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="font-bold text-slate-900 mb-1">Entry Verified ✓</h3>
            <p className="text-xs text-slate-400 font-mono mb-1">{ticket.ticket_id}</p>
            <p className="text-sm text-slate-500">
              Used on {ticket.used_at ? new Date(ticket.used_at).toLocaleString("en-IN") : "N/A"}
            </p>
          </Card>
        )}

        {/* ── Cancelled ticket ── */}
        {ticket?.status === "CANCELLED" && (
          <Card glass className="animate-fadeInUp text-center py-6">
            <Badge variant="cancelled" className="mb-3">CANCELLED</Badge>
            <h3 className="font-bold text-slate-900 mb-1">Ticket Cancelled</h3>
            <p className="text-sm text-slate-500">Please contact administration.</p>
          </Card>
        )}

        {/* Event details card */}
        {event && (
          <Card glass className="animate-fadeInUp-delay">
            <h2 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wider">Event Details</h2>
            <div className="space-y-2.5">
              <InfoRow icon="📅" label="Date" value={formatDate(event.date)} />
              <InfoRow icon="🕐" label="Time" value={`${formatTime(event.start_time)}${event.end_time ? ` — ${formatTime(event.end_time)}` : ""}`} />
              <InfoRow icon="📍" label="Venue" value={event.venue || "TBA"} />
              {event.attire && <InfoRow icon="👔" label="Attire" value={event.attire} />}
              {event.instructions && (
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">📋 Instructions</p>
                  <p className="text-sm text-slate-700 whitespace-pre-line">{event.instructions}</p>
                </div>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function TicketField({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: "8px" }}>
      <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "9px", fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase", marginBottom: "1px" }}>
        {label}
      </p>
      <p style={{ color: "#ffffff", fontSize: "12px", fontWeight: 600 }}>{value}</p>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-base">{icon}</span>
      <div>
        <p className="text-xs text-slate-400 font-medium">{label}</p>
        <p className="text-sm font-medium text-slate-800">{value}</p>
      </div>
    </div>
  );
}
