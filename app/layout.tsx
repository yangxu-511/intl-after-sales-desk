import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "International Service Desk",
  description:
    "A simple bilingual after-sales ticket form for international service employees.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
