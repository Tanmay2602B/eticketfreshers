"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { PageSpinner } from "@/components/ui/spinner";

export default function TicketControlPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Local form state
  const [ticketLive, setTicketLive] = useState(false);
  const [openAt, setOpenAt] = useState("");
  const [closeAt, setCloseAt] = useState("");

  const [ticketAvailable, setTicketAvailable] = useState(false);

  useEffect(() => {
    fetch("/api/admin/event")
      .then((r) => r.json())
      .then((data) => {
        if (data.event) {
          setTicketLive(data.event.ticket_live || false);
          setOpenAt(
            data.event.ticket_open_at
              ? new Date(data.event.ticket_open_at).toISOString().slice(0, 16)
              : ""
          );
          setCloseAt(
            data.event.ticket_close_at
              ? new Date(data.event.ticket_close_at).toISOString().slice(0, 16)
              : ""
          );
        }
        // ticketAvailable = what students actually see right now
        setTicketAvailable(data.ticketAvailable || false);
      })
      .catch(() => setMessage({ type: "error", text: "Failed to load." }))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/ticket-control", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticket_live: ticketLive,
          ticket_open_at: openAt ? new Date(openAt).toISOString() : null,
          ticket_close_at: closeAt ? new Date(closeAt).toISOString() : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Failed to save." });
        return;
      }

      // Re-fetch to get updated ticketAvailable
      const updated = await fetch("/api/admin/event").then((r) => r.json());
      setTicketAvailable(updated.ticketAvailable || false);
      setMessage({ type: "success", text: "Ticket control updated successfully!" });
    } catch {
      setMessage({ type: "error", text: "Network error." });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <PageSpinner />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Ticket Control</h1>
        <p className="text-sm text-slate-500 mt-1">
          Control when students can access their e-tickets
        </p>
      </div>

      {message && (
        <Alert
          variant={message.type}
          className="mb-4"
          onDismiss={() => setMessage(null)}
        >
          {message.text}
        </Alert>
      )}

      {/* Status Card — shows REAL student-facing status */}
      <Card className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Student-Facing Status</CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              {ticketAvailable
                ? "✅ Students CAN see and generate their tickets RIGHT NOW"
                : ticketLive
                ? "⏳ Toggle is ON but outside the schedule window — students see Offline"
                : "🔒 Students see \"Ticket System Offline\""}
            </p>
          </div>
          <Badge variant={ticketAvailable ? "live" : "offline"}>
            {ticketAvailable ? "LIVE" : "OFFLINE"}
          </Badge>
        </div>
        {ticketLive && !ticketAvailable && (
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
            ⚠️ The toggle is ON but the current time is outside the access window you set.
            Students still see the system as offline. Adjust the schedule or clear it to go live.
          </div>
        )}
      </Card>

      {/* Controls */}
      <Card>
        <div className="space-y-6">
          {/* Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900">
                E-Ticket System
              </p>
              <p className="text-sm text-slate-500">
                Turn ON to allow eligible students to access tickets
              </p>
            </div>
            <button
              onClick={() => setTicketLive(!ticketLive)}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 ${
                ticketLive ? "bg-primary-600" : "bg-slate-300"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-300 ${
                  ticketLive ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Time window */}
          <div className="border-t border-slate-100 pt-6">
            <p className="font-medium text-slate-900 mb-1">
              Access Window (Optional)
            </p>
            <p className="text-sm text-slate-500 mb-4">
              Set optional opening and closing times for ticket access
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Opens At"
                type="datetime-local"
                value={openAt}
                onChange={(e) => setOpenAt(e.target.value)}
                helperText="Leave empty for immediate access"
              />
              <Input
                label="Closes At"
                type="datetime-local"
                value={closeAt}
                onChange={(e) => setCloseAt(e.target.value)}
                helperText="Leave empty for no closing time"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} loading={saving}>
              Save Ticket Control
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
