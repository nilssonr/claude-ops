import { spawnSync } from "node:child_process";

try {
  const input = JSON.parse(await Bun.stdin.text());

  if (input?.stop_hook_active) process.exit(0);
  if (input?.permission_mode === "plan") process.exit(0);

  const r = spawnSync("git", ["status", "--porcelain"], {
    encoding: "utf-8",
  });

  if (r.status !== 0 || !r.stdout?.trim()) process.exit(0);

  const lines = r.stdout.trim().split("\n");
  console.log(
    JSON.stringify({
      decision: "block",
      reason: `You have ${lines.length} uncommitted change(s). Stage and commit your work before stopping:\n${r.stdout.trim()}`,
    }),
  );

  process.exit(0);
} catch {
  process.exit(0);
}
