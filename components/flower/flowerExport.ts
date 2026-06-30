import type { FlowerSceneApi } from "./flowerScene";

// Browser-only export pipeline for the flower studio. All client-side (no
// server, no ffmpeg). The background mode picks the video path:
//   • Solid bg → MP4 — realtime MediaRecorder capture (H.264, opaque). One
//     universal playable file.
//   • Transparent bg → PNG sequence (.zip) — the most editor-compatible
//     transparent asset; rendered deterministically offline and packed into a
//     store-only ZIP written here. Drop into any editor, or transcode to a
//     ProRes 4444 MOV with a single ffmpeg command (MP4/H.264 can't hold alpha).
//   • PNG still — a single high-res frame (either background).
//
// The animation is always: bloom once (eased, scene.bloomDuration seconds) then
// settle into the live wind sway, driven by the absolute time we feed uTime.

export type Background =
  | { mode: "transparent" }
  | { mode: "solid"; color: string };

export type ExportSize = { w: number; h: number } | null;

export type VideoExportOptions = {
  durationMs: number;
  fps: number;
  background: Background;
  size?: ExportSize;
  onProgress?: (progress01: number) => void;
};

export type StillExportOptions = {
  background: Background;
  size?: ExportSize;
};

// ===== shared helpers =====

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("canvas.toBlob() returned null"))),
      type,
    );
  });
}

/** Bloom value for an absolute time into the export timeline. */
function bloomForTime(scene: FlowerSceneApi, tSeconds: number): number {
  return scene.bloomAt(tSeconds / scene.bloomDuration);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ===== MP4 (realtime recording, opaque) =====

/** Best supported recorder container, preferring H.264 MP4, then WebM. */
function pickVideoMime(): { mimeType: string; ext: string } {
  const mp4 = [
    "video/mp4;codecs=avc1.640028",
    "video/mp4;codecs=avc1.42E01E",
    "video/mp4;codecs=avc1",
    "video/mp4",
  ];
  const webm = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  const ok = (t: string) =>
    typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t);
  for (const t of mp4) if (ok(t)) return { mimeType: t, ext: "mp4" };
  for (const t of webm) if (ok(t)) return { mimeType: t, ext: "webm" };
  return { mimeType: "", ext: "webm" };
}

