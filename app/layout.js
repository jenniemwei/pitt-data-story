import { Albert_Sans } from "next/font/google";
import "./globals.css";

const albertSans = Albert_Sans({
  subsets: ["latin"],
  variable: "--font-albert-sans",
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata = {
  title: "PRT FY26 cuts · full story",
  description:
    "Personas, route compare, trip purpose proxy, equity map, one scroll.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={albertSans.variable}>
      <body>{children}</body>
    </html>
  );
}
