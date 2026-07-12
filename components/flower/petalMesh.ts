export type PetalUvTopology = {
  indices: number[];
  uvs: number[];
};

export function createPetalUvTopology(
  xSegments: number,
  ySegments: number,
): PetalUvTopology {
  const indices: number[] = [];
  const uvs: number[] = [];
  const row = xSegments + 1;

  for (let y = 0; y < ySegments; y++) {
    const v = y / ySegments;
    for (let x = 0; x <= xSegments; x++) {
      uvs.push(x / xSegments, v);
    }
  }
  const tipIndex = uvs.length / 2;
  uvs.push(0.5, 1);

  for (let y = 0; y < ySegments - 1; y++) {
    for (let x = 0; x < xSegments; x++) {
      const a = y * row + x;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const lastRow = (ySegments - 1) * row;
  for (let x = 0; x < xSegments; x++) {
    indices.push(lastRow + x, tipIndex, lastRow + x + 1);
  }

  return { indices, uvs };
}
