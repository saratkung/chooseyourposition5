import type { Metadata } from "next";
import { IBM_Plex_Sans_Thai, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/supabase/auth-context";
import { ToastProvider } from "@/components/ui/Toast";
import { ConnectionStatus } from "@/components/system/ConnectionStatus";

const bodyFont = IBM_Plex_Sans_Thai({
  variable: "--font-body",
  subsets: ["latin", "thai"],
  weight: ["400", "500", "600", "700"],
});

const tacticalMono = IBM_Plex_Mono({
  variable: "--font-tactical-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Position Selection System",
  description: "Real-time online position selection command center",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={`${bodyFont.variable} ${tacticalMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <AuthProvider>
          <ToastProvider>
            <ConnectionStatus />
            {children}
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
