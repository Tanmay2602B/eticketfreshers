"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageSpinner } from "@/components/ui/spinner";
import type { EventRow } from "@/lib/types";
import { formatDate, formatTime } from "@/lib/utils";

export default function LandingPage() {
  const [event, setEvent] = useState<EventRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [ticketAvailable, setTicketAvailable] = useState(false);

  useEffect(() => {
    fetch("/api/admin/event")
      .then((r) => r.json())
      .then((data) => {
        if (data.event) {
          setEvent(data.event);
          setTicketAvailable(data.ticketAvailable ?? false);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageSpinner />;

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="gradient-hero relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/5 rounded-full" />
          <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-white/5 rounded-full" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/[0.02] rounded-full" />
        </div>

        <div className="relative max-w-lg mx-auto px-6 pt-12 pb-16 text-center">
          {/* Event Logo/Badge */}
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-white/90 text-sm font-medium">
              College Induction 2026
            </span>
          </div>

          {/* Event Name */}
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4 leading-tight">
            {event?.name || "College Induction Ceremony"}
          </h1>

          {/* Event Description */}
          {event?.description && (
            <p className="text-white/80 text-base mb-8 max-w-md mx-auto leading-relaxed">
              {event.description}
            </p>
          )}

          {/* Event Quick Info */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
            {event?.date && (
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2">
                <svg className="w-4 h-4 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-white/90 text-sm font-medium">
                  {formatDate(event.date)}
                </span>
              </div>
            )}
            {event?.venue && (
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2">
                <svg className="w-4 h-4 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-white/90 text-sm font-medium">
                  {event.venue}
                </span>
              </div>
            )}
          </div>

          {/* Time */}
          {(event?.start_time || event?.end_time) && (
            <p className="text-white/70 text-sm mb-8">
              🕐 {formatTime(event?.start_time ?? null)}
              {event?.end_time && ` — ${formatTime(event.end_time)}`}
            </p>
          )}
        </div>
      </div>

      {/* CTA Section */}
      <div className="max-w-lg mx-auto px-6 -mt-6">
        <div className="glass-card rounded-2xl p-6 text-center animate-fadeInUp">
          {ticketAvailable ? (
            <>
              <div className="w-14 h-14 rounded-2xl bg-primary-50 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">
                E-Tickets are Live!
              </h2>
              <p className="text-slate-500 text-sm mb-6">
                Get your digital entry pass now. Quick, secure, and paperless.
              </p>
              <Link href="/login">
                <Button size="lg" className="w-full">
                  Get My Ticket →
                </Button>
              </Link>
            </>
          ) : (
            <>
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">
                Tickets Not Available Yet
              </h2>
              <p className="text-slate-500 text-sm">
                The e-ticket system is currently closed. Please check back later
                or contact your college administration.
              </p>
            </>
          )}
        </div>

        {/* Event Details Cards */}
        {event && (
          <div className="mt-6 space-y-4 animate-fadeInUp-delay pb-12">
            {event.attire && (
              <div className="glass-card rounded-xl p-4 flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                  <span className="text-lg">👔</span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Dress Code
                  </p>
                  <p className="text-sm text-slate-700">{event.attire}</p>
                </div>
              </div>
            )}

            {event.instructions && (
              <div className="glass-card rounded-xl p-4 flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                  <span className="text-lg">📋</span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Important Instructions
                  </p>
                  <p className="text-sm text-slate-700 whitespace-pre-line">
                    {event.instructions}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
