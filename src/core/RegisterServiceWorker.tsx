"use client";

import { useEffect } from "react";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Registers the offline service worker in production builds. */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_RELATIVE_ASSETS === "1") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register(`${BASE}/sw.js`, { scope: `${BASE}/` }).catch(() => {
      /* offline support is a bonus; the game works without it */
    });
  }, []);
  return null;
}
