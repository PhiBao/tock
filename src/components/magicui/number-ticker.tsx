"use client";
import { useEffect, useRef } from "react";
import { useInView, useMotionValue, useSpring } from "framer-motion";

export function NumberTicker({ value, className, decimalPlaces = 2, prefix = "", suffix = "" }: { value: number; className?: string; decimalPlaces?: number; prefix?: string; suffix?: string; }) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, { damping: 60, stiffness: 300 });
  const isInView = useInView(ref, { once: true, margin: "0px" });
  useEffect(() => { if (isInView) motionValue.set(value); }, [motionValue, isInView, value]);
  useEffect(() => springValue.on("change", (latest) => { if (ref.current) ref.current.textContent = prefix + Intl.NumberFormat("en-US", { minimumFractionDigits: decimalPlaces, maximumFractionDigits: decimalPlaces }).format(Number(latest.toFixed(decimalPlaces))) + suffix; }), [springValue, decimalPlaces, prefix, suffix]);
  return <span ref={ref} className={className} />;
}
