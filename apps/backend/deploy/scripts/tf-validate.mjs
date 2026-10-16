import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { delimiter, join } from "node:path";

const stacksDir = "deploy/terraform/stacks";
const stacks = readdirSync(stacksDir)
  .filter((name) => statSync(join(stacksDir, name)).isDirectory())
  .sort();

function terraformCommand() {
  const override = process.env.TERRAFORM_BIN;
  if (override) {
    return override;
  }
  const name = process.platform === "win32" ? "terraform.exe" : "terraform";
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    const candidate = join(dir, name);
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return name;
}

function run(args) {
  const result = spawnSync(terraformCommand(), args, { stdio: "inherit" });
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
