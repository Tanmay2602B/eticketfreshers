"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import Link from "next/link";

type Step = "email" | "otp";

// Simple email regex for client-side validation
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_COOLDOWN_SECONDS = 60;

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // ── Resend cooldown ────────────────────────────────────────────
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const otpRequestInFlight = useRef(false);

  // Cleanup cooldown timer on unmount
  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

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

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (otpRequestInFlight.current || loading) return;

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !EMAIL_REGEX.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (resendCooldown > 0) {
      setError(
        `Please wait ${resendCooldown} seconds before requesting another code.`
      );
      return;
    }

    otpRequestInFlight.current = true;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }

      setSuccess("OTP sent! Check your email inbox (and spam folder).");
      setStep("otp");
      startCooldown();
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
      otpRequestInFlight.current = false;
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (loading) return;

    if (!otp.trim() || otp.trim().length < 6) {
      setError("Please enter the 6-digit OTP.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), token: otp.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Invalid OTP. Please try again.");
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="gradient-hero">
        <div className="max-w-lg mx-auto px-6 py-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-white/80 hover:text-white text-sm mb-4 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Link>
          <h1 className="text-2xl font-bold text-white">
            {step === "email" ? "Get Your E-Ticket" : "Enter OTP"}
          </h1>
          <p className="text-white/70 text-sm mt-2">
            {step === "email"
              ? "Enter your registered email to receive a verification code"
              : `We sent a code to ${email}`}
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 max-w-lg mx-auto w-full px-6 -mt-4">
        <div className="glass-card rounded-2xl p-6 animate-fadeInUp">
          {error && (
            <Alert variant="error" className="mb-4" onDismiss={() => setError("")}>
              {error}
            </Alert>
          )}
          {success && (
            <Alert variant="success" className="mb-4">
              {success}
            </Alert>
          )}

          {step === "email" ? (
            <form onSubmit={handleSendOtp} className="space-y-5">
              <Input
                label="Email Address"
                type="email"
                placeholder="your.email@college.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                autoComplete="email"
              />
              <Button type="submit" size="lg" className="w-full" loading={loading}>
                Send Verification Code
              </Button>
              <p className="text-xs text-slate-400 text-center">
                Only emails registered in the eligible student list can proceed.
              </p>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
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
              <Button type="submit" size="lg" className="w-full" loading={loading}>
                Verify &amp; Login
              </Button>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setStep("email");
                    setOtp("");
                    setError("");
                    setSuccess("");
                  }}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  Change Email
                </button>
                <button
                  type="button"
                  onClick={() => handleSendOtp({ preventDefault: () => {} } as React.FormEvent)}
                  className={`text-sm font-medium transition-colors ${
                    resendCooldown > 0 || loading
                      ? "text-slate-400 cursor-not-allowed"
                      : "text-primary-600 hover:text-primary-700"
                  }`}
                  disabled={resendCooldown > 0 || loading}
                >
                  {resendCooldown > 0
                    ? `Resend OTP (${resendCooldown}s)`
                    : "Resend OTP"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
