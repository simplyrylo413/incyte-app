"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type ProgressPoint = {
  date: string;
  value: number;
};

export default function ProgressChart({
  data,
  yLabel,
}: {
  data: ProgressPoint[];
  yLabel: string;
}) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-sub">
        No data yet. Finish a workout to populate this chart.
      </p>
    );
  }
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid stroke="#262d35" strokeDasharray="3 3" />
          <XAxis dataKey="date" stroke="#8a93a0" fontSize={11} />
          <YAxis
            stroke="#8a93a0"
            fontSize={11}
            label={{
              value: yLabel,
              angle: -90,
              position: "insideLeft",
              fill: "#8a93a0",
              fontSize: 11,
            }}
          />
          <Tooltip
            contentStyle={{
              background: "#14181d",
              border: "1px solid #262d35",
              fontSize: 12,
              color: "#e6ebf1",
            }}
            labelStyle={{ color: "#8a93a0" }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#7cdcff"
            strokeWidth={2}
            dot={{ r: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
