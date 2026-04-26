import { Albert_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";

const albertSans = Albert_Sans({
  subsets: ["latin"],
  variable: "--font-albert-sans",
  weight: ["300", "400", "500", "600"],
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
    <html lang="en" className={`${albertSans.variable} ${geistMono.variable}`}>
      <body>
        <div className="page-shell">{children}</div>
      </body>
    </html>
  );
}
