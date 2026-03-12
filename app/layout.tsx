import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "EVSU Grader",
  description: "Latin Honors Interview Grading System — EVSU Ormoc Campus",
  icons: {
    icon: "/EVSU_logo.png",
    apple: "/EVSU_logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased font-body">
        <AuthProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3000,
              style: {
                borderRadius: '10px',
                background: '#1A1A1A',
                color: '#fff',
                fontSize: '14px',
              },
              success: {
                iconTheme: { primary: '#22C55E', secondary: '#fff' },
              },
              error: {
                iconTheme: { primary: '#EF4444', secondary: '#fff' },
              },
            }}
          />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
