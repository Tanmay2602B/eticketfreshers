# Freshers 2026 E-Ticket System

A secure, high-performance E-Ticket management platform built for college events, featuring Supabase Auth Email OTP, Row Level Security (RLS), dynamic PDF tickets with anti-counterfeit QR verification, and a responsive administrative console.

---

## 🏗 Architecture

- **Frontend & Full-Stack API**: Next.js 16 (Turbopack, App Router, React 19, Tailwind CSS v4) → **Vercel**
- **Authentication**: Supabase Auth (Passwordless Email OTP with `shouldCreateUser: false` gating)
- **Database**: Supabase PostgreSQL with strict Row Level Security (RLS)
- **Email Delivery**: Brevo SMTP configured directly inside Supabase Auth
- **Uptime / Health Check**: `GET /health` (`{"status": "ok"}`)

> [!NOTE]
> All backend logic is unified within Next.js Route Handlers (`/api/*`). No external Node/Express backend or Render instance is required.

---

## 🔒 Security & Authorization Model

1. **Email OTP Authentication**:
   - Client sends email to `/api/auth/send-otp`.
   - Server strictly normalizes email (`email.trim().toLowerCase()`).
   - Server checks if student exists in `eligible_students`. Unregistered emails are rejected with `403`.
   - Server provisions `auth.users` for eligible students so `supabase.auth.signInWithOtp` executes safely with `shouldCreateUser: false`.
2. **Post-OTP Student Authorization**:
   - After Supabase validates the 6-digit OTP in `/api/auth/verify-otp`, the server validates the authenticated user's email against `eligible_students`.
   - If not registered, the session is invalidated immediately (`auth.signOut()`) and access is denied.
3. **Ticket Access Control**:
   - Tickets can only be fetched (`GET /api/student/ticket`), generated (`POST /api/student/ticket`), or downloaded by the authenticated student.
   - Routes resolve student identity solely from the verified Supabase Auth session. No query parameters like `/ticket?id=123` are accepted.
4. **Route Protection & Cache Control**:
   - `proxy.ts` (Next.js 16 middleware) protects `/dashboard`, `/ticket`, `/student/*`, and `/admin/*`.
   - Unauthenticated visitors are redirected to `/`.
   - `Cache-Control: no-store, no-cache, must-revalidate` headers prevent back-button exposure after logout.
5. **Row Level Security (RLS)**:
   - Direct client writes to `events`, `eligible_students`, `tickets`, and `checkins` are disabled.
   - Authenticated students can only read their own student row and their own ticket.

---

## 📧 Brevo SMTP Configuration in Supabase

Brevo is used purely as the SMTP email transport layer for Supabase Auth:
1. In your **Supabase Project Dashboard**, navigate to **Project Settings** → **Authentication** → **SMTP Settings**.
2. Enable **Enable Custom SMTP**.
3. Set the following Brevo SMTP credentials:
   - **Sender email**: Your verified sender email in Brevo (e.g. `tickets@yourcollege.edu`)
   - **Sender name**: `Freshers 2026 E-Ticket System`
   - **Host**: `smtp-relay.brevo.com`
   - **Port**: `587`
   - **User**: Your Brevo login email / SMTP login
   - **Password**: Your Brevo SMTP key
4. Save the configuration.

> [!CAUTION]
> Never place Brevo SMTP credentials in frontend code or Git repositories.

---

## 🌐 Supabase Auth URL Configuration

Under **Supabase Project Dashboard** → **Authentication** → **URL Configuration**:
- **Site URL**: `https://YOUR-VERCEL-DOMAIN.vercel.app`
- **Redirect URLs**:
  - `https://YOUR-VERCEL-DOMAIN.vercel.app/**`
  - `http://localhost:3000/**` (for local development)

---

## 🚀 Environment Variables

Copy `.env.example` to `.env.local` for local development:

```bash
# Public variables (safe for browser exposure)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-or-publishable-key
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-anon-or-publishable-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3000

# Server-only secrets (NEVER expose to frontend or git)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ADMIN_EMAIL=admin@college.edu
```

---

## 🛠 Database Setup

Run the migrations in order in the **Supabase SQL Editor**:
1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_fix_rls_policies.sql`
3. `supabase/migrations/003_production_security_hardening.sql`

---

## 💻 Development & Build

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Run linter
npm run lint

# Build for production
npm run build
```
