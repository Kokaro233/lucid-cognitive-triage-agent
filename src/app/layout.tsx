import type { Metadata } from "next";
import { LanguageProvider } from "@/components/LanguageProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "LUCID | Cognitive Triage Agent",
  description: "A cognitive triage agent for scam-resistant decisions.",
  icons: {
    icon: "/lucid-icon.svg",
    shortcut: "/lucid-icon.svg",
    apple: "/lucid-icon.svg"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
