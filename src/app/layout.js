import { Geist, Geist_Mono } from "next/font/google";
import Providers from "@/components/providers";
import SiteShell from "@/components/site-shell";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "TicketFlow Integration",
  description: "BeMyGuest integration test storefront",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body suppressHydrationWarning>
        <Providers>
          <SiteShell />
          {children}
        </Providers>
      </body>
    </html>
  );
}
