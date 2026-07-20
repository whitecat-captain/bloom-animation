import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function flowerDataPath() {
  const configuredHome = process.env.CODEX_HOME?.trim();
  const codexHome = configuredHome
    ? resolve(configuredHome)
    : join(homedir(), ".codex");
  return join(codexHome, "flower-reference-to-web", "flowers.json");
}

export async function GET() {
  try {
    const stored = JSON.parse(await readFile(flowerDataPath(), "utf8"));
    const flowers = Array.isArray(stored?.flowers) ? stored.flowers : [];
    return Response.json(
      { flowers },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || error instanceof SyntaxError) {
      return Response.json(
        { flowers: [] },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    return Response.json({ flowers: [] }, { status: 500 });
  }
}
