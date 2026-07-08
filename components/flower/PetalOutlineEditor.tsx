"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { PetalShapeState } from "./flowerScene";
import {
  PETAL_PROFILE_TIP_CONTROL_MAX,
  petalWidthAt,
  type PetalProfilePoint,
} from "./petalProfile";

type PaletteStops = [number, number, number][];
type ProfileTuple = [
  PetalProfilePoint,
  PetalProfilePoint,
  PetalProfilePoint,
  PetalProfilePoint,
  PetalProfilePoint,
];
type OutlineChange = {
  petalLen: number;
  widths: [number, number, number, number, number];
  positions: [number, number, number, number, number];
};
type PetalDrag = { kind: "length" } | { kind: "point"; index: number };
type PetalHandle = { x: number; y: number; drag: PetalDrag };
type PetalLayout = {
  bottom: number;
  centerX: number;
  lengthPx: number;
  maxLengthPx: number;
  widthScale: number;
};

const STEM_END = 0.04;
const STEM_WIDTH = 0.03;
const WIDTH_MIN = 0;
const WIDTH_MAX = 0.6;
const LENGTH_MIN = 0.3;
const LENGTH_MAX = 1.5;
const LENGTH_MIN_DRAW_RATIO = 0.46;
const POINT_MIN_GAP = 0.025;
const HIT_RADIUS = 18;

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

function petalHalfWidth(v: number, shape: PetalShapeState) {
  return petalWidthAt(
    {
      stemWidth: STEM_WIDTH,
      stemEnd: STEM_END,
      points: profilePoints(shape),
    },
    v,
  );
}

function mixStop(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
) {
  const k = clamp(t, 0, 1);
  return [
    a[0] + (b[0] - a[0]) * k,
    a[1] + (b[1] - a[1]) * k,
    a[2] + (b[2] - a[2]) * k,
  ] as [number, number, number];
}

function rgba(stop: [number, number, number], alpha: number) {
  return `rgba(${Math.round(stop[0] * 255)}, ${Math.round(stop[1] * 255)}, ${Math.round(stop[2] * 255)}, ${alpha})`;
}

function profilePoints(shape: PetalShapeState): ProfileTuple {
  return [
    { v: shape.v0, width: shape.w0 },
    { v: shape.v1, width: shape.w1 },
    { v: shape.v2, width: shape.w2 },
    { v: shape.v3, width: shape.w3 },
    { v: shape.v4, width: shape.w4 },
  ];
}

function widthTuple(shape: PetalShapeState): OutlineChange["widths"] {
  return [shape.w0, shape.w1, shape.w2, shape.w3, shape.w4];
}

function positionTuple(shape: PetalShapeState): OutlineChange["positions"] {
  return [shape.v0, shape.v1, shape.v2, shape.v3, shape.v4];
}

function shapeWithProfile(
  shape: PetalShapeState,
  points: ProfileTuple,
): PetalShapeState {
  return {
    ...shape,
    v0: points[0].v,
    w0: points[0].width,
    v1: points[1].v,
    w1: points[1].width,
    v2: points[2].v,
    w2: points[2].width,
    v3: points[3].v,
    w3: points[3].width,
    v4: points[4].v,
    w4: points[4].width,
  };
}

function lengthToDrawRatio(petalLen: number) {
  const t = (clamp(petalLen, LENGTH_MIN, LENGTH_MAX) - LENGTH_MIN) /
    (LENGTH_MAX - LENGTH_MIN);
  return LENGTH_MIN_DRAW_RATIO + t * (1 - LENGTH_MIN_DRAW_RATIO);
}

function drawRatioToLength(ratio: number) {
  const t =
    (clamp(ratio, LENGTH_MIN_DRAW_RATIO, 1) - LENGTH_MIN_DRAW_RATIO) /
    (1 - LENGTH_MIN_DRAW_RATIO);
  return LENGTH_MIN + t * (LENGTH_MAX - LENGTH_MIN);
}

