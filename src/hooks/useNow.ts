"use client";

import { useEffect, useState } from "react";

/** Shared ticking clock (seconds, fractional). One interval per consumer. */
export function useNow(stepMs = 1000): number {
  const [now, setNow] = useState(() => Date.now() / 1000);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() / 1000), stepMs);
    return () => clearInterval(id);
  }, [stepMs]);
  return now;
}
