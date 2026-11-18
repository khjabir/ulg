import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { RegisterServiceWorker } from "@/core/RegisterServiceWorker";
import "@/styles/base.css";
import "@/styles/shell.css";
import "@/styles/hub.css";
import "@/styles/sumbroke.css";
import "@/styles/kings.css";
import "@/styles/tangle.css";
import "@/styles/zap.css";
import "@/styles/sixdoku.css";
import "@/styles/swatches.css";

const archivo = localFont({
  src: "./fonts/archivo-latin.woff2",
  variable: "--font-archivo",
  weight: "100 900",
  display: "swap",
  declarations: [{ prop: "font-stretch", value: "62% 125%" }],
});

const base = process.env.NEXT_PUBLIC_RELATIVE_ASSETS === "1" ? "." : (process.env.NEXT_PUBLIC_BASE_PATH ?? "");

export const metadata: Metadata = {
  title: "ulg: Unlimited Logic Games",
  description: "Sumbroke, Kings, Tangle, Zap, Sixdoku and Swatches: endless logic puzzles that play offline.",
  applicationName: "ulg",
  appleWebApp: { capable: true, title: "ulg", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: `${base}/favicon.ico`, sizes: "48x48" },
      { url: `${base}/icons/favicon-32.png`, sizes: "32x32", type: "image/png" },
      { url: `${base}/icons/icon-192.png`, sizes: "192x192", type: "image/png" },
    ],
    apple: `${base}/icons/apple-touch-icon.png`,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef2ee" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1716" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={archivo.variable}>
      <body>
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
