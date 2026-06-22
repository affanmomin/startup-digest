import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Startup Digest",
  description:
    "A personal founder inspiration tool — discover Product Hunt launches worth building a sharper version of.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background antialiased">{children}</body>
    </html>
  );
}
