export type PetalProfilePoint = {
  v: number;
  width: number;
};

export type PetalProfile = {
  stemWidth: number;
  stemEnd: number;
  points: PetalProfilePoint[];
};

export const PETAL_PROFILE_TIP_END = 1;
export const PETAL_PROFILE_TIP_CONTROL_MAX = 0.965;

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

export function sanitizePetalProfilePoints(points: PetalProfilePoint[]) {
  const sorted = points
    .map((point) => ({
      v: clamp(point.v, 0, PETAL_PROFILE_TIP_CONTROL_MAX),
      width: clamp(point.width, 0, 0.6),
    }))
    .sort((a, b) => a.v - b.v);

  return sorted.reduce<PetalProfilePoint[]>((clean, point) => {
    const previous = clean.at(-1);
    if (!previous || point.v - previous.v > 0.001) {
      clean.push(point);
      return clean;
    }
    previous.width = point.width;
    return clean;
  }, []);
}

function segmentSlope(a: PetalProfilePoint, b: PetalProfilePoint) {
  return (b.width - a.width) / Math.max(b.v - a.v, 1e-4);
}

function limitedTangents(points: PetalProfilePoint[]) {
  return points.map((point, index) => {
    const previous = points[index - 1];
    const next = points[index + 1];
    if (!previous || !next) return 0;

    const prevSlope = segmentSlope(previous, point);
    const nextSlope = segmentSlope(point, next);
    if (prevSlope === 0 || nextSlope === 0) return 0;
    if (Math.sign(prevSlope) !== Math.sign(nextSlope)) return 0;

    const tangent = (next.width - previous.width) /
      Math.max(next.v - previous.v, 1e-4);
    const limit = Math.min(Math.abs(prevSlope), Math.abs(nextSlope)) * 3;
    return Math.sign(tangent) * Math.min(Math.abs(tangent), limit);
  });
}

function cubicHermite(
  a: PetalProfilePoint,
  b: PetalProfilePoint,
  tangentA: number,
  tangentB: number,
  v: number,
) {
  const span = Math.max(b.v - a.v, 1e-4);
  const t = clamp((v - a.v) / span, 0, 1);
  const t2 = t * t;
  const t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;
  const width =
    h00 * a.width +
    h10 * span * tangentA +
    h01 * b.width +
    h11 * span * tangentB;
  const minWidth = Math.min(a.width, b.width);
  const maxWidth = Math.max(a.width, b.width);
  return clamp(width, minWidth, maxWidth);
}

function roundedTipCap(a: PetalProfilePoint, v: number) {
  const span = Math.max(PETAL_PROFILE_TIP_END - a.v, 1e-4);
  const t = clamp((v - a.v) / span, 0, 1);
  return a.width * Math.sqrt(Math.max(1 - t * t, 0));
}

export function petalWidthAt(profile: PetalProfile, v: number) {
  const { stemWidth, stemEnd } = profile;
  const cleanPoints = sanitizePetalProfilePoints(profile.points);
  if (v < stemEnd || cleanPoints.length === 0) return stemWidth;

  const anchors = [
    { v: 0, width: stemWidth },
    { v: stemEnd, width: stemWidth },
    ...cleanPoints,
    { v: PETAL_PROFILE_TIP_END, width: 0 },
  ];
  const tangents = limitedTangents(anchors);

  if (v <= anchors[0].v) return anchors[0].width;
  for (let i = 1; i < anchors.length; i++) {
    const a = anchors[i - 1];
    const b = anchors[i];
    if (v > b.v) continue;
    if (i === anchors.length - 1) return roundedTipCap(a, v);
    return Math.max(cubicHermite(a, b, tangents[i - 1], tangents[i], v), 0);
  }

  return 0;
}
