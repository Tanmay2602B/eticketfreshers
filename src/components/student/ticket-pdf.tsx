import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import type { EventRow, EligibleStudentRow, TicketRow } from "@/lib/types";
import { formatDate, formatTime } from "@/lib/utils";

export async function generateTicketPDF(
  event: EventRow,
  student: EligibleStudentRow,
  ticket: TicketRow
) {
  // A6 Landscape: 148mm x 105mm
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: [148, 105],
  });

  const w = 148;
  const h = 105;

  // ============================================================
  // Background & Border
  // ============================================================

  // Outer border
  doc.setDrawColor(79, 70, 229); // primary-600
  doc.setLineWidth(0.8);
  doc.roundedRect(3, 3, w - 6, h - 6, 3, 3);

  // Inner subtle border
  doc.setDrawColor(199, 210, 254); // primary-200
  doc.setLineWidth(0.3);
  doc.roundedRect(5, 5, w - 10, h - 10, 2, 2);

  // ============================================================
  // Header gradient bar
  // ============================================================
  doc.setFillColor(79, 70, 229); // primary-600
  doc.rect(5, 5, w - 10, 18, "F");

  // Header text
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(event.name || "College Induction", w / 2, 13, { align: "center" });

  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.text("VALID ENTRY PASS", w / 2, 18, { align: "center" });

  // ============================================================
  // Left Section — Student & Event Details
  // ============================================================
  const leftX = 10;
  let y = 30;
  const labelColor: [number, number, number] = [100, 116, 139]; // slate-500
  const valueColor: [number, number, number] = [30, 41, 59]; // slate-800

  function addField(label: string, value: string, yPos: number): number {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.5);
    doc.setTextColor(...labelColor);
    doc.text(label.toUpperCase(), leftX, yPos);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...valueColor);
    doc.text(value || "—", leftX, yPos + 4);

    return yPos + 10;
  }

  y = addField("Student Name", student.name, y);
  y = addField("Student ID", student.student_id, y);
  y = addField("Course", student.course || "N/A", y);

  // Divider
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.2);
  doc.line(leftX, y - 2, 88, y - 2);

  y = addField("Date", formatDate(event.date), y + 1);
  y = addField(
    "Time",
    `${formatTime(event.start_time)}${event.end_time ? ` — ${formatTime(event.end_time)}` : ""}`,
    y
  );
  y = addField("Venue", event.venue || "TBA", y);

  if (event.attire) {
    y = addField("Attire", event.attire, y);
  }

  // ============================================================
  // Right Section — QR Code
  // ============================================================

  // Dashed separator line
  doc.setDrawColor(199, 210, 254);
  doc.setLineWidth(0.3);
  doc.setLineDashPattern([1.5, 1], 0);
  doc.line(95, 28, 95, h - 8);
  doc.setLineDashPattern([], 0);

  // QR Code
  const qrDataUrl = await QRCode.toDataURL(ticket.qr_token, {
    width: 400,
    margin: 1,
    color: {
      dark: "#1e1b4b", // primary-950
      light: "#ffffff",
    },
    errorCorrectionLevel: "H",
  });

  const qrSize = 35;
  const qrX = 104;
  const qrY = 32;

  // QR border
  doc.setDrawColor(79, 70, 229);
  doc.setLineWidth(0.4);
  doc.roundedRect(qrX - 2, qrY - 2, qrSize + 4, qrSize + 4, 1.5, 1.5);

  doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);

  // "Scan to verify" text
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5);
  doc.setTextColor(...labelColor);
  doc.text("SCAN TO VERIFY", qrX + qrSize / 2, qrY + qrSize + 6, {
    align: "center",
  });

  // ============================================================
  // Footer — Ticket ID
  // ============================================================
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.line(5, h - 12, w - 5, h - 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(5);
  doc.setTextColor(...labelColor);
  doc.text(`TICKET ID: ${ticket.ticket_id}`, leftX, h - 7);

  doc.setTextColor(79, 70, 229);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5);
  doc.text("E-TICKET • DO NOT SHARE", w - 10, h - 7, { align: "right" });

  // ============================================================
  // Save
  // ============================================================
  const filename = `${(event.name || "Ticket").replace(/[^a-zA-Z0-9]/g, "_")}-${student.name.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
  doc.save(filename);
}
