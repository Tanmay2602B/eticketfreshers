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

type FilterStatus =
  | "all"
  | "no_ticket"
  | "active"
  | "used"
  | "cancelled"
  | "scanned"
  | "not_scanned";

/** A group of rows that share the same email or student_id — only one can be kept. */
interface DuplicateGroup {
  /** 'email' or 'student_id' */
  field: "email" | "student_id";
  /** The conflicting value */
  value: string;
  /** Indices into the full `allRows` array */
  indices: number[];
}

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
// Preview Modal  (with Duplicate Resolution)
// ============================================================

function PreviewModal({
  allRows,
  duplicateGroups,
  onConfirm,
  onCancel,
  uploading,
}: {
  allRows: UploadRow[];
  duplicateGroups: DuplicateGroup[];
  onConfirm: (resolvedRows: UploadRow[]) => void;
  onCancel: () => void;
  uploading: boolean;
}) {
  const [confirmed, setConfirmed] = useState(false);
  // Map: `field:value` → chosen index in allRows (or -1 = exclude all)
  const [choices, setChoices] = useState<Map<string, number>>(() => {
    const m = new Map<string, number>();
    for (const g of duplicateGroups) {
      // Default: keep the first occurrence
      m.set(`${g.field}:${g.value}`, g.indices[0]);
    }
    return m;
  });

  // Build the set of indices that are "losers" — flagged as duplicate and NOT chosen
  const excludedIndices = new Set<number>();
  for (const g of duplicateGroups) {
    const key = `${g.field}:${g.value}`;
    const chosen = choices.get(key) ?? g.indices[0];
    for (const idx of g.indices) {
      if (idx !== chosen) excludedIndices.add(idx);
    }
  }
  // Also build the set of all indices that appear in any duplicate group
  const duplicatedIndices = new Set<number>(duplicateGroups.flatMap((g) => g.indices));

  const resolvedRows = allRows.filter((_, i) => !excludedIndices.has(i));
  const validResolved = resolvedRows.filter((r) => r.name && r.email && r.student_id);
  const warningCount = resolvedRows.filter((r) => !r.course || !r.mobile).length;
  const hasDuplicates = duplicateGroups.length > 0;

  function setChoice(key: string, idx: number) {
    setChoices((prev) => new Map(prev).set(key, idx));
  }

  // Tab: "all" or "duplicates"
  const [tab, setTab] = useState<"all" | "duplicates">(hasDuplicates ? "duplicates" : "all");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Review Before Uploading</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Check all rows carefully — uploading will{" "}
              <span className="font-semibold text-red-600">replace all existing student data</span>.
            </p>
          </div>
          <button
            onClick={onCancel}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            title="Close preview"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Stats bar */}
        <div className="flex gap-4 px-6 py-3 bg-slate-50 border-b border-slate-100 flex-wrap items-center">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            <span className="text-sm font-semibold text-slate-700">{validResolved.length} will be imported</span>
          </div>
          {hasDuplicates && (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
              <span className="text-sm text-orange-700 font-medium">
                {duplicateGroups.length} duplicate conflict{duplicateGroups.length !== 1 ? "s" : ""} — resolve below
              </span>
            </div>
          )}
          {warningCount > 0 && (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
              <span className="text-sm text-slate-500">{warningCount} rows missing optional fields</span>
            </div>
          )}
          <div className="ml-auto text-sm text-slate-400">{allRows.length} total rows in file</div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-3 pb-0 border-b border-slate-100">
          {hasDuplicates && (
            <button
              onClick={() => setTab("duplicates")}
              className={`px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
                tab === "duplicates"
                  ? "border-orange-500 text-orange-700 bg-orange-50"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              ⚠️ Resolve Duplicates
              <span className="ml-1.5 text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">
                {duplicateGroups.length}
              </span>
            </button>
          )}
          <button
            onClick={() => setTab("all")}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
              tab === "all"
                ? "border-primary-500 text-primary-700 bg-primary-50"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            All Rows ({allRows.length})
          </button>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-auto px-6 py-4">

          {/* ── Duplicates tab ── */}
          {tab === "duplicates" && hasDuplicates && (
            <div className="space-y-5">
              {duplicateGroups.map((g) => {
                const key = `${g.field}:${g.value}`;
                const chosen = choices.get(key) ?? g.indices[0];
                return (
                  <div key={key} className="rounded-xl border border-orange-200 bg-orange-50/40 overflow-hidden">
                    {/* Group header */}
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-orange-50 border-b border-orange-200">
                      <svg className="w-4 h-4 text-orange-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span className="text-xs font-bold text-orange-700 uppercase tracking-wide">
                        Duplicate {g.field === "email" ? "Email" : "Student ID"}
                      </span>
                      <code className="text-xs font-mono bg-white border border-orange-200 text-orange-800 px-2 py-0.5 rounded-md ml-1">
                        {g.value}
                      </code>
                      <span className="ml-auto text-xs text-orange-600">{g.indices.length} entries — pick one to keep</span>
                    </div>

                    {/* Option rows */}
                    <div className="divide-y divide-orange-100">
                      {g.indices.map((rowIdx) => {
                        const row = allRows[rowIdx];
                        const isChosen = chosen === rowIdx;
                        const isExclude = chosen === -1;
                        return (
                          <label
                            key={rowIdx}
                            className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors ${
                              isChosen && !isExclude
                                ? "bg-emerald-50 hover:bg-emerald-50"
                                : "hover:bg-white"
                            }`}
                          >
                            <input
                              type="radio"
                              name={key}
                              value={rowIdx}
                              checked={isChosen && !isExclude}
                              onChange={() => setChoice(key, rowIdx)}
                              className="mt-1 w-4 h-4 accent-emerald-600 cursor-pointer flex-shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-sm text-slate-900">{row.name}</span>
                                <span className="text-xs text-slate-400">Row {rowIdx + 2}</span>
                                {isChosen && !isExclude && (
                                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 border border-emerald-200 rounded-full px-2 py-0.5">✓ Keep this</span>
                                )}
                              </div>
                              <div className="flex gap-4 mt-1 text-xs text-slate-500 flex-wrap">
                                <span className="truncate max-w-[200px]">{row.email}</span>
                                <span className="font-mono">{row.student_id}</span>
                                {row.course && <span>{row.course}</span>}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                      {/* Exclude-all option */}
                      <label
                        className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                          chosen === -1 ? "bg-red-50" : "hover:bg-red-50/40"
                        }`}
                      >
                        <input
                          type="radio"
                          name={key}
                          value={-1}
                          checked={chosen === -1}
                          onChange={() => setChoice(key, -1)}
                          className="w-4 h-4 accent-red-600 cursor-pointer flex-shrink-0"
                        />
                        <span className="text-sm text-red-600 font-medium">✕ Exclude all — do not import this entry</span>
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── All rows tab ── */}
          {tab === "all" && (
            <table className="w-full text-sm min-w-[600px]">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b-2 border-slate-100">
                  <th className="text-left py-2 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wide w-10">#</th>
                  <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</th>
                  <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</th>
                  <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Student ID</th>
                  <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Course</th>
                  <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Mobile</th>
                </tr>
              </thead>
              <tbody>
                {allRows.map((row, i) => {
                  const isValid = !!(row.name && row.email && row.student_id);
                  const hasMissingOptional = !row.course || !row.mobile;
                  const isDuplicated = duplicatedIndices.has(i);
                  const isExcluded = excludedIndices.has(i);
                  return (
                    <tr
                      key={i}
                      className={`border-t border-slate-50 ${
                        isExcluded
                          ? "bg-red-50 opacity-50"
                          : !isValid
                          ? "bg-red-50"
                          : isDuplicated
                          ? "bg-orange-50"
                          : hasMissingOptional
                          ? "bg-amber-50/40"
                          : "hover:bg-slate-50"
                      }`}
                    >
                      <td className="py-2 px-2 text-xs text-slate-400 font-mono">{i + 2}</td>
                      <td className="py-2 px-2">
                        {isExcluded ? (
                          <span title="Excluded — duplicate not kept" className="text-red-400 text-base">✕</span>
                        ) : !isValid ? (
                          <span title="Missing required fields" className="text-red-500 text-base">❌</span>
                        ) : isDuplicated ? (
                          <span title="Duplicate — resolve in Duplicates tab" className="text-orange-500 text-base">⚠️</span>
                        ) : hasMissingOptional ? (
                          <span title="Missing optional fields" className="text-amber-500 text-base">⚠️</span>
                        ) : (
                          <span title="All fields present" className="text-emerald-500 text-base">✅</span>
                        )}
                      </td>
                      <td className={`py-2 px-2 font-medium max-w-[160px] truncate ${isExcluded ? "text-slate-400 line-through" : "text-slate-800"}`}>{row.name || <span className="text-red-400 italic">missing</span>}</td>
                      <td className="py-2 px-2 text-slate-600 max-w-[180px] truncate">{row.email || <span className="text-red-400 italic">missing</span>}</td>
                      <td className="py-2 px-2 font-mono text-xs text-slate-600">{row.student_id || <span className="text-red-400 italic">missing</span>}</td>
                      <td className="py-2 px-2 text-slate-500">{row.course || <span className="text-slate-300">—</span>}</td>
                      <td className="py-2 px-2 text-slate-500">{row.mobile || <span className="text-slate-300">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer — confirmation + actions */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl space-y-3">
          {hasDuplicates && (
            <div className="flex items-center gap-2 text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>
                <strong>{excludedIndices.size} row{excludedIndices.size !== 1 ? "s" : ""}</strong> will be excluded based on your duplicate choices.
                Use the <strong>Resolve Duplicates</strong> tab to change selections.
              </span>
            </div>
          )}

          {/* Replace-all warning + confirmation checkbox */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-red-600 cursor-pointer rounded"
              id="preview-confirm-checkbox"
            />
            <span className="text-sm text-slate-700 select-none group-hover:text-slate-900 transition-colors">
              I understand that uploading will{" "}
              <span className="font-semibold text-red-600">permanently replace all existing student records</span>{" "}
              with the{" "}<strong>{validResolved.length}</strong> resolved rows above.
            </span>
          </label>

          <div className="flex gap-3 justify-end">
            <Button variant="ghost" size="sm" onClick={onCancel} disabled={uploading}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => onConfirm(resolvedRows)}
              loading={uploading}
              disabled={!confirmed || validResolved.length === 0}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Upload & Replace All ({validResolved.length} students)
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Delete Confirmation Modal
// ============================================================

function DeleteConfirmModal({
  students,
  onConfirm,
  onCancel,
  deleting,
}: {
  students: StudentRecord[];
  onConfirm: () => void;
  onCancel: () => void;
  deleting: boolean;
}) {
  const MAX_SHOWN = 20;
  const shown = students.slice(0, MAX_SHOWN);
  const remaining = students.length - MAX_SHOWN;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col">
        {/* Header */}
        <div className="flex items-start gap-4 px-6 pt-6 pb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Delete {students.length} Student{students.length !== 1 ? "s" : ""}?
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              This action cannot be undone. Students with{" "}
              <span className="font-medium text-slate-700">Active or Used</span> tickets will be automatically skipped.
            </p>
          </div>
        </div>

        {/* Student list */}
        <div className="mx-6 mb-4 max-h-52 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50">
          <ul className="divide-y divide-slate-100">
            {shown.map((s) => (
              <li key={s.id} className="flex items-center justify-between px-4 py-2.5 gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{s.name}</p>
                  <p className="text-xs text-slate-400 truncate">{s.student_id}</p>
                </div>
                {s.ticket_status && (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                    s.ticket_status === "ACTIVE"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : s.ticket_status === "USED"
                      ? "bg-blue-50 text-blue-700 border border-blue-200"
                      : "bg-slate-100 text-slate-500 border border-slate-200"
                  }`}>
                    {s.ticket_status === "ACTIVE" ? "⚠️ Active — skip" : s.ticket_status === "USED" ? "⚠️ Used — skip" : s.ticket_status}
                  </span>
                )}
              </li>
            ))}
            {remaining > 0 && (
              <li className="px-4 py-2 text-xs text-slate-400 text-center italic">
                …and {remaining} more student{remaining !== 1 ? "s" : ""}
              </li>
            )}
          </ul>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-6 pb-6 justify-end">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={onConfirm} loading={deleting}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Confirm Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Main Component
