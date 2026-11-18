"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LEGACY_IDS } from "@/games/meta";

/**
 * Unknown addresses land here. Old game addresses (from before the games were
 * renamed) move on to the new one, keeping any shared-puzzle link intact.
 */
export function NotFound() {
  const [lost, setLost] = useState(false);

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    let path = window.location.pathname;
    if (base && path.startsWith(base)) path = path.slice(base.length);
    const slug = path.split("/").filter(Boolean)[0];
    const target = slug ? LEGACY_IDS[slug] : undefined;
    if (target) {
      window.location.replace(`${base}/${target}/${window.location.search}${window.location.hash}`);
      return;
    }
    setLost(true);
  }, []);

  return (
    <main className="hub not-found">
      <div className="hub-mark" aria-hidden>
        {["?", "?"].map((ch, i) => (
          <span key={i} className="hub-letter">
            {ch}
          </span>
        ))}
      </div>
      {lost && (
        <>
          <h1>There&rsquo;s no puzzle at this address.</h1>
          <p className="hub-lede">It may have been renamed or never existed. Every game is on the home screen.</p>
          <Link href="/" className="btn primary">
            See all games
          </Link>
        </>
      )}
    </main>
  );
}