export async function recordVideo(
  scene: FlowerSceneApi,
  { durationMs, fps, background, size, onProgress }: VideoExportOptions,
): Promise<{ blob: Blob; ext: string }> {
  scene.setBackground(background);
  if (size) scene.setExportSize(size.w, size.h);
  scene.pauseLoop();

  const canvas = scene.getCanvas();
  const { mimeType, ext } = pickVideoMime();
  const stream = canvas.captureStream(fps);
  const recorder = new MediaRecorder(
    stream,
    mimeType
      ? { mimeType, videoBitsPerSecond: 16_000_000 }
      : { videoBitsPerSecond: 16_000_000 },
  );
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  const stopped = new Promise<Blob>((resolve) => {
    recorder.onstop = () =>
      resolve(new Blob(chunks, { type: mimeType.split(";")[0] || "video/mp4" }));
  });

  try {
    recorder.start();
    const start = performance.now();
    await new Promise<void>((resolve) => {
      const frame = () => {
        const elapsed = performance.now() - start;
        const t = elapsed / 1000;
        scene.renderFrame(t, bloomForTime(scene, t));
        onProgress?.(Math.min(elapsed / durationMs, 1));
        if (elapsed >= durationMs) resolve();
        else requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
    recorder.stop();
    const blob = await stopped;
    return { blob, ext };
  } finally {
    stream.getTracks().forEach((track) => track.stop());
    scene.resumeLoop();
    if (size) scene.restoreSize();
  }
}

// ===== PNG sequence (offline, deterministic) =====

export async function exportPngSequence(
  scene: FlowerSceneApi,
  { durationMs, fps, background, size, onProgress }: VideoExportOptions,
): Promise<Blob> {
  scene.setBackground(background);
  if (size) scene.setExportSize(size.w, size.h);
  scene.pauseLoop();

  const canvas = scene.getCanvas();
  const frameCount = Math.max(1, Math.round((durationMs / 1000) * fps));
  const files: { name: string; data: Uint8Array }[] = [];

  try {
    for (let i = 0; i < frameCount; i++) {
      const t = i / fps;
      scene.renderFrame(t, bloomForTime(scene, t));
      const blob = await canvasToBlob(canvas, "image/png");
      const data = new Uint8Array(await blob.arrayBuffer());
      files.push({ name: `flower_${String(i).padStart(4, "0")}.png`, data });
      onProgress?.((i + 1) / frameCount);
    }
    return buildStoreZip(files);
  } finally {
    scene.resumeLoop();
    if (size) scene.restoreSize();
  }
}

// ===== PNG still =====

export async function exportPngStill(
  scene: FlowerSceneApi,
  { background, size }: StillExportOptions,
): Promise<Blob> {
  scene.setBackground(background);
  if (size) scene.setExportSize(size.w, size.h);
  scene.pauseLoop();
  try {
    // Capture a fully-open flower in a natural wind pose.
    scene.renderFrame(performance.now() / 1000, scene.bloomMax);
    return await canvasToBlob(scene.getCanvas(), "image/png");
  } finally {
    scene.resumeLoop();
    if (size) scene.restoreSize();
  }
}

// ===== minimal store-only ZIP (no compression, no dependency) =====

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function buildStoreZip(files: { name: string; data: Uint8Array }[]): Blob {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const crc = crc32(file.data);
    const size = file.data.length;

    const local = new Uint8Array(30 + nameBytes.length);
    const ldv = new DataView(local.buffer);
    ldv.setUint32(0, 0x04034b50, true); // local file header signature
    ldv.setUint16(4, 20, true); // version needed
    ldv.setUint16(6, 0, true); // flags
    ldv.setUint16(8, 0, true); // method 0 = store
    ldv.setUint16(10, 0, true); // mod time
    ldv.setUint16(12, 0, true); // mod date
    ldv.setUint32(14, crc, true);
    ldv.setUint32(18, size, true); // compressed size
    ldv.setUint32(22, size, true); // uncompressed size
    ldv.setUint16(26, nameBytes.length, true);
    ldv.setUint16(28, 0, true); // extra length
    local.set(nameBytes, 30);
    localParts.push(local, file.data);

    const central = new Uint8Array(46 + nameBytes.length);
    const cdv = new DataView(central.buffer);
    cdv.setUint32(0, 0x02014b50, true); // central dir header signature
    cdv.setUint16(4, 20, true); // version made by
    cdv.setUint16(6, 20, true); // version needed
    cdv.setUint16(8, 0, true); // flags
    cdv.setUint16(10, 0, true); // method
    cdv.setUint16(12, 0, true); // mod time
    cdv.setUint16(14, 0, true); // mod date
    cdv.setUint32(16, crc, true);
    cdv.setUint32(20, size, true);
    cdv.setUint32(24, size, true);
    cdv.setUint16(28, nameBytes.length, true);
    cdv.setUint16(30, 0, true); // extra length
    cdv.setUint16(32, 0, true); // comment length
    cdv.setUint16(34, 0, true); // disk number
    cdv.setUint16(36, 0, true); // internal attrs
    cdv.setUint32(38, 0, true); // external attrs
    cdv.setUint32(42, offset, true); // local header offset
    central.set(nameBytes, 46);
    centralParts.push(central);

    offset += local.length + size;
  }

  const centralSize = centralParts.reduce((sum, c) => sum + c.length, 0);
  const eocd = new Uint8Array(22);
  const edv = new DataView(eocd.buffer);
  edv.setUint32(0, 0x06054b50, true); // end of central dir signature
  edv.setUint16(4, 0, true); // disk number
  edv.setUint16(6, 0, true); // central dir start disk
  edv.setUint16(8, files.length, true); // records on this disk
  edv.setUint16(10, files.length, true); // total records
  edv.setUint32(12, centralSize, true);
  edv.setUint32(16, offset, true); // central dir offset
  edv.setUint16(20, 0, true); // comment length

  const parts = [...localParts, ...centralParts, eocd];
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const part of parts) {
    out.set(part, pos);
    pos += part.length;
  }
  return new Blob([out], { type: "application/zip" });
}
