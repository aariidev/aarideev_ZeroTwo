import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AttachmentBuilder } from "discord.js";

const FILE_MAP: Record<string, string> = {
  main: "rizYS.jpg",
  Utilidad: "rizYS.jpg",
  Moderación: "moderation.jpg",
  Diversión: "fun.jpg",
  Casino: "casino.jpg",
  /** Dev / owner panel embeds */
  dev: "dev.jpg",
  /** Minijuegos: 8ball, poker, ship… */
  fun: "fun.jpg",
  info: "info02.jpg",
};

export type AssetKey = keyof typeof FILE_MAP | string;

/**
 * Candidate roots for assets/help (monorepo + package + cwd).
 * Order: monorepo root first, then package-local, then walk from this file / cwd.
 */
function assetSearchRoots(): string[] {
  const roots = new Set<string>();
  const add = (p: string) => {
    try {
      const resolved = path.resolve(p);
      if (fs.existsSync(resolved)) roots.add(resolved);
    } catch {
      /* ignore */
    }
  };

  // Known monorepo layout: H:\Discord\02\assets\help
  add(path.join(process.cwd(), "assets", "help"));
  add(path.join(process.cwd(), "..", "assets", "help"));
  add(path.join(process.cwd(), "..", "..", "assets", "help"));
  add(path.join(process.cwd(), "..", "..", "..", "assets", "help"));

  // From this module (src or bundled — walk up)
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 10; i++) {
    add(path.join(dir, "assets", "help"));
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  // Absolute fallback used in this project
  add("H:\\Discord\\02\\assets\\help");

  return [...roots];
}

/** Directory that actually contains at least one known asset file */
export function helpAssetsDir(): string {
  const known = Object.values(FILE_MAP);
  for (const root of assetSearchRoots()) {
    if (known.some((f) => fs.existsSync(path.join(root, f)))) {
      return root;
    }
  }
  // Last resort
  return path.join(process.cwd(), "assets", "help");
}

/** Resolve a single image file by key or filename */
export function resolveAssetPath(keyOrFile: string): string | null {
  const name =
    FILE_MAP[keyOrFile] ??
    (keyOrFile.includes(".") ? keyOrFile : `${keyOrFile}.jpg`);

  for (const root of assetSearchRoots()) {
    const full = path.join(root, name);
    if (fs.existsSync(full)) return full;
  }
  return null;
}

export function assetImage(key: AssetKey): {
  file: AttachmentBuilder | null;
  url: string | null;
  name: string | null;
  path: string | null;
} {
  const name =
    FILE_MAP[key] ??
    (typeof key === "string" && key.includes(".") ? key : null);
  if (!name) return { file: null, url: null, name: null, path: null };

  const full = resolveAssetPath(key);
  if (!full) {
    return { file: null, url: null, name: null, path: null };
  }

  // Use a stable attachment name so attachment:// works with setImage
  return {
    file: new AttachmentBuilder(full, { name }),
    url: `attachment://${name}`,
    name,
    path: full,
  };
}

export function helpImageFor(section: string): {
  file: AttachmentBuilder | null;
  url: string | null;
} {
  const img = assetImage(section);
  return { file: img.file, url: img.url };
}
