import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import "./globals.css";

/** Matches Stitch DESIGN.md — Inter for exam readability & admin tables */
const inter = Inter({
  variable: "--font-ui-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ExamPro AI — Educational Examination Platform",
  description:
    "AI-assisted question authoring, secure browser exams, and automated grading for schools.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#15196c",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans touch-manipulation">
        <AuthProvider>
          {children}
        </AuthProvider>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
