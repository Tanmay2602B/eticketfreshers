// ============================================================
// Database row types
// ============================================================

export interface EventRow {
  id: string;
  name: string;
  description: string | null;
  date: string | null;
  start_time: string | null;
  end_time: string | null;
  venue: string | null;
  attire: string | null;
  instructions: string | null;
  banner_url: string | null;
  ticket_live: boolean;
  ticket_open_at: string | null;
  ticket_close_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EligibleStudentRow {
  id: string;
  name: string;
  email: string;
  student_id: string;
  course: string | null;
  mobile: string | null;
  imported_at: string;
}

export interface TicketRow {
  id: string;
  ticket_id: string;
  event_id: string;
  eligible_student_id: string;
  auth_user_id: string;
  qr_token: string;
  status: TicketStatus;
  generated_at: string;
  downloaded_at: string | null;
  used_at: string | null;
}

export interface CheckinRow {
  id: string;
  ticket_id: string;
  scanned_at: string;
  result: ScanResult;
}

// ============================================================
// Enums
// ============================================================

export type TicketStatus = "ACTIVE" | "USED" | "CANCELLED";

export type ScanResult = "VALID" | "ALREADY_USED" | "INVALID" | "CANCELLED";

// ============================================================
// API payloads
// ============================================================

export interface SendOtpRequest {
  email: string;
}

export interface VerifyOtpRequest {
  email: string;
  token: string;
}

export interface UploadRow {
  name: string;
  email: string;
  student_id: string;
  course?: string;
  mobile?: string;
}

export interface UploadSummary {
  total: number;
  imported: number;
  duplicatesRemoved: number;
  errors: string[];
}

export interface DashboardStats {
  eligible: number;
  generated: number;
  downloaded: number;
  used: number;
}

export interface StudentDashboardData {
  student: EligibleStudentRow;
  event: EventRow | null;
  ticket: TicketRow | null;
  ticketAvailable: boolean;
}

export interface ScanResponse {
  result: ScanResult;
  student?: {
    name: string;
    student_id: string;
    course: string | null;
  };
  ticket_id?: string;
  used_at?: string;
  message: string;
}

export interface TicketControlPayload {
  ticket_live: boolean;
  ticket_open_at: string | null;
  ticket_close_at: string | null;
}
