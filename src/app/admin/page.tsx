"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { PageSpinner } from "@/components/ui/spinner";
import type { DashboardStats } from "@/lib/types";

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageSpinner />;

  const cards = [
    {
      label: "Eligible Students",
      value: stats?.eligible ?? 0,
      icon: "👥",
      color: "bg-blue-50 text-blue-600",
    },
    {
      label: "Tickets Generated",
      value: stats?.generated ?? 0,
      icon: "🎫",
      color: "bg-violet-50 text-violet-600",
    },
    {
      label: "Tickets Downloaded",
      value: stats?.downloaded ?? 0,
      icon: "📥",
      color: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "Tickets Used",
      value: stats?.used ?? 0,
      icon: "✅",
      color: "bg-amber-50 text-amber-600",
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">
          Overview of your e-ticket system
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {cards.map((card) => (
          <Card key={card.label} className="flex items-center gap-4">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${card.color}`}
            >
              {card.icon}
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{card.value}</p>
              <p className="text-sm text-slate-500">{card.label}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
