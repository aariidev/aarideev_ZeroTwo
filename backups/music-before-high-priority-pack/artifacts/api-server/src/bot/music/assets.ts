/**
 * Banner animado para embeds de música (GIF local → attachment://).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AttachmentBuilder } from "discord.js";

export const MUSIC_BANNER_NAME = "music-banner.gif";

function bannerSearchPaths(): string[] {
  const names = ["banner.gif", MUSIC_BANNER_NAME];
  const roots: string[] = [];
  const addRoot = (dir: string) => {
    try {
      const r = path.resolve(dir);
      if (fs.existsSync(r)) roots.push(r);
    } catch {
      /* ignore */
    }
  };

  addRoot(path.join(process.cwd(), "assets", "music"));
  addRoot(path.join(process.cwd(), "..", "assets", "music"));
  addRoot(path.join(process.cwd(), "..", "..", "assets", "music"));
  addRoot(path.join(process.cwd(), "artifacts", "api-server", "assets", "music"));
  addRoot(path.join(process.cwd(), "assets", "help")); // fallback: separador.gif parent uses separador
  addRoot(path.join(process.cwd(), "assets"));

  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 10; i++) {
    addRoot(path.join(dir, "assets", "music"));
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  addRoot("H:\\Discord\\02\\assets\\music");
  addRoot("H:\\Discord\\02\\artifacts\\api-server\\assets\\music");
  addRoot("H:\\Discord\\02\\assets");

  const files: string[] = [];
  for (const root of roots) {
    for (const name of names) {
      files.push(path.join(root, name));
    }
    // also allow the README separator gif as last-resort branding
    files.push(path.join(root, "separador.gif"));
  }
  return files;
}

export function resolveMusicBannerPath(): string | null {
  for (const p of bannerSearchPaths()) {
    try {
      if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
    } catch {
      /* ignore */
    }
  }
  return null;
}

/** Attachment + attachment:// URL for embed.setImage */
export function musicBanner(): {
  file: AttachmentBuilder | null;
  url: string | null;
  path: string | null;
} {
  const full = resolveMusicBannerPath();
  if (!full) return { file: null, url: null, path: null };
  return {
    file: new AttachmentBuilder(full, { name: MUSIC_BANNER_NAME }),
    url: `attachment://${MUSIC_BANNER_NAME}`,
    path: full,
  };
}

/** Files array ready for message options (empty if missing). */
export function musicBannerFiles(): AttachmentBuilder[] {
  const { file } = musicBanner();
  return file ? [file] : [];
}