function drawOutline(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  shape: PetalShapeState,
  palette: PaletteStops,
  handlesRef: { current: PetalHandle[] },
  layoutRef: { current: PetalLayout },
  activeDrag: PetalDrag | null,
) {
  ctx.clearRect(0, 0, w, h);

  const points = profilePoints(shape);
  const padX = 18;
  const padY = 12;
  const bottom = h - padY;
  const maxLengthPx = Math.max(h - padY * 2, 1);
  const lengthPx = Math.max(maxLengthPx * lengthToDrawRatio(shape.petalLen), 1);
  const top = bottom - lengthPx;
  const centerX = w * 0.5;
  const widthScale = Math.max(
    1,
    Math.min(maxLengthPx * 0.86, (w * 0.5 - padX) / WIDTH_MAX),
  );
  layoutRef.current = { bottom, centerX, lengthPx, maxLengthPx, widthScale };

  const samples = 88;
  const right: [number, number][] = [];
  const left: [number, number][] = [];
  for (let i = 0; i <= samples; i++) {
    const v = i / samples;
    const halfWidth = petalHalfWidth(v, shape) * widthScale;
    const y = bottom - v * lengthPx;
    right.push([centerX + halfWidth, y]);
    left.push([centerX - halfWidth, y]);
  }

  const tip = palette[0] ?? [0.05, 0.2, 0.65];
  const shoulder = palette[1] ?? tip;
  const base = palette[2] ?? shoulder;
  const handleColor = mixStop(shoulder, base, 0.28);
  const lengthHandleColor = mixStop(tip, shoulder, 0.22);
  const fill = ctx.createLinearGradient(0, bottom, 0, top);
  fill.addColorStop(0, rgba(base, 0.44));
  fill.addColorStop(0.45, rgba(shoulder, 0.34));
  fill.addColorStop(1, rgba(tip, 0.5));

  ctx.beginPath();
  right.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  for (let i = left.length - 1; i >= 0; i--) ctx.lineTo(left[i][0], left[i][1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(shoulder, 0.68);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(centerX, bottom);
  ctx.lineTo(centerX, top);
  ctx.setLineDash([3, 4]);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
  ctx.stroke();
  ctx.setLineDash([]);

  const handles: PetalHandle[] = [{ x: centerX, y: top, drag: { kind: "length" } }];

  const lengthActive = activeDrag?.kind === "length";
  ctx.beginPath();
  ctx.arc(centerX, top, lengthActive ? 6 : 4.8, 0, Math.PI * 2);
  ctx.fillStyle = lengthActive
    ? "rgba(255, 255, 255, 0.95)"
    : rgba(lengthHandleColor, 0.96);
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(5, 7, 15, 0.76)";
  ctx.stroke();

  for (let index = 0; index < points.length; index++) {
    const { v, width } = points[index];
    const x = centerX + width * widthScale;
    const y = bottom - v * lengthPx;
    handles.push({ x, y, drag: { kind: "point", index } });

    ctx.beginPath();
    ctx.moveTo(centerX, y);
    ctx.lineTo(x, y);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
    ctx.stroke();

    const active = activeDrag?.kind === "point" && activeDrag.index === index;
    ctx.beginPath();
    ctx.arc(x, y, active ? 6 : 4.5, 0, Math.PI * 2);
    ctx.fillStyle = active ? "rgba(255, 255, 255, 0.95)" : rgba(handleColor, 0.96);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(5, 7, 15, 0.76)";
    ctx.stroke();
  }

  handlesRef.current = handles;
}

export default function PetalOutlineEditor({
  shape,
  palette,
  onOutlineChange,
}: {
  shape: PetalShapeState;
  palette: PaletteStops;
  onOutlineChange: (outline: OutlineChange) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shapeRef = useRef(shape);
  const paletteRef = useRef(palette);
  const onOutlineChangeRef = useRef(onOutlineChange);
  const handlesRef = useRef<PetalHandle[]>([]);
  const layoutRef = useRef<PetalLayout>({
    bottom: 0,
    centerX: 0,
    lengthPx: 1,
    maxLengthPx: 1,
    widthScale: 1,
  });
  const dragRef = useRef<PetalDrag | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    const nextWidth = Math.round(width * dpr);
    const nextHeight = Math.round(height * dpr);
    if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
      canvas.width = nextWidth;
      canvas.height = nextHeight;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawOutline(
      ctx,
      width,
      height,
      shapeRef.current,
      paletteRef.current,
      handlesRef,
      layoutRef,
      dragRef.current,
    );
  }, []);

  useEffect(() => {
    shapeRef.current = shape;
    draw();
  }, [shape, draw]);

  useEffect(() => {
    paletteRef.current = palette;
    draw();
  }, [palette, draw]);

  useEffect(() => {
    onOutlineChangeRef.current = onOutlineChange;
  }, [onOutlineChange]);

  useEffect(() => {
    draw();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [draw]);

  const emitOutlineChange = (nextShape: PetalShapeState) => {
    shapeRef.current = nextShape;
    onOutlineChangeRef.current({
      petalLen: nextShape.petalLen,
      widths: widthTuple(nextShape),
      positions: positionTuple(nextShape),
    });
  };

  const stopDrag = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    updateCursor(event);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {}
    draw();
  };

  const findDragTarget = (x: number, y: number) => {
    let bestDrag: PetalDrag | null = null;
    let bestDistance = HIT_RADIUS;

    handlesRef.current.forEach((handle) => {
      const distance = Math.hypot(handle.x - x, handle.y - y);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestDrag = handle.drag;
      }
    });

    return bestDrag;
  };

  const cursorForDrag = (drag: PetalDrag | null) => {
    if (!drag) return "default";
    return drag.kind === "length" ? "ns-resize" : "move";
  };

  const updateCursor = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (dragRef.current) {
      canvas.style.cursor = cursorForDrag(dragRef.current);
      return;
    }
    const rect = canvas.getBoundingClientRect();
    canvas.style.cursor = cursorForDrag(
      findDragTarget(event.clientX - rect.left, event.clientY - rect.top),
    );
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const bestDrag = findDragTarget(x, y);

    if (!bestDrag) return;
    event.preventDefault();
    dragRef.current = bestDrag;
    canvas.style.cursor = cursorForDrag(bestDrag);
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {}
    draw();
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!drag) {
      updateCursor(event);
      return;
    }
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    const { bottom, centerX, lengthPx, maxLengthPx, widthScale } =
      layoutRef.current;

    if (drag.kind === "length") {
      const nextPetalLen = drawRatioToLength((bottom - localY) / maxLengthPx);
      if (Math.abs(shapeRef.current.petalLen - nextPetalLen) < 0.001) return;
      emitOutlineChange({
        ...shapeRef.current,
        petalLen: nextPetalLen,
      });
      draw();
      return;
    }

    const nextWidth = clamp(
      (localX - centerX) / widthScale,
      WIDTH_MIN,
      WIDTH_MAX,
    );
    const nextPoints = profilePoints(shapeRef.current);
    const index = drag.index;
    const lower = index === 0
      ? STEM_END + POINT_MIN_GAP
      : nextPoints[index - 1].v + POINT_MIN_GAP;
    const upper = index === nextPoints.length - 1
      ? PETAL_PROFILE_TIP_CONTROL_MAX
      : nextPoints[index + 1].v - POINT_MIN_GAP;
    const nextV = clamp((bottom - localY) / lengthPx, lower, upper);
    if (
      Math.abs(nextPoints[index].width - nextWidth) < 0.001 &&
      Math.abs(nextPoints[index].v - nextV) < 0.001
    ) return;
    nextPoints[index] = { v: nextV, width: nextWidth };
    emitOutlineChange(shapeWithProfile(shapeRef.current, nextPoints));
    draw();
  };

  return (
    <div className="studio-outline-editor" aria-label="Interactive petal outline editor">
      <span className="studio-outline-editor-hint">Drag points to adjust</span>
      <canvas
        ref={canvasRef}
        className="studio-outline-editor-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
        onPointerLeave={updateCursor}
      />
    </div>
  );
}
