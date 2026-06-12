export type PieSegment = {
  key: string;
  label: string;
  value: number;
  color: string;
  detail?: string;
};

export type PositionedPieSegment = PieSegment & {
  midAngle: number;
};

export function buildConicGradient(
  segments: ReadonlyArray<{ value: number; color: string }>,
  total: number,
) {
  if (total <= 0) {
    return "conic-gradient(rgba(255,255,255,0.1) 0deg 360deg)";
  }

  let currentPercent = 0;
  const stops: string[] = [];

  for (const segment of segments) {
    if (segment.value <= 0) continue;

    const slicePercent = (segment.value / total) * 100;
    const nextPercent = currentPercent + slicePercent;
    stops.push(`${segment.color} ${currentPercent}% ${nextPercent}%`);
    currentPercent = nextPercent;
  }

  if (stops.length === 0) {
    return "conic-gradient(rgba(255,255,255,0.1) 0deg 360deg)";
  }

  if (currentPercent < 100) {
    stops.push(`rgba(255,255,255,0.1) ${currentPercent}% 100%`);
  }

  return `conic-gradient(${stops.join(", ")})`;
}

export function positionPieSegments(
  segments: PieSegment[],
  total: number,
): PositionedPieSegment[] {
  if (total <= 0) return [];

  let currentAngle = -90;

  return segments
    .filter((segment) => segment.value > 0)
    .map((segment) => {
      const sweep = (segment.value / total) * 360;
      const midAngle = currentAngle + sweep / 2;
      currentAngle += sweep;

      return {
        ...segment,
        midAngle,
      };
    });
}

export function polarToPercent(angleDeg: number, radiusPercent: number) {
  const angleRad = (angleDeg * Math.PI) / 180;

  return {
    x: 50 + radiusPercent * Math.cos(angleRad),
    y: 50 + radiusPercent * Math.sin(angleRad),
  };
}