// ============================================================

export default function UploadPage() {
  // --- Upload state ---
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<UploadRow[]>([]);          // all parsed rows (including duplicates)
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [parseError, setParseError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [summary, setSummary] = useState<UploadSummary | null>(null);
  const [uploadError, setUploadError] = useState("");

  // --- Preview modal state ---
  const [showPreview, setShowPreview] = useState(false);

  // --- Student list state ---
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [filterCourse, setFilterCourse] = useState("all");

  // --- Selection & delete state ---
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

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
      .then((data) => {
        if (!cancelled) setStudents(data.students || []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingStudents(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ----------------------------------------------------------------
  // Template download
  // ----------------------------------------------------------------
  function handleTemplateDownload() {
    const csv =
      "name,email,student_id,course,mobile\nJohn Doe,john@college.edu,CS2024001,B.Tech CSE,9876543210\nJane Smith,jane@college.edu,CS2024002,B.Tech ECE,9876543211\n";
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
    setShowPreview(false);

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
          "student_id",
          "studentid",
          "roll_no",
          "roll_number",
          "rollno",
          "enrollment_no",
          "enrollment_number",
          "enrollmentno",
          "enroll_no",
          "id",
          "reg_no",
          "registration_no",
          "registrationno",
          "regno",
          "admission_no",
          "admissionno",
          "usn",
          "prn",
        ];
        const studentIdKey =
          studentIdAliases.find((alias) => alias in firstRow) ?? null;

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

        // Keep ALL rows (including invalid / duplicates) for full transparency
        const parsedRows: UploadRow[] = normalizedData.map((row) => ({
          name: row.name || "",
          email: row.email || "",
          student_id: studentIdKey ? row[studentIdKey] || "" : "",
          course: row.course || undefined,
          mobile: row.mobile || row.phone || row.mobile_number || undefined,
        }));

        // ── Detect duplicates within the file ──
        // Build email → [indices] and student_id → [indices] maps
        const emailMap = new Map<string, number[]>();
        const sidMap   = new Map<string, number[]>();
        parsedRows.forEach((r, i) => {
          const email = r.email.trim().toLowerCase();
          const sid   = r.student_id.trim().toLowerCase();
          if (email) {
            if (!emailMap.has(email)) emailMap.set(email, []);
            emailMap.get(email)!.push(i);
          }
          if (sid) {
            if (!sidMap.has(sid)) sidMap.set(sid, []);
            sidMap.get(sid)!.push(i);
          }
        });

        const groups: DuplicateGroup[] = [];
        // Track which indices have already been assigned to a group (avoid double-reporting)
        const assignedToGroup = new Set<number>();

        for (const [email, indices] of emailMap) {
          if (indices.length > 1) {
            groups.push({ field: "email", value: email, indices });
            indices.forEach((i) => assignedToGroup.add(i));
          }
        }
        for (const [sid, indices] of sidMap) {
          if (indices.length > 1) {
            // Only report if not already fully covered by an email-group
            const novel = indices.filter((i) => !assignedToGroup.has(i));
            if (novel.length > 0) {
              groups.push({ field: "student_id", value: sid, indices });
            }
          }
        }

        setRows(parsedRows);
        setDuplicateGroups(groups);
        // Automatically open the preview modal after parsing
        setShowPreview(true);
      } catch (err) {
        console.error("Parse error:", err);
        setParseError("Failed to parse file. Please check the format.");
      }
    };

    reader.readAsBinaryString(file);
  }

  // ----------------------------------------------------------------
  // Upload — receives the already-resolved rows from the preview modal
  // ----------------------------------------------------------------
  async function handleUpload(resolvedRows: UploadRow[]) {
    if (resolvedRows.length === 0) return;
    setUploading(true);
    setUploadError("");
    setSummary(null);

    try {
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: resolvedRows }),
      });

      const data = await res.json();

      if (!res.ok) {
        setUploadError(data.error || "Upload failed.");
        if (data.summary) setSummary(data.summary);
        setShowPreview(false);
        return;
      }

      setSummary(data.summary);
      setShowPreview(false);
      handleReset();
      loadStudents(); // Refresh student list after upload
    } catch {
      setUploadError("Network error. Please try again.");
      setShowPreview(false);
    } finally {
      setUploading(false);
    }
  }

  // ----------------------------------------------------------------
  // Selection helpers
  // ----------------------------------------------------------------
  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((s) => s.id)));
    }
  }

  // ----------------------------------------------------------------
  // Bulk delete — opens modal instead of window.confirm
  // ----------------------------------------------------------------
  function handleDeleteSelected() {
    if (selectedIds.size === 0) return;
    setShowDeleteModal(true);
  }

  async function confirmDelete() {
    setDeleting(true);
    setDeleteMessage(null);
    try {
      const res = await fetch("/api/admin/students", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDeleteMessage({ type: "error", text: data.error || "Delete failed." });
        return;
      }
      let msg = `Deleted ${data.deleted} student${data.deleted !== 1 ? "s" : ""}.`;
      if (data.skipped > 0)
        msg += ` ${data.skipped} skipped (active/used tickets).`;
      setDeleteMessage({ type: "success", text: msg });
      setSelectedIds(new Set());
      loadStudents();
    } catch {
      setDeleteMessage({
        type: "error",
        text: "Network error. Please try again.",
      });
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  }

  function handleReset() {
    setFileName("");
    setRows([]);
    setDuplicateGroups([]);
    setParseError("");
    setUploadError("");
    setShowPreview(false);
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
      case "no_ticket":
        return !s.ticket_status;
      case "active":
        return s.ticket_status === "ACTIVE";
      case "used":
        return s.ticket_status === "USED";
      case "cancelled":
        return s.ticket_status === "CANCELLED";
      case "scanned":
        return s.scanned;
      case "not_scanned":
        return !!s.ticket_status && !s.scanned;
      default:
        return true;
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

  // Students selected for deletion (from current filtered view)
  const selectedStudents = students.filter((s) => selectedIds.has(s.id));

  // ----------------------------------------------------------------
  // Export filtered list
  // ----------------------------------------------------------------
  function handleExport() {
    const headers = [
      "Name",
      "Email",
      "Student ID",
      "Course",
      "Mobile",
      "Ticket Status",
      "Ticket ID",
      "Scanned",
    ];
    const exportRows = filtered.map((s) => [
      s.name,
      s.email,
      s.student_id,
      s.course || "",
      s.mobile || "",
      s.ticket_status || "No Ticket",
      s.ticket_id || "",
      s.scanned ? "Yes" : "No",
    ]);
    const csv = [headers, ...exportRows]
      .map((r) => r.map((v) => `"${v}"`).join(","))
      .join("\n");
    downloadCSV(
      csv,
      `students_export_${new Date().toISOString().slice(0, 10)}.csv`
    );
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
      const { generateTicketPDF } = await import(
        "@/components/student/ticket-pdf"
      );
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
      {/* Preview Modal */}
      {showPreview && rows.length > 0 && (
        <PreviewModal
          allRows={rows}
          duplicateGroups={duplicateGroups}
          onConfirm={handleUpload}
          onCancel={() => {
            setShowPreview(false);
            // Keep file/rows so admin can re-open preview; only reset on explicit "Clear File"
          }}
          uploading={uploading}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <DeleteConfirmModal
          students={selectedStudents}
          onConfirm={confirmDelete}
          onCancel={() => setShowDeleteModal(false)}
          deleting={deleting}
        />
      )}

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
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Download Template
          </Button>
        </div>

        {/* ⚠️ Replace-all warning banner */}
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5">
          <svg
            className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div>
            <p className="text-sm font-semibold text-amber-800">
              Uploading replaces all existing student records
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              Every upload physically deletes the current student list and
              inserts fresh data. You will be asked to confirm before the upload
              is committed.
            </p>
          </div>
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
            <svg
              className="w-6 h-6 text-primary-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>
          {fileName ? (
            <div>
              <p className="text-sm font-medium text-slate-900">{fileName}</p>
              {rows.length > 0 && (
                <p className="text-xs text-emerald-600 mt-1 font-medium">
                  ✅ {rows.length} valid rows parsed — click below to review &amp; upload
                </p>
              )}
            </div>
          ) : (
            <>
              <p className="text-sm font-medium text-slate-900">
                Click to upload CSV or XLSX
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Required: name, email, student_id (or roll_no, enrollment_no,
                usn, prn…)
              </p>
              <p className="text-xs text-slate-400">
                Optional: course, mobile
              </p>
            </>
          )}
        </div>

        {/* Action buttons after file selected */}
        {fileName && rows.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-3 justify-center sm:justify-end">
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear File
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => setShowPreview(true)}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Review &amp; Upload ({rows.length} rows)
            </Button>
          </div>
        ) : !fileName ? (
          <div className="mt-4 flex justify-center">
            <Button
              variant="primary"
              size="md"
              onClick={() => fileInputRef.current?.click()}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
              Select File to Upload
            </Button>
          </div>
        ) : null}

        {/* Parse error */}
        {parseError && (
          <Alert variant="error" className="mt-4">
            {parseError}
          </Alert>
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
              {
                label: "Total Rows",
                value: summary.total,
                cls: "bg-slate-50 text-slate-900",
              },
              {
                label: "Imported",
                value: summary.imported,
                cls: "bg-emerald-50 text-emerald-600",
              },
              {
                label: "Duplicates Removed",
                value: summary.duplicatesRemoved,
                cls: "bg-amber-50 text-amber-600",
              },
              {
                label: "Errors",
                value: summary.errors.length,
                cls: "bg-red-50 text-red-600",
              },
            ].map((c) => (
              <div
                key={c.label}
                className={`text-center p-3 rounded-xl ${c.cls.split(" ")[0]}`}
              >
                <p className={`text-xl font-bold ${c.cls.split(" ")[1]}`}>
                  {c.value}
                </p>
                <p className="text-xs text-slate-500">{c.label}</p>
              </div>
            ))}
          </div>
          {summary.errors.length > 0 && (
            <div className="bg-red-50 rounded-xl p-3 max-h-40 overflow-y-auto">
              {summary.errors.map((err, i) => (
                <p key={i} className="text-xs text-red-600 py-0.5">
                  {err}
                </p>
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
        {/* Delete feedback */}
        {deleteMessage && (
          <Alert
            variant={deleteMessage.type}
            className="mb-4"
            onDismiss={() => setDeleteMessage(null)}
          >
            {deleteMessage.text}
          </Alert>
        )}

        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <CardTitle>Student List</CardTitle>
            <p className="text-xs text-slate-400 mt-0.5">
              {loadingStudents
                ? "Loading…"
                : `${filtered.length} of ${students.length} students`}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            {/* Selected count chip */}
            {selectedIds.size > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary-50 text-primary-700 border border-primary-200 text-xs font-semibold">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {selectedIds.size} selected
              </span>
            )}
            {selectedIds.size > 0 && (
              <Button
                variant="danger"
                size="sm"
                onClick={handleDeleteSelected}
                loading={deleting}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                Delete Selected ({selectedIds.size})
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={loadStudents}>
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Refresh
            </Button>
            {filtered.length > 0 && (
              <Button variant="secondary" size="sm" onClick={handleExport}>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
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
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Filter pills */}
        <div className="flex flex-wrap gap-2 mb-5">
          {(
            [
              { key: "all", label: "All" },
              { key: "no_ticket", label: "No Ticket" },
              { key: "active", label: "Active" },
              { key: "used", label: "Used" },
              { key: "cancelled", label: "Cancelled" },
              { key: "scanned", label: "✅ Scanned" },
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
              <span
                className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                  filterStatus === key
                    ? "bg-white/20 text-white"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
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
            <svg
              className="w-12 h-12 mx-auto mb-3 opacity-30"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <p className="text-sm font-medium">No students imported yet</p>
            <p className="text-xs mt-1">
              Upload a CSV or XLSX file above to get started
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <p className="text-sm">No students match your search or filter.</p>
            <button
              onClick={() => {
                setSearch("");
                setFilterStatus("all");
                setFilterCourse("all");
              }}
              className="text-xs text-primary-600 hover:underline mt-1"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-sm min-w-[860px]">
              <thead className="bg-slate-50">
                <tr>
                  <th className="py-3 px-3 w-10">
                    <input
                      type="checkbox"
                      id="select-all-students"
                      checked={
                        filtered.length > 0 &&
                        selectedIds.size === filtered.length
                      }
                      ref={(el) => {
                        if (el)
                          el.indeterminate =
                            selectedIds.size > 0 &&
                            selectedIds.size < filtered.length;
                      }}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 accent-primary-600 cursor-pointer rounded"
                      title="Select / deselect all visible rows"
                    />
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Name
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Student ID
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">
                    Course
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Ticket
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Entry Scan
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Emergency
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((student) => (
                  <tr
                    key={student.id}
                    className={`border-t border-slate-50 transition-colors ${
                      selectedIds.has(student.id)
                        ? "bg-primary-50 hover:bg-primary-50"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <td
                      className="py-3 px-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(student.id)}
                        onChange={() => toggleSelect(student.id)}
                        className="w-4 h-4 accent-primary-600 cursor-pointer rounded"
                        title={`Select ${student.name}`}
                      />
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-900">
                        {student.name}
                      </p>
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
                          <p className="text-xs font-mono text-slate-400">
                            {student.ticket_id}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {scanBadge(student)}
                      {student.ticket_used_at && (
                        <p className="text-xs text-slate-400 mt-1">
                          {new Date(student.ticket_used_at).toLocaleString(
                            "en-IN"
                          )}
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
                          <svg
                            className="animate-spin w-3.5 h-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                            />
                          </svg>
                        ) : (
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
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
