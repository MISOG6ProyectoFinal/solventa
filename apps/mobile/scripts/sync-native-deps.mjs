import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Autolinking reads apps/mobile/package.json. A root install does not update that file.
const workspaceRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const mobilePackagePath = join(workspaceRoot, 'apps/mobile/package.json');

const rootPackage = JSON.parse(readFileSync(join(workspaceRoot, 'package.json'), 'utf8'));
const mobilePackage = JSON.parse(readFileSync(mobilePackagePath, 'utf8'));

mobilePackage.dependencies ??= {};

const added = [];

for (const name of Object.keys(rootPackage.dependencies ?? {})) {
  if (mobilePackage.dependencies[name] || mobilePackage.devDependencies?.[name]) {
    continue;
  }
  if (!hasNativeCode(name)) {
    continue;
  }
  mobilePackage.dependencies[name] = '*';
  added.push(name);
}

if (added.length === 0) {
  console.log('Las dependencias nativas de mobile ya están al día.');
} else {
  writeFileSync(mobilePackagePath, `${JSON.stringify(mobilePackage, null, 2)}\n`);
  console.log(`Se agregaron a apps/mobile/package.json:\n  ${added.join('\n  ')}`);
}

function hasNativeCode(packageName) {
  const packageRoot = join(workspaceRoot, 'node_modules', packageName);
  const manifestPath = join(packageRoot, 'package.json');
  if (!existsSync(manifestPath)) {
    return false;
  }

  if (existsSync(join(packageRoot, 'react-native.config.js'))) {
    return true;
  }
  if (
    existsSync(join(packageRoot, 'android', 'build.gradle')) ||
    existsSync(join(packageRoot, 'android', 'build.gradle.kts'))
  ) {
    return true;
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (manifest.codegenConfig) {
    return true;
  }

  return readdirSync(packageRoot).some((entry) => entry.endsWith('.podspec'));
}
