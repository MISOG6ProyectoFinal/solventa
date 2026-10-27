const http = require('http');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const STANDARD_CAPS = new Set([
  'platformName',
  'browserName',
  'browserVersion',
  'acceptInsecureCerts',
  'pageLoadStrategy',
  'proxy',
  'timeouts',
  'unhandledPromptBehavior',
  'strictFileInteractability',
  'webSocketUrl',
]);

function readPort(argv) {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if ((arg === '-p' || arg === '--port') && argv[index + 1]) {
      return Number(argv[index + 1]);
    }
    if (arg.startsWith('--port=')) {
      return Number(arg.slice('--port='.length));
    }
  }
  return null;
}

function prefixCaps(caps) {
  if (!caps || typeof caps !== 'object' || Array.isArray(caps)) {
    return caps;
  }

  const next = {};
  for (const [key, value] of Object.entries(caps)) {
    const prefixedKey = key.includes(':') || STANDARD_CAPS.has(key) ? key : `appium:${key}`;
    const bareKey = prefixedKey.startsWith('appium:') ? prefixedKey.slice('appium:'.length) : key;
    next[prefixedKey] = bareKey === 'app' && typeof value === 'string' && value.trim() !== ''
      ? path.resolve(value)
      : value;
  }
  return next;
}

function rewriteSession(text) {
  const json = JSON.parse(text);
  if (json.capabilities?.alwaysMatch) {
    json.capabilities.alwaysMatch = prefixCaps(json.capabilities.alwaysMatch);
  }
  if (Array.isArray(json.capabilities?.firstMatch)) {
    json.capabilities.firstMatch = json.capabilities.firstMatch.map((entry) => prefixCaps(entry));
  } else if (json.capabilities?.platformName || json.capabilities?.app) {
    json.capabilities = prefixCaps(json.capabilities);
  }
  if (json.desiredCapabilities) {
    json.desiredCapabilities = prefixCaps(json.desiredCapabilities);
  }
  return JSON.stringify(json);
}

function stopChild(child) {
  if (!child || child.killed || child.exitCode !== null) {
    return;
  }
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    return;
  }
  child.kill('SIGTERM');
}

function listen(port, internalPort) {
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      let body = Buffer.concat(chunks);
      const pathname = new URL(req.url || '/', 'http://127.0.0.1').pathname;
      if (req.method === 'POST' && (pathname === '/wd/hub/session' || pathname === '/session')) {
        try {
          body = Buffer.from(rewriteSession(body.toString('utf8')));
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          process.stdout.write(`No se reescribieron las capabilities: ${message}\n`);
        }
      }

      const headers = { ...req.headers, host: `127.0.0.1:${internalPort}` };
      delete headers['transfer-encoding'];
      headers['content-length'] = String(body.length);
      const upstream = http.request(
        {
          hostname: '127.0.0.1',
          port: internalPort,
          path: req.url,
          method: req.method,
          headers,
        },
        (upstreamResponse) => {
          res.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
          upstreamResponse.pipe(res);
        },
      );
      upstream.on('error', (error) => {
        res.writeHead(502);
        res.end(error.message);
      });
      upstream.end(body);
    });
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '0.0.0.0', () => resolve(server));
  });
}

function waitForStatus(internalPort) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const poll = () => {
      const request = http.get(`http://127.0.0.1:${internalPort}/wd/hub/status`, (response) => {
        response.resume();
        if (response.statusCode && response.statusCode < 500) {
          resolve();
          return;
        }
        retry();
      });
      request.on('error', retry);
      function retry() {
        if (Date.now() - started > 60000) {
          reject(new Error('Appium no respondió en /wd/hub/status.'));
          return;
        }
        setTimeout(poll, 500);
      }
    };
    poll();
  });
}

async function main() {
  if (typeof process.stdout._handle?.setBlocking === 'function') {
    process.stdout._handle.setBlocking(true);
  }

  const port = readPort(process.argv.slice(2));
  if (!port || Number.isNaN(port)) {
    process.stdout.write('Kraken debe invocar este adaptador con -p PUERTO.\n');
    process.exit(1);
  }

  const internalPort = port + 10000;
  const appiumEntry = path.resolve(__dirname, '../../../node_modules/appium/index.js');
  const child = spawn(
    process.execPath,
    [
      appiumEntry,
      'server',
      '--address',
      '127.0.0.1',
      '--port',
      String(internalPort),
      '--base-path',
      '/wd/hub',
      '--allow-insecure=uiautomator2:adb_shell',
      '--log-no-colors',
      '--log-level',
      'info',
    ],
    {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    },
  );

  const shutdown = () => stopChild(child);
  process.on('SIGINT', () => {
    shutdown();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    shutdown();
    process.exit(0);
  });
  process.on('exit', shutdown);
  child.stdout.on('data', (chunk) => process.stdout.write(chunk));
  child.stderr.on('data', (chunk) => process.stdout.write(chunk));
  child.on('exit', (code) => {
    if (code) {
      process.stdout.write(`Appium terminó con código ${code}.\n`);
    }
  });

  await listen(port, internalPort);
  await waitForStatus(internalPort);
  process.stdout.write(`Appium REST http interface listener started on 0.0.0.0:${port}\n`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stdout.write(`${message}\n`);
  process.exit(1);
});
