"use client";
import confetti from "canvas-confetti";
import { useEffect } from "react";
export function Confetti({ fire }: { fire: boolean }) {
  useEffect(() => {
    if (!fire) return;
    const end = Date.now() + 1200;
    const frame = () => {
      confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors: ["#facc15", "#22c55e", "#ffffff"] });
      confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors: ["#facc15", "#ef4444", "#ffffff"] });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  }, [fire]);
  return null;
}
