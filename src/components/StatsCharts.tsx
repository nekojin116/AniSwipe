import { useId } from "react";
import type { Bucket, Slice, YearPoint } from "../lib/stats";

export const CHART_COLORS = [
  "#e11d48",
  "#f59e0b",
  "#0ea5e9",
  "#8b5cf6",
  "#10b981",
  "#f97316",
  "#64748b",
];

const NF = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
const NF0 = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

export type YearMetric = "titles" | "amount" | "score";

export function EmptyChart({ label }: { label: string }) {
  return (
    <div className="mt-3 flex h-40 items-center justify-center rounded-xl border border-dashed border-stone-900/10 px-4 text-center text-xs text-stone-400">
      {label}
    </div>
  );
}

/* --------------------------------- Bar chart ------------------------------- */

export function BarChart({ data, label }: { data: Bucket[]; label: string }) {
  if (data.every((bucket) => bucket.value === 0)) {
    return <EmptyChart label="Complete a few titles and this chart fills in." />;
  }

  const width = 640;
  const height = 230;
  const top = 30;
  const bottom = 34;
  const side = 14;
  const innerWidth = width - side * 2;
  const innerHeight = height - top - bottom;
  const max = Math.max(1, ...data.map((bucket) => bucket.value));
  const slot = innerWidth / data.length;
  const barWidth = Math.min(54, slot * 0.44);
  const baseline = top + innerHeight;

  return (
    <div className="no-scrollbar -mx-1 mt-2 overflow-x-auto px-1">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full min-w-[500px]"
        role="img"
        aria-label={`${label} distribution`}
      >
        {[0.5, 1].map((tick) => (
          <line
            key={tick}
            x1={side}
            x2={width - side}
            y1={top + innerHeight * (1 - tick)}
            y2={top + innerHeight * (1 - tick)}
            stroke="#1c1917"
            strokeOpacity={tick === 1 ? 0.12 : 0.06}
          />
        ))}
        {data.map((bucket, index) => {
          const barHeight = (bucket.value / max) * innerHeight;
          const x = side + slot * index + (slot - barWidth) / 2;
          const drawnHeight = Math.max(barHeight, 2);
          return (
            <g key={bucket.label}>
              <rect
                x={x}
                y={baseline - drawnHeight}
                width={barWidth}
                height={drawnHeight}
                rx={5}
                fill="#e11d48"
                fillOpacity={bucket.value === 0 ? 0.14 : 0.85}
              >
                <title>{`${bucket.label}: ${bucket.value}`}</title>
              </rect>
              <text
                x={x + barWidth / 2}
                y={baseline - drawnHeight - 8}
                textAnchor="middle"
                fontSize={12}
                fontWeight={600}
                fill={bucket.value === 0 ? "#a8a29e" : "#44403c"}
              >
                {bucket.value}
              </text>
              <text
                x={x + barWidth / 2}
                y={height - 9}
                textAnchor="middle"
                fontSize={12}
                fill="#78716c"
              >
                {bucket.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* --------------------------------- Donut ---------------------------------- */

function DonutChart({
  data,
  centerLabel,
  label,
}: {
  data: Slice[];
  centerLabel: string;
  label: string;
}) {
  const total = data.reduce((sum, slice) => sum + slice.value, 0);
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const gap = data.length > 1 ? 3 : 0;
  let offset = 0;

  return (
    <svg
      viewBox="0 0 140 140"
      className="h-32 w-32 shrink-0"
      role="img"
      aria-label={`${label} breakdown`}
    >
      <circle
        cx="70"
        cy="70"
        r={radius}
        fill="none"
        stroke="#1c1917"
        strokeOpacity="0.06"
        strokeWidth="17"
      />
      {data.map((slice, index) => {
        const fraction = total > 0 ? slice.value / total : 0;
        const length = Math.max(0, fraction * circumference - gap);
        const dash = `${length} ${Math.max(0, circumference - length)}`;
        const color = CHART_COLORS[index % CHART_COLORS.length];
        const circle = (
          <circle
            key={slice.key}
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="17"
            strokeDasharray={dash}
            strokeDashoffset={-offset}
            transform="rotate(-90 70 70)"
          >
            <title>{`${slice.label}: ${slice.value} (${Math.round(fraction * 100)}%)`}</title>
          </circle>
        );
        offset += fraction * circumference;
        return circle;
      })}
      <text
        x="70"
        y="67"
        textAnchor="middle"
        fontSize="22"
        fontWeight="700"
        fill="#1c1917"
      >
        {NF0.format(total)}
      </text>
      <text
        x="70"
        y="83"
        textAnchor="middle"
        fontSize="8"
        letterSpacing="1.2"
        fill="#78716c"
      >
        {centerLabel.toUpperCase()}
      </text>
    </svg>
  );
}

/* ----------------------------- Distribution card --------------------------- */

export function DistributionCard({
  title,
  data,
  emptyLabel,
}: {
  title: string;
  data: Slice[];
  emptyLabel: string;
}) {
  const total = data.reduce((sum, slice) => sum + slice.value, 0);

  return (
    <section className="glass rounded-2xl p-4">
      <h2 className="font-display text-sm font-semibold text-stone-900">{title}</h2>
      {total === 0 ? (
        <p className="mt-6 text-xs text-stone-400">{emptyLabel}</p>
      ) : (
        <div className="mt-3 flex items-center gap-4">
          <DonutChart data={data} centerLabel="total" label={title} />
          <ul className="min-w-0 flex-1 space-y-2">
            {data.map((slice, index) => {
              const percent = Math.round((slice.value / total) * 100);
              const color = CHART_COLORS[index % CHART_COLORS.length];
              return (
                <li key={slice.key}>
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="flex min-w-0 items-center gap-1.5 text-stone-600">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span className="truncate">{slice.label}</span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-stone-700">
                      {percent}%
                    </span>
                  </div>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-stone-900/5">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(percent, 2)}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

/* -------------------------------- Year chart ------------------------------- */

function niceCeil(value: number): number {
  if (value <= 5) return 5;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

export function YearChart({
  points,
  metric,
  amountLabel,
}: {
  points: YearPoint[];
  metric: YearMetric;
  amountLabel: string;
}) {
  const gradientId = useId().replaceAll(":", "");

  const valueOf = (point: YearPoint): number | null => {
    if (metric === "score") return point.meanScore;
    if (metric === "amount") return point.amount;
    return point.titles;
  };

  const defined = points
    .map((point, index) => ({ point, index, value: valueOf(point) }))
    .filter(
      (item): item is { point: YearPoint; index: number; value: number } => {
        if (item.value === null || !Number.isFinite(item.value)) return false;
        // Titles/hours are zero for gap years inside the range; don't draw
        // baseline dots for them — connect the years that actually have data.
        return metric === "score" || item.value > 0;
      },
    );

  if (points.length === 0 || defined.length === 0) {
    return (
      <EmptyChart
        label={
          metric === "score"
            ? "Score a few completed titles to chart your mean score by year."
            : "No completed titles with a release year yet."
        }
      />
    );
  }

  const width = 720;
  const height = 240;
  const pad = { top: 18, right: 14, bottom: 30, left: 40 };
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = height - pad.top - pad.bottom;
  const baseline = pad.top + innerHeight;

  const maxValue = Math.max(1, ...defined.map((item) => item.value));
  const max = metric === "score" ? 100 : niceCeil(maxValue * 1.05);
  const count = points.length;
  const x = (index: number) =>
    pad.left + (count <= 1 ? innerWidth / 2 : (index / (count - 1)) * innerWidth);
  const y = (value: number) =>
    pad.top + innerHeight - (Math.min(value, max) / max) * innerHeight;

  const line = defined
    .map((item, lineIndex) => `${lineIndex === 0 ? "M" : "L"}${x(item.index).toFixed(1)},${y(item.value).toFixed(1)}`)
    .join(" ");
  const area =
    defined.length > 1
      ? `${line} L${x(defined[defined.length - 1].index).toFixed(1)},${baseline} L${x(defined[0].index).toFixed(1)},${baseline} Z`
      : "";

  const labelStep = Math.max(1, Math.ceil(count / 9));
  const metricLabel =
    metric === "score" ? "Mean score" : metric === "amount" ? amountLabel : "Titles";

  const tickFormat = (value: number) => {
    if (metric === "score") return NF0.format(value);
    if (metric === "titles") {
      return Number.isInteger(value) ? NF0.format(value) : NF.format(value);
    }
    return NF.format(value);
  };

  return (
    <div className="no-scrollbar -mx-1 mt-3 overflow-x-auto px-1">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full min-w-[520px]"
        role="img"
        aria-label={`Release year chart by ${metricLabel.toLowerCase()}`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e11d48" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#e11d48" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0, 0.5, 1].map((tick) => {
          const lineY = pad.top + innerHeight - tick * innerHeight;
          return (
            <g key={tick}>
              <line
                x1={pad.left}
                x2={width - pad.right}
                y1={lineY}
                y2={lineY}
                stroke="#1c1917"
                strokeOpacity={tick === 0 ? 0.12 : 0.06}
              />
              <text
                x={pad.left - 8}
                y={lineY + 4}
                textAnchor="end"
                fontSize={11}
                fill="#a8a29e"
              >
                {tickFormat(max * tick)}
              </text>
            </g>
          );
        })}

        {area && <path d={area} fill={`url(#${gradientId})`} />}
        {defined.length > 1 && (
          <path
            d={line}
            fill="none"
            stroke="#e11d48"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {points.map((point, index) => {
          if (index % labelStep !== 0 && index !== count - 1) return null;
          return (
            <text
              key={`x-${point.year}`}
              x={x(index)}
              y={height - 9}
              textAnchor="middle"
              fontSize={11}
              fill="#78716c"
            >
              {point.year}
            </text>
          );
        })}

        {defined.map((item) => (
          <circle
            key={`dot-${item.point.year}`}
            cx={x(item.index)}
            cy={y(item.value)}
            r={3.4}
            fill="#ffffff"
            stroke="#e11d48"
            strokeWidth={2.2}
          >
            <title>{`${item.point.year} · ${metricLabel} ${tickFormat(item.value)}`}</title>
          </circle>
        ))}
      </svg>
    </div>
  );
}
