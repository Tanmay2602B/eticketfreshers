"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import type { UploadRow, UploadSummary } from "@/lib/types";

// ============================================================
// Types
// ============================================================

interface StudentRecord {
  id: string;
  name: string;
  email: string;
  student_id: string;
  course: string | null;
  mobile: string | null;
  imported_at: string;
  ticket_status: "ACTIVE" | "USED" | "CANCELLED" | null;
  ticket_id: string | null;
  ticket_generated: string | null;
  ticket_downloaded: string | null;
  ticket_used_at: string | null;
  scanned: boolean;
}

type FilterStatus = "all" | "no_ticket" | "active" | "used" | "cancelled" | "scanned" | "not_scanned";

// ============================================================
// Helpers
// ============================================================

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ticketBadge(student: StudentRecord) {
  if (!student.ticket_status) {
    return <Badge variant="offline">No Ticket</Badge>;
  }
  if (student.ticket_status === "ACTIVE") {
    return <Badge variant="active">Active</Badge>;
  }
  if (student.ticket_status === "USED") {
    return <Badge variant="used">Used</Badge>;
  }
  return <Badge variant="cancelled">Cancelled</Badge>;
}

function scanBadge(student: StudentRecord) {
  if (!student.ticket_status) return null;
  if (student.scanned) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        Scanned
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5">
      Not Scanned
    </span>
  );
}

// ============================================================
// Main Component
// ============================================================

