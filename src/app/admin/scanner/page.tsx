"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { ScanResponse } from "@/lib/types";

export default function ScannerPage() {
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResponse | null>(null);
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const scannerRef = useRef<unknown>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleScan = useCallback(
    async (decodedText: string) => {
      if (verifying) return;
      setVerifying(true);
      setScanResult(null);
      setError("");

      try {
        const res = await fetch("/api/admin/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ qr_token: decodedText }),
        });

        const data: ScanResponse = await res.json();
        setScanResult(data);
      } catch {
        setError("Network error. Please try again.");
      } finally {
        setVerifying(false);
      }
    },
    [verifying]
  );

  const startScanner = useCallback(async () => {
    setError("");
    setScanResult(null);

    try {
      const { Html5Qrcode } = await import("html5-qrcode");

      if (scannerRef.current) {
        try {
          await (scannerRef.current as { stop: () => Promise<void> }).stop();
        } catch {
          // Scanner may already be stopped
        }
      }

      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1,
        },
        (decodedText) => {
          // Pause scanner on successful scan
          scanner.pause();
          handleScan(decodedText);
        },
        () => {
          // Ignore scan errors (no QR found in frame)
        }
      );

      setScanning(true);
    } catch (err) {
      console.error("Scanner error:", err);
      if (
        err instanceof Error &&
        err.message.includes("Permission")
      ) {
        setError(
          "Camera permission denied. Please allow camera access in your browser settings."
        );
      } else if (
        err instanceof Error &&
        err.message.includes("NotFoundError")
      ) {
        setError(
          "No camera found on this device. Please use a device with a camera."
        );
      } else {
        setError("Failed to start camera. Please check permissions and try again.");
      }
    }
  }, [handleScan]);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await (
          scannerRef.current as { stop: () => Promise<void> }
        ).stop();
      } catch {
        // Ignore
      }
      scannerRef.current = null;
    }
    setScanning(false);
  }, []);

  const resumeScanner = useCallback(async () => {
    setScanResult(null);
    setError("");

    if (scannerRef.current) {
      try {
        (
          scannerRef.current as { resume: () => void }
        ).resume();
      } catch {
        // If resume fails, restart
        await startScanner();
      }
    }
  }, [startScanner]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try {
          (
            scannerRef.current as { stop: () => Promise<void> }
          ).stop();
        } catch {
          // Ignore
        }
      }
    };
  }, []);

  const resultConfig = {
    VALID: {
      bgColor: "bg-emerald-50",
      borderColor: "border-emerald-200",
      iconColor: "text-emerald-600",
      icon: (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      title: "✅ Entry Allowed",
      badge: "active" as const,
    },
    ALREADY_USED: {
      bgColor: "bg-red-50",
      borderColor: "border-red-200",
      iconColor: "text-red-600",
      icon: (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      title: "🚫 Entry Denied — Already Used",
      badge: "used" as const,
    },
    INVALID: {
      bgColor: "bg-red-50",
      borderColor: "border-red-200",
      iconColor: "text-red-600",
      icon: (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      ),
      title: "❌ Entry Denied — Invalid Ticket",
      badge: "cancelled" as const,
    },
    CANCELLED: {
      bgColor: "bg-red-50",
      borderColor: "border-red-200",
      iconColor: "text-red-600",
      icon: (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
      ),
      title: "🚫 Entry Denied — Cancelled",
      badge: "cancelled" as const,
    },
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">QR Scanner</h1>
        <p className="text-sm text-slate-500 mt-1">
          Scan student e-tickets for entry verification
        </p>
      </div>

      {/* Scanner Controls */}
      <Card className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <CardTitle>Camera Scanner</CardTitle>
          {!scanning ? (
            <Button size="sm" onClick={startScanner}>
              Open Camera
            </Button>
          ) : (
            <Button size="sm" variant="danger" onClick={stopScanner}>
              Stop Camera
            </Button>
          )}
        </div>

        {/* QR Reader container */}
        <div
          ref={containerRef}
          className="rounded-xl overflow-hidden bg-slate-900"
        >
          <div id="qr-reader" style={{ width: "100%" }} />
        </div>

        {!scanning && !scanResult && (
          <div className="text-center py-12 text-slate-400">
            <svg
              className="w-16 h-16 mx-auto mb-3 opacity-30"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
              />
            </svg>
            <p className="text-sm">Click &quot;Open Camera&quot; to start scanning</p>
          </div>
        )}

        {verifying && (
          <div className="text-center py-6">
            <div className="animate-spin w-8 h-8 border-3 border-primary-200 border-t-primary-600 rounded-full mx-auto mb-2" />
            <p className="text-sm text-slate-500">Verifying ticket...</p>
          </div>
        )}

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {error}
          </div>
        )}
      </Card>

      {/* Scan Result */}
      {scanResult && (
        <Card
          className={`${resultConfig[scanResult.result]?.bgColor || "bg-slate-50"} border ${resultConfig[scanResult.result]?.borderColor || "border-slate-200"}`}
        >
          <div className="text-center mb-4">
            <div
              className={`${resultConfig[scanResult.result]?.iconColor || "text-slate-600"} inline-block mb-2`}
            >
              {resultConfig[scanResult.result]?.icon}
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              {resultConfig[scanResult.result]?.title || "Unknown Result"}
            </h2>
            <p className="text-sm text-slate-600 mt-1">{scanResult.message}</p>
          </div>

          {scanResult.student && (
            <div className="bg-white rounded-xl p-4 space-y-2 mb-4">
              <div className="flex justify-between">
                <span className="text-xs text-slate-500">Name</span>
                <span className="text-sm font-semibold text-slate-900">
                  {scanResult.student.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-slate-500">Student ID</span>
                <span className="text-sm font-semibold text-slate-900">
                  {scanResult.student.student_id}
                </span>
              </div>
              {scanResult.student.course && (
                <div className="flex justify-between">
                  <span className="text-xs text-slate-500">Course</span>
                  <span className="text-sm font-semibold text-slate-900">
                    {scanResult.student.course}
                  </span>
                </div>
              )}
              {scanResult.ticket_id && (
                <div className="flex justify-between">
                  <span className="text-xs text-slate-500">Ticket</span>
                  <span className="text-xs font-mono text-slate-600">
                    {scanResult.ticket_id}
                  </span>
                </div>
              )}
            </div>
          )}

          <Button
            className="w-full"
            variant={scanResult.result === "VALID" ? "success" : "secondary"}
            onClick={resumeScanner}
          >
            Scan Next Ticket
          </Button>
        </Card>
      )}
    </div>
  );
}
