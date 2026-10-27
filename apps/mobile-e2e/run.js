const path = require('path');
const { spawnSync } = require('child_process');

const { adbPath } = require('./bin/adb-select');

const projectDir = __dirname;
const workspace = path.resolve(projectDir, '../..');
const appiumEntry = path.join(workspace, 'node_modules', 'appium', 'index.js');
const krakenBin = path.join(workspace, 'node_modules', 'kraken-node', 'bin', 'kraken-node');
const originalPath = process.env.PATH || '';

let realAdb;
try {
  realAdb = adbPath(originalPath);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}

process.env.E2E_REAL_ADB = realAdb;
console.log(`[E2E-DIAG] realAdb=${realAdb}`);
process.env.APPIUM_HOME = path.join(projectDir, '.appium');
process.env.PATH = `${path.join(projectDir, 'bin')}${path.delimiter}${originalPath}`;

function ensureDriver() {
  const listed = spawnSync(process.execPath, [appiumEntry, 'driver', 'list', '--installed', '--json'], {
    cwd: projectDir,
    env: process.env,
    encoding: 'utf8',
  });
  const output = `${listed.stdout || ''}\n${listed.stderr || ''}`;
  if (output.includes('"uiautomator2"')) {
    return;
  }

  console.log('Instalando el driver uiautomator2 para Appium...');
  const installed = spawnSync(process.execPath, [appiumEntry, 'driver', 'install', 'uiautomator2@8.7.2'], {
    cwd: projectDir,
    env: process.env,
    stdio: 'inherit',
  });
  if ((installed.status ?? 1) !== 0) {
    process.exit(installed.status ?? 1);
  }
}

function connectedDevices() {
  const listed = spawnSync('adb', ['devices', '-l'], {
    cwd: projectDir,
    env: process.env,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  if ((listed.status ?? 1) !== 0) {
    return null;
  }

  return (listed.stdout || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('List of devices') && /\sdevice(\s|$)/.test(line));
}

ensureDriver();
const devices = connectedDevices();
if (Array.isArray(devices) && devices.length === 0) {
  console.log('adb no reporta dispositivos. Conecta un emulador o un teléfono antes de ejecutar.');
}
console.log('Ejecutando Kraken.');
const result = spawnSync(process.execPath, [krakenBin, 'run'], {
  cwd: projectDir,
  env: process.env,
  stdio: 'inherit',
});
const status = result.status ?? 1;
if (status === 0 && Array.isArray(devices) && devices.length === 0) {
  console.log('Kraken terminó sin ejecutar escenarios porque adb no reporta un dispositivo.');
  process.exit(1);
}
process.exit(status);