export default function UploadPage() {
  // --- Upload state ---
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<UploadRow[]>([]);
  const [parseError, setParseError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [summary, setSummary] = useState<UploadSummary | null>(null);
  const [uploadError, setUploadError] = useState("");

  // --- Student list state ---
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [filterCourse, setFilterCourse] = useState("all");

  // --- Emergency download state ---
  const [emergencyDownloading, setEmergencyDownloading] = useState<string | null>(null);
  const [emergencyError, setEmergencyError] = useState("");
  const [emergencySuccess, setEmergencySuccess] = useState("");

  // ----------------------------------------------------------------
  // Load student list
  // ----------------------------------------------------------------
  const loadStudents = useCallback(async () => {
    setLoadingStudents(true);
    try {
      const res = await fetch("/api/admin/students");
      if (res.ok) {
        const data = await res.json();
        setStudents(data.students || []);
      }
    } catch {
      // silent
    } finally {
      setLoadingStudents(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/students")
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setStudents(data.students || []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingStudents(false); });
    return () => { cancelled = true; };
  }, []);

  // ----------------------------------------------------------------
  // Template download
  // ----------------------------------------------------------------
  function handleTemplateDownload() {
    const csv = "name,email,student_id,course,mobile\nJohn Doe,john@college.edu,CS2024001,B.Tech CSE,9876543210\nJane Smith,jane@college.edu,CS2024002,B.Tech ECE,9876543211\n";
    downloadCSV(csv, "student_upload_template.csv");
  }

  // ----------------------------------------------------------------
  // File parsing
  // ----------------------------------------------------------------
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setParseError("");
    setSummary(null);
    setUploadError("");
    setRows([]);
    setFileName(file.name);

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "csv" && ext !== "xlsx" && ext !== "xls") {
      setParseError("Please upload a CSV or XLSX file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(
          worksheet,
          { defval: "" }
        );

        if (jsonData.length === 0) {
          setParseError("The file appears to be empty.");
          return;
        }

        const normalizedData = jsonData.map((row) => {
          const normalizedRow: Record<string, string> = {};
          for (const [key, value] of Object.entries(row)) {
            normalizedRow[key.toLowerCase().trim().replace(/\s+/g, "_")] =
              String(value).trim();
          }
          return normalizedRow;
        });

        const firstRow = normalizedData[0];

        const studentIdAliases = [
          "student_id", "studentid", "roll_no", "roll_number", "rollno",
          "enrollment_no", "enrollment_number", "enrollmentno", "enroll_no",
          "id", "reg_no", "registration_no", "registrationno", "regno",
          "admission_no", "admissionno", "usn", "prn",
        ];
        const studentIdKey = studentIdAliases.find((alias) => alias in firstRow) ?? null;

        const missingColumns = [
          ...("name" in firstRow ? [] : ["name"]),
          ...("email" in firstRow ? [] : ["email"]),
          ...(studentIdKey ? [] : ["student_id"]),
        ];

        if (missingColumns.length > 0) {
          setParseError(
            `Missing required columns: ${missingColumns.join(", ")}. Found columns: ${Object.keys(firstRow).join(", ")}`
          );
          return;
        }

        const parsedRows: UploadRow[] = normalizedData
          .map((row) => ({
            name: row.name || "",
            email: row.email || "",
            student_id: studentIdKey ? (row[studentIdKey] || "") : "",
            course: row.course || undefined,
            mobile: row.mobile || row.phone || row.mobile_number || undefined,
          }))
          .filter((r) => r.name && r.email && r.student_id);

        setRows(parsedRows);
      } catch (err) {
        console.error("Parse error:", err);
        setParseError("Failed to parse file. Please check the format.");
      }
    };

    reader.readAsBinaryString(file);
  }

  // ----------------------------------------------------------------
  // Upload
  // ----------------------------------------------------------------
  async function handleUpload() {
    if (rows.length === 0) return;
    setUploading(true);
    setUploadError("");
    setSummary(null);

    try {
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });

      const data = await res.json();

      if (!res.ok) {
        setUploadError(data.error || "Upload failed.");
        if (data.summary) setSummary(data.summary);
        return;
      }

      setSummary(data.summary);
      handleReset();
      loadStudents(); // Refresh student list after upload
    } catch {
      setUploadError("Network error. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  function handleReset() {
    setFileName("");
    setRows([]);
    setParseError("");
    setUploadError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ----------------------------------------------------------------
  // Filter + search logic
  // ----------------------------------------------------------------
  const courses = Array.from(
    new Set(students.map((s) => s.course).filter(Boolean) as string[])
  ).sort();

  const filtered = students.filter((s) => {
    // Search
    const q = search.toLowerCase();
    if (
      q &&
      !s.name.toLowerCase().includes(q) &&
      !s.email.toLowerCase().includes(q) &&
      !s.student_id.toLowerCase().includes(q)
    ) {
      return false;
    }

    // Course filter
    if (filterCourse !== "all" && s.course !== filterCourse) return false;

    // Status filter
    switch (filterStatus) {
      case "no_ticket":    return !s.ticket_status;
      case "active":       return s.ticket_status === "ACTIVE";
      case "used":         return s.ticket_status === "USED";
      case "cancelled":    return s.ticket_status === "CANCELLED";
      case "scanned":      return s.scanned;
      case "not_scanned":  return !!s.ticket_status && !s.scanned;
      default:             return true;
    }
  });

  // Summary counts for filter pills
  const counts = {
    all: students.length,
    no_ticket: students.filter((s) => !s.ticket_status).length,
    active: students.filter((s) => s.ticket_status === "ACTIVE").length,
    used: students.filter((s) => s.ticket_status === "USED").length,
    cancelled: students.filter((s) => s.ticket_status === "CANCELLED").length,
    scanned: students.filter((s) => s.scanned).length,
    not_scanned: students.filter((s) => !!s.ticket_status && !s.scanned).length,
  };

  // ----------------------------------------------------------------
  // Export filtered list
  // ----------------------------------------------------------------
  function handleExport() {
    const headers = ["Name", "Email", "Student ID", "Course", "Mobile", "Ticket Status", "Ticket ID", "Scanned"];
    const rows = filtered.map((s) => [
      s.name,
      s.email,
      s.student_id,
      s.course || "",
      s.mobile || "",
      s.ticket_status || "No Ticket",
      s.ticket_id || "",
      s.scanned ? "Yes" : "No",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    downloadCSV(csv, `students_export_${new Date().toISOString().slice(0, 10)}.csv`);
  }

  // ----------------------------------------------------------------
  // Emergency ticket download (admin generates + downloads PDF for student)
  // ----------------------------------------------------------------
  async function handleEmergencyDownload(studentId: string) {
    setEmergencyDownloading(studentId);
    setEmergencyError("");
    setEmergencySuccess("");

    try {
      // 1. Generate (or retrieve existing) ticket via admin API
      const res = await fetch("/api/admin/ticket-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: studentId }),
      });

      if (!res.ok) {
        const data = await res.json();
        setEmergencyError(data.error || "Failed to generate ticket.");
        return;
      }

      const { ticket, student, event } = await res.json();

      // 2. Generate PDF client-side
      const { generateTicketPDF } = await import("@/components/student/ticket-pdf");
      await generateTicketPDF(event, student, ticket);

      setEmergencySuccess(`Ticket downloaded for ${student.name}`);

      // 3. Refresh student list to reflect new ticket status
      loadStudents();
    } catch {
      setEmergencyError("Failed to download ticket. Please try again.");
    } finally {
      setEmergencyDownloading(null);
    }
  }

  // ================================================================
  // Render
  // ================================================================
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Student Data</h1>
        <p className="text-sm text-slate-500 mt-1">
          Upload eligible students and track ticket &amp; entry status
        </p>
      </div>

      {/* ── Upload + Template row ── */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <CardTitle>Import Students</CardTitle>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleTemplateDownload}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download Template
          </Button>
        </div>

        {/* Drop zone */}
        <div
          className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-primary-300 transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          {fileName ? (
            <p className="text-sm font-medium text-slate-900">{fileName}</p>
          ) : (
            <>
              <p className="text-sm font-medium text-slate-900">Click to upload CSV or XLSX</p>
              <p className="text-xs text-slate-400 mt-1">
                Required: name, email, student_id (or roll_no, enrollment_no, usn, prn…)
              </p>
              <p className="text-xs text-slate-400">Optional: course, mobile</p>
            </>
          )}
        </div>

        {/* Explicit Upload button — separate from the drop zone */}
        {!fileName && (
          <div className="mt-4 flex justify-center">
            <Button
              variant="primary"
              size="md"
              onClick={() => fileInputRef.current?.click()}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Select File to Upload
            </Button>
          </div>
        )}

        {/* Parse error */}
        {parseError && (
          <Alert variant="error" className="mt-4">
            {parseError}
          </Alert>
        )}

        {/* Preview table */}
        {rows.length > 0 && (
          <div className="mt-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-slate-700">
                Preview — {rows.length} students ready to import
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={handleReset}>
                  Clear
                </Button>
                <Button size="sm" onClick={handleUpload} loading={uploading}>
                  Upload &amp; Import
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {["Name", "Email", "Student ID", "Course", "Mobile"].map((h) => (
                      <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 10).map((row, i) => (
                    <tr key={i} className="border-t border-slate-50 hover:bg-slate-50">
                      <td className="py-2 px-3 text-slate-800">{row.name}</td>
                      <td className="py-2 px-3 text-slate-600">{row.email}</td>
                      <td className="py-2 px-3 text-slate-600">{row.student_id}</td>
                      <td className="py-2 px-3 text-slate-500">{row.course || "—"}</td>
                      <td className="py-2 px-3 text-slate-500">{row.mobile || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 10 && (
                <p className="text-xs text-slate-400 p-3 text-center">
                  …and {rows.length - 10} more students
                </p>
              )}
            </div>
          </div>
        )}

        {/* Upload error */}
        {uploadError && (
          <Alert variant="error" className="mt-4">
            {uploadError}
          </Alert>
        )}
      </Card>

      {/* Upload summary */}
      {summary && (
        <Card>
          <CardTitle className="mb-4">Upload Summary</CardTitle>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            {[
              { label: "Total Rows", value: summary.total, cls: "bg-slate-50 text-slate-900" },
              { label: "Imported", value: summary.imported, cls: "bg-emerald-50 text-emerald-600" },
              { label: "Duplicates Removed", value: summary.duplicatesRemoved, cls: "bg-amber-50 text-amber-600" },
              { label: "Errors", value: summary.errors.length, cls: "bg-red-50 text-red-600" },
            ].map((c) => (
              <div key={c.label} className={`text-center p-3 rounded-xl ${c.cls.split(" ")[0]}`}>
                <p className={`text-xl font-bold ${c.cls.split(" ")[1]}`}>{c.value}</p>
                <p className="text-xs text-slate-500">{c.label}</p>
              </div>
            ))}
          </div>
          {summary.errors.length > 0 && (
            <div className="bg-red-50 rounded-xl p-3 max-h-40 overflow-y-auto">
              {summary.errors.map((err, i) => (
                <p key={i} className="text-xs text-red-600 py-0.5">{err}</p>
              ))}
            </div>
          )}
          <div className="mt-4">
            <Button variant="secondary" size="sm" onClick={() => setSummary(null)}>
              Dismiss
            </Button>
          </div>
        </Card>
      )}

      {/* Emergency download feedback */}
      {emergencyError && (
        <Alert variant="error" onDismiss={() => setEmergencyError("")}>
          {emergencyError}
        </Alert>
      )}
      {emergencySuccess && (
        <Alert variant="success" onDismiss={() => setEmergencySuccess("")}>
          {emergencySuccess}
        </Alert>
      )}

      {/* ── Student List ── */}
      <Card>
        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <CardTitle>Student List</CardTitle>
            <p className="text-xs text-slate-400 mt-0.5">
              {loadingStudents ? "Loading…" : `${filtered.length} of ${students.length} students`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={loadStudents}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </Button>
            {filtered.length > 0 && (
              <Button variant="secondary" size="sm" onClick={handleExport}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export CSV
              </Button>
            )}
          </div>
        </div>

        {/* Search + filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          {/* Search */}
          <div className="flex-1">
            <Input
              placeholder="Search name, email or student ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {/* Course filter */}
          {courses.length > 0 && (
            <select
              value={filterCourse}
              onChange={(e) => setFilterCourse(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 focus:outline-none"
            >
              <option value="all">All Courses</option>
              {courses.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
        </div>

        {/* Filter pills */}
        <div className="flex flex-wrap gap-2 mb-5">
          {(
            [
              { key: "all",         label: "All" },
              { key: "no_ticket",   label: "No Ticket" },
              { key: "active",      label: "Active" },
              { key: "used",        label: "Used" },
              { key: "cancelled",   label: "Cancelled" },
              { key: "scanned",     label: "✅ Scanned" },
              { key: "not_scanned", label: "⏳ Not Scanned" },
            ] as { key: FilterStatus; label: string }[]
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilterStatus(key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                filterStatus === key
                  ? "bg-primary-600 text-white border-primary-600"
                  : "bg-white text-slate-600 border-slate-200 hover:border-primary-300 hover:text-primary-600"
              }`}
            >
              {label}
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                filterStatus === key ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
              }`}>
                {counts[key]}
              </span>
            </button>
          ))}
        </div>

        {/* Table */}
        {loadingStudents ? (
          <div className="text-center py-12 text-slate-400">
            <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-2" />
            <p className="text-sm">Loading students…</p>
          </div>
        ) : students.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-sm font-medium">No students imported yet</p>
            <p className="text-xs mt-1">Upload a CSV or XLSX file above to get started</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <p className="text-sm">No students match your search or filter.</p>
            <button
              onClick={() => { setSearch(""); setFilterStatus("all"); setFilterCourse("all"); }}
              className="text-xs text-primary-600 hover:underline mt-1"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-sm min-w-[800px]">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">Student ID</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Course</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">Ticket</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">Entry Scan</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">Emergency</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((student) => (
                  <tr
                    key={student.id}
                    className="border-t border-slate-50 hover:bg-slate-50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-900">{student.name}</p>
                      <p className="text-xs text-slate-400">{student.email}</p>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-600">
                      {student.student_id}
                    </td>
                    <td className="py-3 px-4 text-slate-500 hidden sm:table-cell">
                      {student.course || "—"}
                    </td>
                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        {ticketBadge(student)}
                        {student.ticket_id && (
                          <p className="text-xs font-mono text-slate-400">{student.ticket_id}</p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {scanBadge(student)}
                      {student.ticket_used_at && (
                        <p className="text-xs text-slate-400 mt-1">
                          {new Date(student.ticket_used_at).toLocaleString("en-IN")}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleEmergencyDownload(student.id)}
                        disabled={emergencyDownloading === student.id}
                        title="Emergency: Generate & download ticket PDF for this student"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 hover:border-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {emergencyDownloading === student.id ? (
                          <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        )}
                        🚨 Download
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
