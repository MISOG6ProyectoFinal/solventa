const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const { deviceSerial } = require('../pageObjects/config');

function realAdb(pathValue = process.env.PATH || '') {
  const fileName = process.platform === 'win32' ? 'adb.exe' : 'adb';
  const roots = [process.env.ANDROID_SDK_ROOT, process.env.ANDROID_HOME].filter(Boolean);
  for (const root of roots) {
    const candidate = path.resolve(root, 'platform-tools', fileName);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  const locator = process.platform === 'win32' ? 'where.exe' : 'which';
  const located = spawnSync(locator, ['adb'], {
    encoding: 'utf8',
    env: { ...process.env, PATH: pathValue },
  });
  const wrapperDir = path.resolve(__dirname).toLowerCase();
  const found = (located.stdout || '')
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^"|"$/g, ''))
    .find((line) => {
      if (line === '') {
        return false;
      }
      const resolved = path.resolve(line).toLowerCase();
      const insideWrapper = resolved === wrapperDir || resolved.startsWith(`${wrapperDir}${path.sep}`);
      return !insideWrapper && fs.existsSync(line);
    });
  if (!found) {
    throw new Error('No se encontró adb. Define ANDROID_SDK_ROOT con platform-tools.');
  }
  return path.resolve(found);
}

function forward(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  process.exit(result.status ?? 1);
}

function main() {
  const args = process.argv.slice(2);
  const adb = realAdb();
  const serial = deviceSerial();

  if (serial && args[0] === 'devices') {
    const result = spawnSync(adb, args, { encoding: 'utf8' });
    if ((result.status ?? 1) !== 0) {
      if (result.stdout) {
        process.stdout.write(result.stdout);
      }
      if (result.stderr) {
        process.stderr.write(result.stderr);
      }
      process.exit(result.status ?? 1);
    }

    const lines = (result.stdout || '').split(/\r?\n/);
    const header = lines[0] || 'List of devices attached';
    const match = lines.find((line) => line.split(/\s+/)[0] === serial);
    if (!match) {
      process.stderr.write(`KRAKEN_UDID ${serial} no aparece en adb devices -l.\n`);
      process.exit(1);
    }
    process.stdout.write(`${header}\n${match}\n`);
    process.exit(0);
  }

  forward(adb, args);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  }
}

module.exports = { adbPath: realAdb };
