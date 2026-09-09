"use client";

import { useEffect, useState, useCallback } from "react";
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
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/student/dashboard")
      .then((r) => {
        if (r.status === 401) {
          router.push("/");
          return null;
        }
        return r.json();
      })
      .then((d) => {
        if (d) setData(d);
      })
      .catch(() => setError("Failed to load dashboard data."))
      .finally(() => setLoading(false));
  }, [router]);

  const handleDownload = useCallback(async () => {
    if (!data?.ticket || !data?.event || !data?.student) return;
    setDownloading(true);
    setError("");

    try {
      // Dynamically import PDF generator to keep bundle small
      const { generateTicketPDF } = await import(
        "@/components/student/ticket-pdf"
      );
      await generateTicketPDF(data.event, data.student, data.ticket);

      // Mark as downloaded
      await fetch("/api/student/ticket", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket_id: data.ticket.id }),
      });

      // Refresh data
      const res = await fetch("/api/student/dashboard");
      if (res.ok) {
        const refreshed = await res.json();
        setData(refreshed);
      }
    } catch {
      setError("Failed to generate ticket. Please try again.");
    } finally {
      setDownloading(false);
    }
  }, [data]);

  const handleGenerateTicket = useCallback(async () => {
    setDownloading(true);
    setError("");

    try {
      const res = await fetch("/api/student/ticket", { method: "POST" });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || "Failed to generate ticket.");
        return;
      }

      // Refresh dashboard data
      const dashRes = await fetch("/api/student/dashboard");
      if (dashRes.ok) {
        const refreshed = await dashRes.json();
        setData(refreshed);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setDownloading(false);
    }
  }, []);

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
          <Button onClick={() => router.push("/")} variant="secondary">
            Go to Login
          </Button>
        </Card>
      </div>
    );
  }

  const { student, event, ticket, ticketAvailable } = data;

  return (
    <div className="min-h-screen pb-8">
      {/* Header */}
      <div className="gradient-hero">
        <div className="max-w-lg mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-bold text-white">My Dashboard</h1>
            <button
              onClick={handleLogout}
              className="text-white/70 hover:text-white text-sm font-medium transition-colors"
            >
              Logout
            </button>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
            <p className="text-white font-semibold text-lg">{student.name}</p>
            <p className="text-white/70 text-sm">
              {student.student_id} • {student.course || "N/A"}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-6 -mt-4 space-y-4">
        {error && (
          <Alert variant="error" onDismiss={() => setError("")}>
            {error}
          </Alert>
        )}

        {/* Event Details */}
        {event && (
          <Card glass className="animate-fadeInUp">
            <h2 className="text-base font-bold text-slate-900 mb-3">
              {event.name}
            </h2>
            <div className="space-y-2.5">
              <InfoRow icon="📅" label="Date" value={formatDate(event.date)} />
              <InfoRow
                icon="🕐"
                label="Time"
                value={`${formatTime(event.start_time)} ${event.end_time ? `— ${formatTime(event.end_time)}` : ""}`}
              />
              <InfoRow icon="📍" label="Venue" value={event.venue || "TBA"} />
              {event.attire && (
                <InfoRow icon="👔" label="Attire" value={event.attire} />
              )}
              {event.instructions && (
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    📋 Instructions
                  </p>
                  <p className="text-sm text-slate-700 whitespace-pre-line">
                    {event.instructions}
                  </p>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Ticket Card */}
        <Card
          glass
          className={`animate-fadeInUp-delay ${ticket?.status === "ACTIVE" ? "animate-pulse-glow" : ""}`}
        >
          <div className="text-center">
            {!ticketAvailable ? (
              // Ticket system not live
              <>
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="font-bold text-slate-900 mb-1">
                  Ticket Not Available
                </h3>
                <p className="text-sm text-slate-500">
                  The e-ticket system is currently closed. Please check back
                  later.
                </p>
              </>
            ) : !ticket ? (
              // Eligible but ticket not yet generated
              <>
                <div className="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                  </svg>
                </div>
                <h3 className="font-bold text-slate-900 mb-1">
                  Your E-Ticket is Ready!
                </h3>
                <p className="text-sm text-slate-500 mb-4">
                  Click below to generate your entry pass.
                </p>
                <Button
                  size="lg"
                  className="w-full"
                  onClick={handleGenerateTicket}
                  loading={downloading}
                >
                  Generate E-Ticket
                </Button>
              </>
            ) : ticket.status === "ACTIVE" ? (
              // Ticket generated, ready to download
              <>
                <Badge variant="active" className="mb-3">
                  ACTIVE TICKET
                </Badge>
                <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="font-bold text-slate-900 mb-1">
                  Your E-Ticket is Ready!
                </h3>
                <p className="text-xs text-slate-400 mb-1 font-mono">
                  {ticket.ticket_id}
                </p>
                <p className="text-sm text-slate-500 mb-4">
                  Download your premium entry pass with QR code.
                </p>
                <Button
                  size="lg"
                  className="w-full"
                  onClick={handleDownload}
                  loading={downloading}
                >
                  📥 Download E-Ticket PDF
                </Button>
                {ticket.downloaded_at && (
                  <p className="text-xs text-slate-400 mt-2">
                    Last downloaded:{" "}
                    {new Date(ticket.downloaded_at).toLocaleString("en-IN")}
                  </p>
                )}
              </>
            ) : ticket.status === "USED" ? (
              // Ticket already used
              <>
                <Badge variant="used" className="mb-3">
                  TICKET USED
                </Badge>
                <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="font-bold text-slate-900 mb-1">
                  Entry Verified
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  {ticket.ticket_id}
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  Your ticket was used on{" "}
                  {ticket.used_at
                    ? new Date(ticket.used_at).toLocaleString("en-IN")
                    : "N/A"}
                </p>
              </>
            ) : (
              // Cancelled
              <>
                <Badge variant="cancelled" className="mb-3">
                  CANCELLED
                </Badge>
                <h3 className="font-bold text-slate-900 mb-1">
                  Ticket Cancelled
                </h3>
                <p className="text-sm text-slate-500">
                  This ticket has been cancelled. Please contact administration.
                </p>
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
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
