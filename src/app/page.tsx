"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

type LoginTab = "student" | "admin";
type StudentStep = "email" | "otp";

// Simple email regex for client-side validation
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_COOLDOWN_SECONDS = 60;

export default function UnifiedLoginPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<LoginTab>("student");

  // ── Student state ──────────────────────────────────────────────
  const [studentStep, setStudentStep] = useState<StudentStep>("email");
  const [studentEmail, setStudentEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [studentLoading, setStudentLoading] = useState(false);
  const [studentError, setStudentError] = useState("");
  const [studentSuccess, setStudentSuccess] = useState("");

  // ── Resend cooldown ────────────────────────────────────────────
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Prevent double-submit ──────────────────────────────────────
  const otpRequestInFlight = useRef(false);

  // ── Admin state ────────────────────────────────────────────────
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState("");

  // Cleanup cooldown timer on unmount
  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  // Start cooldown countdown
  const startCooldown = useCallback(() => {
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          cooldownRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // ================================================================
  // Student handlers
  // ================================================================

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setStudentError("");
    setStudentSuccess("");

    // Prevent concurrent requests
    if (otpRequestInFlight.current || studentLoading) return;

    const trimmedEmail = studentEmail.trim().toLowerCase();
    if (!trimmedEmail || !EMAIL_REGEX.test(trimmedEmail)) {
      setStudentError("Please enter a valid email address.");
      return;
    }

    // Check cooldown
    if (resendCooldown > 0) {
      setStudentError(
        `Please wait ${resendCooldown} seconds before requesting another code.`
      );
      return;
    }

    otpRequestInFlight.current = true;
    setStudentLoading(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail }),
      });

      const data = await res.json();
      if (!res.ok) {
        setStudentError(data.error || "Something went wrong. Please try again.");
        return;
      }

      setStudentSuccess("OTP sent! Check your email inbox (and spam folder).");
      setStudentStep("otp");
      startCooldown();
    } catch {
      setStudentError("Network error. Please check your connection and try again.");
    } finally {
      setStudentLoading(false);
      otpRequestInFlight.current = false;
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setStudentError("");
    setStudentSuccess("");

    if (studentLoading) return;

    if (!otp.trim() || otp.trim().length < 6) {
      setStudentError("Please enter the 6-digit OTP.");
      return;
    }

    setStudentLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: studentEmail.trim().toLowerCase(), token: otp.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        setStudentError(data.error || "Invalid OTP. Please try again.");
        return;
      }

      router.push("/dashboard");
    } catch {
      setStudentError("Network error. Please check your connection and try again.");
    } finally {
      setStudentLoading(false);
    }
  }

  // ================================================================
  // Admin handler
  // ================================================================

  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault();
    setAdminError("");
    setAdminLoading(true);

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: adminEmail.trim(),
        password: adminPassword,
      });

      if (authError) {
        setAdminError("Invalid credentials. Please try again.");
        return;
      }

      router.push("/admin");
      router.refresh();
    } catch {
      setAdminError("Something went wrong. Please try again.");
    } finally {
      setAdminLoading(false);
    }
  }

  // ================================================================
  // Render
  // ================================================================

  return (
    <div className="min-h-screen flex flex-col">
      {/* Gradient Header */}
      <div className="gradient-hero relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/5 rounded-full" />
          <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-white/5 rounded-full" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/[0.02] rounded-full" />
        </div>

        <div className="relative max-w-lg mx-auto px-6 pt-10 pb-14 text-center">
          {/* Logo/Badge */}
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 mb-5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-white/90 text-sm font-medium">
              E-Ticket System
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 leading-tight">
            College Induction
          </h1>
          <p className="text-white/70 text-sm">
            Sign in to access your e-ticket or manage the event
          </p>
        </div>
      </div>

      {/* Login Card */}
      <div className="flex-1 max-w-lg mx-auto w-full px-6 -mt-6">
        <div className="glass-card rounded-2xl overflow-hidden animate-fadeInUp">
          {/* Tab Switcher */}
          <div className="flex border-b border-slate-100">
            <button
              onClick={() => {
                setActiveTab("student");
                setAdminError("");
              }}
              className={`flex-1 py-4 text-sm font-semibold transition-all duration-300 relative ${
                activeTab === "student"
                  ? "text-primary-600"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Student Login
              </div>
              {activeTab === "student" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 rounded-full" />
              )}
            </button>
            <button
              onClick={() => {
                setActiveTab("admin");
                setStudentError("");
                setStudentSuccess("");
              }}
              className={`flex-1 py-4 text-sm font-semibold transition-all duration-300 relative ${
                activeTab === "admin"
                  ? "text-primary-600"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Admin Login
              </div>
              {activeTab === "admin" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 rounded-full" />
              )}
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {/* ─── Student Tab ─────────────────────────────────── */}
            {activeTab === "student" && (
              <div className="animate-fadeInUp">
                {studentError && (
                  <Alert variant="error" className="mb-4" onDismiss={() => setStudentError("")}>
                    {studentError}
                  </Alert>
                )}
                {studentSuccess && (
                  <Alert variant="success" className="mb-4">
                    {studentSuccess}
                  </Alert>
                )}

                {studentStep === "email" ? (
                  <form onSubmit={handleSendOtp} className="space-y-5">
                    <div className="text-center mb-2">
                      <div className="w-12 h-12 rounded-2xl bg-primary-50 flex items-center justify-center mx-auto mb-3">
                        <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                        </svg>
                      </div>
                      <h2 className="text-lg font-bold text-slate-900">Get Your E-Ticket</h2>
                      <p className="text-xs text-slate-500 mt-1">
                        Enter your registered email to receive a verification code
                      </p>
                    </div>
                    <Input
                      label="Email Address"
                      type="email"
                      placeholder="your.email@college.edu"
                      value={studentEmail}
                      onChange={(e) => setStudentEmail(e.target.value)}
                      required
                      autoFocus
                      autoComplete="email"
                    />
                    <Button type="submit" size="lg" className="w-full" loading={studentLoading}>
                      Send Verification Code
                    </Button>
                    <p className="text-xs text-slate-400 text-center">
                      Only emails registered in the eligible student list can proceed.
                    </p>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOtp} className="space-y-5">
                    <div className="text-center mb-2">
                      <h2 className="text-lg font-bold text-slate-900">Enter OTP</h2>
                      <p className="text-xs text-slate-500 mt-1">
                        We sent a code to {studentEmail}
                      </p>
                    </div>
                    <Input
                      label="Verification Code"
                      type="text"
                      placeholder="Enter 6-digit OTP"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      maxLength={6}
                      required
                      autoFocus
                      autoComplete="one-time-code"
                      inputMode="numeric"
                      className="text-center text-2xl tracking-[0.5em] font-mono"
                    />
                    <Button type="submit" size="lg" className="w-full" loading={studentLoading}>
                      Verify &amp; Login
                    </Button>
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => {
                          setStudentStep("email");
                          setOtp("");
                          setStudentError("");
                          setStudentSuccess("");
                        }}
                        className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                      >
                        Change Email
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSendOtp({ preventDefault: () => {} } as React.FormEvent)}
                        className={`text-sm font-medium transition-colors ${
                          resendCooldown > 0 || studentLoading
                            ? "text-slate-400 cursor-not-allowed"
                            : "text-primary-600 hover:text-primary-700"
                        }`}
                        disabled={resendCooldown > 0 || studentLoading}
                      >
                        {resendCooldown > 0
                          ? `Resend OTP (${resendCooldown}s)`
                          : "Resend OTP"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* ─── Admin Tab ──────────────────────────────────── */}
            {activeTab === "admin" && (
              <div className="animate-fadeInUp">
                {adminError && (
                  <Alert variant="error" className="mb-4" onDismiss={() => setAdminError("")}>
                    {adminError}
                  </Alert>
                )}

                <form onSubmit={handleAdminLogin} className="space-y-5">
                  <div className="text-center mb-2">
                    <div className="w-12 h-12 rounded-2xl bg-primary-600 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-primary-500/30">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </div>
                    <h2 className="text-lg font-bold text-slate-900">Admin Dashboard</h2>
                    <p className="text-xs text-slate-500 mt-1">
                      E-Ticket Management Console
                    </p>
                  </div>
                  <Input
                    label="Email"
                    type="email"
                    placeholder="admin@college.edu"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                  <Input
                    label="Password"
                    type="password"
                    placeholder="••••••••"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <Button type="submit" size="lg" className="w-full" loading={adminLoading}>
                    Sign In
                  </Button>
                </form>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 mt-6 pb-8">
          Secure, fast, and paperless entry management
        </p>
      </div>
    </div>
  );
}
