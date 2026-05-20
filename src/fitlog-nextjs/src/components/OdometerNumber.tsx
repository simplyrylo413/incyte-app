"use client";

// OdometerNumber — wraps react-odometerjs with SSR-safe dynamic import.
// Uses the train-station theme (loaded globally in layout.tsx).
// Source: https://github.com/bezenson/react-odometerjs

import dynamic from "next/dynamic";

const Odometer = dynamic(() => import("react-odometerjs"), {
  ssr: false,
  loading: () => <span>0</span>,
});

interface Props {
  value: number;
  format?: string;
  duration?: number;
  className?: string;
}

export default function OdometerNumber({
  value,
  format = "d",        // plain integer, no commas
  duration = 400,      // fast — matches INCYTE's 150–300ms UI timing
  className,
}: Props) {
  return (
    <Odometer
      value={value}
      format={format}
      duration={duration}
      className={className}
    />
  );
}
