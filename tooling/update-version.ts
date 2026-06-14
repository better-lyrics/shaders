import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const rootDir = process.cwd();
const packageJsonPath = join(rootDir, "package.json");

const inputVersion = process.argv[2];
if (!inputVersion) {
  console.error("Usage: bun tooling/update-version.ts <version>");
  process.exit(1);
}

const semverMatch = inputVersion.match(/^(\d+\.\d+\.\d+)\.?(\d+)?/);
if (!semverMatch) {
  console.error(`Invalid version: ${inputVersion}`);
  process.exit(1);
}

const semverVersion = semverMatch[0];

try {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
  packageJson.version = semverVersion;
  writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\n");
  console.log(`Bumped package.json version to ${semverVersion}`);
} catch (error) {
  console.error("Error updating version:", error);
  process.exit(1);
}
