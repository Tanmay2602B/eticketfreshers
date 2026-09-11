"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { PageSpinner } from "@/components/ui/spinner";
import type { EventRow } from "@/lib/types";

export default function EventSettingsPage() {
  const [event, setEvent] = useState<Partial<EventRow>>({
    name: "",
    description: "",
    date: "",
    start_time: "",
    end_time: "",
    venue: "",
    attire: "",
    attire_boys: "",
    attire_girls: "",
    instructions: "",
    banner_url: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/admin/event")
      .then((r) => r.json())
      .then((data) => {
        if (data.event) {
          setEvent(data.event);
        }
      })
      .catch(() => setMessage({ type: "error", text: "Failed to load event." }))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/event", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event),
      });

      if (!res.ok) {
        const data = await res.json();
        setMessage({
          type: "error",
          text: data.error || "Failed to save.",
        });
        return;
      }

      setMessage({ type: "success", text: "Event settings saved successfully!" });
    } catch {
      setMessage({ type: "error", text: "Network error." });
    } finally {
      setSaving(false);
    }
  }

  function updateField(field: string, value: string) {
    setEvent((prev) => ({ ...prev, [field]: value }));
  }

  if (loading) return <PageSpinner />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Event Settings</h1>
        <p className="text-sm text-slate-500 mt-1">
          Configure your induction event details
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

      <Card>
        <form onSubmit={handleSave} className="space-y-5">
          <Input
            label="Event Name"
            value={event.name || ""}
            onChange={(e) => updateField("name", e.target.value)}
            required
            placeholder="College Induction 2026"
          />

          <Textarea
            label="Description"
            value={event.description || ""}
            onChange={(e) => updateField("description", e.target.value)}
            placeholder="Welcome to our annual induction ceremony..."
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Date"
              type="date"
              value={event.date || ""}
              onChange={(e) => updateField("date", e.target.value)}
            />
            <Input
              label="Start Time"
              type="time"
              value={event.start_time || ""}
              onChange={(e) => updateField("start_time", e.target.value)}
            />
            <Input
              label="End Time"
              type="time"
              value={event.end_time || ""}
              onChange={(e) => updateField("end_time", e.target.value)}
            />
          </div>

          <Input
            label="Venue"
            value={event.venue || ""}
            onChange={(e) => updateField("venue", e.target.value)}
            placeholder="Main Auditorium"
          />

          {/* Attire — gender-specific */}
          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-1">Dress Code / Attire</p>
              <p className="text-xs text-slate-400">
                Set separate attire guidelines for boys and girls. Each will only appear on the student site once filled in.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="relative">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-base">👔</span>
                  <label className="text-sm font-medium text-slate-700">Boys Attire</label>
                </div>
                <input
                  type="text"
                  value={event.attire_boys || ""}
                  onChange={(e) => updateField("attire_boys", e.target.value)}
                  placeholder="e.g. Formal shirt, trousers & shoes"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 focus:outline-none transition-shadow"
                />
                <p className="text-xs text-slate-400 mt-1">
                  {event.attire_boys ? "✅ Will be shown on student site" : "Leave blank to hide from students"}
                </p>
              </div>
              <div className="relative">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-base">👗</span>
                  <label className="text-sm font-medium text-slate-700">Girls Attire</label>
                </div>
                <input
                  type="text"
                  value={event.attire_girls || ""}
                  onChange={(e) => updateField("attire_girls", e.target.value)}
                  placeholder="e.g. Salwar kameez or saree"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 focus:outline-none transition-shadow"
                />
                <p className="text-xs text-slate-400 mt-1">
                  {event.attire_girls ? "✅ Will be shown on student site" : "Leave blank to hide from students"}
                </p>
              </div>
            </div>
          </div>

          <Textarea
            label="Important Instructions"
            value={event.instructions || ""}
            onChange={(e) => updateField("instructions", e.target.value)}
            placeholder="1. Arrive 30 minutes early&#10;2. Bring college ID&#10;3. No food/drinks inside"
          />

          <Input
            label="Banner / Logo URL"
            value={event.banner_url || ""}
            onChange={(e) => updateField("banner_url", e.target.value)}
            placeholder="https://example.com/banner.png"
            helperText="Optional: URL to your event banner image"
          />

          <div className="flex justify-end pt-2">
            <Button type="submit" loading={saving}>
              Save Event Settings
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
