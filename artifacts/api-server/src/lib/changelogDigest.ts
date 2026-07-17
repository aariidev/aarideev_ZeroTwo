import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { logger } from "./logger.js";

const execFileAsync = promisify(execFile);

function findRepoRoot(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, ".git"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // dist → api-server → artifacts → repo
  return path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../..",
  );
}

const REPO_ROOT = findRepoRoot();

async function git(
  args: string[],
  timeout = 30_000,
): Promise<string> {
  try {
    const { stdout, stderr } = await execFileAsync("git", args, {
      cwd: REPO_ROOT,
      timeout,
      windowsHide: true,
      maxBuffer: 4 * 1024 * 1024,
    });
    return (stdout || stderr || "").trim();
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    const out = [e.stdout, e.stderr, e.message].filter(Boolean).join("\n");
    logger.warn({ args, err: e.message }, "git digest partial failure");
    return out.trim();
  }
}

/**
 * Collect recent bot/dashboard changes for AI changelog drafting.
 */
export async function collectBotChangesDigest(options?: {
  /** How many commits to include (default 40) */
  maxCommits?: number;
  /** Since ISO date or relative like "14 days ago" */
  since?: string;
}): Promise<{
  digest: string;
  meta: {
    repoRoot: string;
    branch: string;
    commitCount: number;
    head: string;
  };
}> {
  const maxCommits = options?.maxCommits ?? 40;
  const since = options?.since ?? "21 days ago";

  const branch = await git(["rev-parse", "--abbrev-ref", "HEAD"]);
  const head = await git(["rev-parse", "--short", "HEAD"]);

  // Commits touching bot / dashboard / shared libs
  const paths = [
    "artifacts/api-server",
    "artifacts/dashboard",
    "lib/db",
    "CHANGELOG.md",
    "README.md",
  ];

  const logArgs = [
    "log",
    `-${maxCommits}`,
    `--since=${since}`,
    "--pretty=format:%h | %ad | %an | %s",
    "--date=short",
    "--",
    ...paths,
  ];
  const commitLog = await git(logArgs);

  const commits = commitLog
    ? commitLog.split(/\r?\n/).filter(Boolean)
    : [];

  // Name-status of last ~15 commits on those paths
  const nameStatus = await git([
    "log",
    "-15",
    `--since=${since}`,
    "--name-status",
    "--pretty=format:--- %h %s ---",
    "--",
    ...paths,
  ]);

  // Uncommitted / staged summary (if any)
  const status = await git(["status", "--short", "--", ...paths]);
  const diffStat = await git([
    "diff",
    "--stat",
    "HEAD",
    "--",
    ...paths,
  ]);

  // Existing CHANGELOG head for context
  let changelogHead = "";
  try {
    const full = await git(["show", "HEAD:CHANGELOG.md"]);
    changelogHead = full.split(/\r?\n/).slice(0, 60).join("\n");
  } catch {
    /* optional */
  }

  // High-signal file list from recent commits
  const filesChanged = await git([
    "log",
    "-30",
    `--since=${since}`,
    "--pretty=format:",
    "--name-only",
    "--",
    ...paths,
  ]);
  const uniqueFiles = [
    ...new Set(
      filesChanged
        .split(/\r?\n/)
        .map((f) => f.trim())
        .filter(Boolean),
    ),
  ].slice(0, 80);

  const digest = [
    `# Zero Two — digest de cambios`,
    `branch: ${branch} · HEAD: ${head}`,
    `ventana: since ${since} · max ${maxCommits} commits`,
    ``,
    `## Commits`,
    commits.length ? commits.join("\n") : "(sin commits en la ventana)",
    ``,
    `## Archivos tocados (únicos, top 80)`,
    uniqueFiles.length ? uniqueFiles.join("\n") : "(ninguno)",
    ``,
    `## name-status reciente`,
    nameStatus || "(vacío)",
    ``,
    `## Working tree (sin commit)`,
    status || "(limpio)",
    diffStat ? `\n## diff --stat (uncommitted)\n${diffStat}` : "",
    ``,
    `## CHANGELOG actual (primeras líneas)`,
    changelogHead || "(no disponible)",
  ]
    .filter((l) => l !== undefined)
    .join("\n");

  return {
    digest,
    meta: {
      repoRoot: REPO_ROOT,
      branch,
      commitCount: commits.length,
      head,
    },
  };
}
