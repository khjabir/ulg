import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { AppRuntime } from "@/core/AppChrome";
import splashSizes from "./splash-sizes.json";
import { Analytics } from "@vercel/analytics/next";
import "@/styles/base.css";
import "@/styles/shell.css";
import "@/styles/hub.css";
import "@/styles/sumbroke.css";
import "@/styles/kings.css";
import "@/styles/tangle.css";
import "@/styles/zap.css";
import "@/styles/sixdoku.css";
import "@/styles/swatches.css";
import "@/styles/app.css";

const archivo = localFont({
  src: "./fonts/archivo-latin.woff2",
  variable: "--font-archivo",
  weight: "100 900",
  display: "swap",
  declarations: [{ prop: "font-stretch", value: "62% 125%" }],
});

const base =
  process.env.NEXT_PUBLIC_RELATIVE_ASSETS === "1"
    ? "."
    : (process.env.NEXT_PUBLIC_BASE_PATH ?? "");

export const metadata: Metadata = {
  title: "ULG: Unlimited Logic Games",
  description:
    "Endless logic puzzles that play offline. Every board is new, and every one has exactly one answer.",
  applicationName: "ULG",
  appleWebApp: {
    capable: true,
    title: "ULG",
    statusBarStyle: "default",
    // iPhone and iPad launch screens (scripts/make-icons.mjs draws them).
    startupImage: splashSizes.map(({ w, h, dpr }) => ({
      url: `${base}/splash/launch-${w * dpr}x${h * dpr}.png`,
      media: `screen and (device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)`,
    })),
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: `${base}/favicon.ico`, sizes: "48x48" },
      {
        url: `${base}/icons/favicon-32.png`,
        sizes: "32x32",
        type: "image/png",
      },
      {
        url: `${base}/icons/icon-192.png`,
        sizes: "192x192",
        type: "image/png",
      },
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

// Vercel Web Analytics only works on Vercel, which serves its script. Vercel sets
// VERCEL=1 during its builds; on any other host the script would 404 on every page.
const onVercel = process.env.VERCEL === "1";

// Browsers can offer the install prompt before React has loaded: keep it for the Install button.
const CATCH_INSTALL = `window.__ulgInstall=null;addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__ulgInstall=e;dispatchEvent(new Event("ulg-installable"))});`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={archivo.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: CATCH_INSTALL }} />
      </head>
      <body>
        {children}
        <AppRuntime />
        {onVercel && <Analytics />}
      </body>
    </html>
  );
}
