import {Geist_Mono, Literata, Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

const literata = Literata({
  subsets: ["latin"],
  variable: "--font-literata",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata = {
  title: "PRT FY26 cuts",
  description: "PRT FY26 route changes, demographics, equity dot map, and orphaned stops.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${literata.variable} ${geistMono.variable}`}
    >
      <body>
        <div className="page-shell">{children}</div>
      </body>
    </html>
  );
}
