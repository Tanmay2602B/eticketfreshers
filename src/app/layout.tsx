import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "College Induction E-Ticket",
  description:
    "Get your digital entry pass for the college induction ceremony. Secure, fast, and paperless.",
  keywords: ["college", "induction", "e-ticket", "event", "entry pass"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
