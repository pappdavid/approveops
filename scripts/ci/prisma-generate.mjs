import { spawnSync } from "node:child_process";
import path from "node:path";

const prismaBin =
  process.platform === "win32"
    ? path.join("node_modules", ".bin", "prisma.cmd")
    : path.join("node_modules", ".bin", "prisma");

const env = {
  ...process.env,
  CHECKPOINT_DISABLE: "1",
  PRISMA_HIDE_UPDATE_MESSAGE: "1",
  PRISMA_GENERATE_SKIP_AUTOINSTALL: "1",
  CI: process.env.CI ?? "true",
};

const result = spawnSync(prismaBin, ["generate"], {
  stdio: "inherit",
  env,
  shell: false,
});

process.exit(result.status ?? 1);
