"use client";

import {
  buildConicGradient,
  polarToPercent,
  positionPieSegments,
  type PieSegment,
} from "@/app/projects/project-pie-chart-utils";

export default function ExpandablePieCard({
  title,
  segments,
  total,
  centerValue,
  centerLabel,
  emptyMessage,
  glowClassName,
  shellClassName,
  centerValueClassName,
  isExpanded,
  onToggle,
}: {
  title: string;
  segments: PieSegment[];
  total: number;
  centerValue: string;
  centerLabel: string;
  emptyMessage?: string;
  glowClassName: string;
  shellClassName: string;
  centerValueClassName: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const positionedSegments = positionPieSegments(segments, total);
  const gradient = buildConicGradient(segments, total);

  return (
    <div
      className={`rounded-3xl border border-white/10 bg-gradient-to-br p-4 transition-all duration-300 sm:p-5 ${
        isExpanded ? "sm:p-8" : ""
      } ${shellClassName}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.22em] text-neutral-500">
          {title}
        </p>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isExpanded}
          aria-label={
            isExpanded ? `Collapse ${title} details` : `Expand ${title} details`
          }
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-neutral-950/70 text-lg font-semibold text-lime-300 transition hover:border-lime-300/40 hover:bg-lime-400/10"
        >
          {isExpanded ? "−" : "+"}
        </button>
      </div>

      <div
        className={`relative mx-auto mt-4 aspect-square w-full transition-all duration-300 ${
          isExpanded ? "max-w-[22rem]" : "max-w-[9.5rem]"
        }`}
      >
        <div
          className={`absolute inset-[14%] rounded-full transition-shadow duration-300 ${
            isExpanded ? glowClassName : ""
          }`}
          style={{ background: gradient }}
          aria-hidden="true"
        />
        <div className="absolute inset-[30%] flex flex-col items-center justify-center rounded-full border border-white/10 bg-neutral-950/95 text-center shadow-inner">
          <span
            className={`font-bold tracking-tight transition-all duration-300 ${centerValueClassName} ${
              isExpanded ? "text-4xl sm:text-5xl" : "text-2xl sm:text-3xl"
            }`}
          >
            {centerValue}
          </span>
          <span className="mt-1 text-[10px] uppercase tracking-[0.18em] text-neutral-500 sm:text-xs">
            {centerLabel}
          </span>
        </div>

        <div
          className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ${
            isExpanded ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden={!isExpanded}
        >
          <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
            {positionedSegments.map((segment) => {
              const anchor = polarToPercent(segment.midAngle, 34);
              const callout = polarToPercent(segment.midAngle, 47);

              return (
                <line
                  key={`${segment.key}-line`}
                  x1={anchor.x}
                  y1={anchor.y}
                  x2={callout.x}
                  y2={callout.y}
                  stroke={segment.color}
                  strokeOpacity={0.55}
                  strokeWidth="0.6"
                />
              );
            })}
          </svg>

          {positionedSegments.map((segment) => {
            const callout = polarToPercent(segment.midAngle, 49);

            return (
              <div
                key={segment.key}
                className="absolute max-w-[9rem] -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${callout.x}%`, top: `${callout.y}%` }}
              >
                <div className="rounded-2xl border border-white/10 bg-neutral-950/90 px-3 py-2 shadow-lg backdrop-blur-sm">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: segment.color }}
                    />
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
                      {segment.label}
                    </span>
                  </div>
                  <p className="mt-1 text-lg font-bold tabular-nums text-white">
                    {segment.value}
                  </p>
                  {segment.detail ? (
                    <p className="text-[11px] text-neutral-500">{segment.detail}</p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {!isExpanded && total === 0 && emptyMessage ? (
          <p className="absolute inset-x-0 -bottom-1 text-center text-xs text-neutral-500">
            {emptyMessage}
          </p>
        ) : null}
      </div>

      {isExpanded && total === 0 && emptyMessage ? (
        <p className="mt-3 text-center text-sm text-neutral-500">{emptyMessage}</p>
      ) : null}
    </div>
  );
}