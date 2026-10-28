"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function AppError({ error, reset }) {
  useEffect(() => {
    console.error("Movie Verse page error:", error);
  }, [error]);

  return (
    <section className="empty-page">
      <p className="empty-mark">Movie Verse</p>
      <h1>We couldn’t load this page.</h1>
      <p>Please try again. If the problem continues, check that movie data is configured.</p>
      <div className="button-row">
        <button className="button button-light" onClick={reset}>Try again</button>
        <Link className="button button-quiet" href="/">Go to discovery</Link>
      </div>
    </section>
  );
}
