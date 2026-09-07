"use client";

import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import type { UploadRow, UploadSummary } from "@/lib/types";

const REQUIRED_COLUMNS = ["name", "email", "student_id"];

export default function UploadPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<UploadRow[]>([]);
  const [parseError, setParseError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [summary, setSummary] = useState<UploadSummary | null>(null);
  const [uploadError, setUploadError] = useState("");

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setParseError("");
    setSummary(null);
    setUploadError("");
    setRows([]);
    setFileName(file.name);

    // Validate file type
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

        // Normalize column names (lowercase, trim)
        const normalizedData = jsonData.map((row) => {
          const normalizedRow: Record<string, string> = {};
          for (const [key, value] of Object.entries(row)) {
            normalizedRow[key.toLowerCase().trim().replace(/\s+/g, "_")] =
              String(value).trim();
          }
          return normalizedRow;
        });

        // Check required columns
        const firstRow = normalizedData[0];
        const missingColumns = REQUIRED_COLUMNS.filter(
          (col) => !(col in firstRow)
        );

        if (missingColumns.length > 0) {
          setParseError(
            `Missing required columns: ${missingColumns.join(", ")}. Found columns: ${Object.keys(firstRow).join(", ")}`
          );
          return;
        }

        // Map to UploadRow
        const parsedRows: UploadRow[] = normalizedData
          .map((row) => ({
            name: row.name || "",
            email: row.email || "",
            student_id: row.student_id || "",
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
    setSummary(null);
    setUploadError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Upload Student Data</h1>
        <p className="text-sm text-slate-500 mt-1">
          Import eligible students from a CSV or XLSX file
        </p>
      </div>

      {/* Upload Zone */}
      <Card className="mb-6">
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
            <p className="text-sm font-medium text-slate-900">{fileName}</p>
          ) : (
            <>
              <p className="text-sm font-medium text-slate-900">
                Click to upload CSV or XLSX
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Required columns: name, email, student_id
              </p>
              <p className="text-xs text-slate-400">
                Optional: course, mobile
              </p>
            </>
          )}
        </div>
      </Card>

      {/* Parse Error */}
      {parseError && (
        <Alert variant="error" className="mb-4">
          {parseError}
        </Alert>
      )}

      {/* Preview */}
      {rows.length > 0 && !summary && (
        <Card className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <CardTitle>Preview ({rows.length} students)</CardTitle>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={handleReset}>
                Clear
              </Button>
              <Button size="sm" onClick={handleUpload} loading={uploading}>
                Upload & Import
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase">
                    Name
                  </th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase">
                    Email
                  </th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase">
                    Student ID
                  </th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase">
                    Course
                  </th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase">
                    Mobile
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 10).map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-slate-50 hover:bg-slate-50"
                  >
                    <td className="py-2 px-3 text-slate-800">{row.name}</td>
                    <td className="py-2 px-3 text-slate-600">{row.email}</td>
                    <td className="py-2 px-3 text-slate-600">
                      {row.student_id}
                    </td>
                    <td className="py-2 px-3 text-slate-600">
                      {row.course || "—"}
                    </td>
                    <td className="py-2 px-3 text-slate-600">
                      {row.mobile || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 10 && (
              <p className="text-xs text-slate-400 p-3 text-center">
                ...and {rows.length - 10} more students
              </p>
            )}
          </div>
        </Card>
      )}

      {/* Upload Error */}
      {uploadError && (
        <Alert variant="error" className="mb-4">
          {uploadError}
        </Alert>
      )}

      {/* Summary */}
      {summary && (
        <Card>
          <CardTitle className="mb-4">Upload Summary</CardTitle>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <div className="text-center p-3 bg-slate-50 rounded-xl">
              <p className="text-xl font-bold text-slate-900">
                {summary.total}
              </p>
              <p className="text-xs text-slate-500">Total Rows</p>
            </div>
            <div className="text-center p-3 bg-emerald-50 rounded-xl">
              <p className="text-xl font-bold text-emerald-600">
                {summary.imported}
              </p>
              <p className="text-xs text-slate-500">Imported</p>
            </div>
            <div className="text-center p-3 bg-amber-50 rounded-xl">
              <p className="text-xl font-bold text-amber-600">
                {summary.duplicatesRemoved}
              </p>
              <p className="text-xs text-slate-500">Duplicates Removed</p>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-xl">
              <p className="text-xl font-bold text-red-600">
                {summary.errors.length}
              </p>
              <p className="text-xs text-slate-500">Errors</p>
            </div>
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
            <Button variant="secondary" size="sm" onClick={handleReset}>
              Upload New File
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
