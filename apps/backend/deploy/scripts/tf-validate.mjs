import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const stacksDir = "deploy/terraform/stacks";
const stacks = readdirSync(stacksDir)
  .filter((name) => statSync(join(stacksDir, name)).isDirectory())
  .sort();

function run(args) {
  const result = spawnSync("terraform", args, { stdio: "inherit" });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

for (const stack of stacks) {
  const dir = join(stacksDir, stack).replaceAll("\\", "/");
  console.log(`==> terraform validate ${stack}`);
  run(["-chdir=" + dir, "init", "-backend=false", "-input=false"]);
  run(["-chdir=" + dir, "validate"]);
}
