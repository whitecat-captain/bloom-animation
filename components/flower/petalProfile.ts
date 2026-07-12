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
// Fixed W-only handles, evenly distributed from the stem to the rounded cap.
export const PETAL_PROFILE_CONTROL_VS = [
  0.225,
  0.41,
  0.595,
  0.78,
  PETAL_PROFILE_TIP_CONTROL_MAX,
] as const;

export function petalProfilePointsFromWidths(widths: readonly number[]) {
  return PETAL_PROFILE_CONTROL_VS.map((v, index) => ({
    v,
    width: widths[index] ?? 0,
  }));
}

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

function catmullRom(values: number[], t: number) {
  const last = values.length - 1;
  const scaled = Math.min(clamp(t, 0, 1) * last, last - 1e-6);
  const index = Math.floor(scaled);
  const local = scaled - index;
  const p0 = values[Math.max(index - 1, 0)];
  const p1 = values[index];
  const p2 = values[index + 1];
  const p3 = values[Math.min(index + 2, last)];
  const local2 = local * local;
  const local3 = local2 * local;
  return 0.5 * (
    2 * p1 +
    (-p0 + p2) * local +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * local2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * local3
  );
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

  const tipControl = cleanPoints[cleanPoints.length - 1];
  if (v <= tipControl.v) {
    const bodyT = (v - stemEnd) / Math.max(tipControl.v - stemEnd, 1e-4);
    return Math.max(
      catmullRom(
        [stemWidth, ...cleanPoints.map((point) => point.width)],
        bodyT,
      ),
      0,
    );
  }
  return roundedTipCap(tipControl, v);
}
