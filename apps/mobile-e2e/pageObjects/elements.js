const { spawnSync } = require('child_process');

const SHORT_TIMEOUT = 20000;
const MEDIUM_TIMEOUT = 45000;
const LONG_TIMEOUT = 90000;
const STABLE_RECT_TIMEOUT = 3000;
const STABLE_RECT_INTERVAL = 150;
const ADB_HOST = '127.0.0.1';
const ADB_PORT = '5037';

let adbEnvironmentLogged = false;

function escapeUi(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function testIdSelectors(testId) {
  const quoted = escapeUi(testId);
  return [
    `android=new UiSelector().resourceId("${quoted}")`,
    `android=new UiSelector().description("${quoted}")`,
  ];
}

async function find(driver, testId, timeout = MEDIUM_TIMEOUT) {
  let lastError = null;

  for (const selector of testIdSelectors(testId)) {
    const element = await driver.$(selector);
    try {
      await element.waitForDisplayed({ timeout });
      return element;
    } catch (error) {
      lastError = error;
    }
  }

  const message = lastError instanceof Error ? lastError.message : 'no apareció';
  throw new Error(`No se encontró el elemento "${testId}". ${message}`);
}

async function findDisplayedWithoutScroll(driver, testId) {
  for (const selector of testIdSelectors(testId)) {
    const matches = await driver.$$(selector);
    for (const element of matches) {
      if (await element.isDisplayed()) {
        return element;
      }
    }
  }
  return null;
}

async function scrollTo(driver, testId) {
  const visible = await findDisplayedWithoutScroll(driver, testId);
  if (visible) {
    console.log(`[E2E-DIAG] scrollTo testID=${testId} already-visible`);
    return visible;
  }

  console.log(`[E2E-DIAG] scrollTo testID=${testId} scrolling`);
  const selector = `android=new UiScrollable(new UiSelector().scrollable(true)).scrollIntoView(new UiSelector().resourceId("${escapeUi(testId)}"))`;
  let scrolled = null;
  try {
    const matches = await driver.$$(selector);
    scrolled = matches[0] || null;
    console.log(`[E2E-DIAG] scrollTo testID=${testId} scroll-completed`);
  } catch {
    // La vista ya puede estar en pantalla o el contenedor no ser scrollable.
  }

  if (scrolled && scrolled.elementId && (await driver.isElementDisplayed(scrolled.elementId))) {
    return scrolled;
  }

  return find(driver, testId);
}

async function attributeText(element, name) {
  try {
    return ((await element.getAttribute(name)) || '').trim();
  } catch {
    return '';
  }
}

async function readText(element) {
  const text = ((await element.getText()) || '').trim();
  if (text !== '') {
    return text;
  }

  for (const name of ['content-desc', 'contentDescription']) {
    const description = await attributeText(element, name);
    if (description !== '') {
      return description;
    }
  }

  const child = await element.$('android.widget.TextView');
  if (await child.isExisting()) {
    return ((await child.getText()) || '').trim();
  }

  return '';
}

async function sourceIncludes(driver, testId) {
  const source = await driver.getPageSource();
  return source.includes(testId);
}

async function waitForTestId(driver, testId, timeout = MEDIUM_TIMEOUT, message) {
  await driver.waitUntil(async () => sourceIncludes(driver, testId), {
    timeout,
    interval: 1000,
    timeoutMsg: message || `No apareció "${testId}".`,
  });
  return find(driver, testId, 5000);
}

async function waitForAny(driver, testIds, timeout, message) {
  let found = null;
  await driver.waitUntil(
    async () => {
      const source = await driver.getPageSource();
      found = testIds.find((testId) => source.includes(testId)) || null;
      return found !== null;
    },
    { timeout, interval: 1000, timeoutMsg: message },
  );
  return found;
}

async function dismissKeyboard(driver) {
  try {
    await driver.hideKeyboard();
  } catch {
    // El teclado ya estaba cerrado.
  }
}

function rethrowIfStale(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (/stale|not present in the current view/i.test(message)) {
    throw new Error(`El elemento quedó obsoleto antes del toque. ${message}`);
  }
  throw error;
}

function formatRect(rect) {
  return `(${rect.x},${rect.y},${rect.width},${rect.height})`;
}

function sameRect(left, right) {
  return left.x === right.x && left.y === right.y && left.width === right.width && left.height === right.height;
}

async function elementRect(driver, elementId) {
  let raw;
  try {
    raw = await driver.getElementRect(elementId);
  } catch (error) {
    rethrowIfStale(error);
  }

  const rect = {
    x: Number(raw.x),
    y: Number(raw.y),
    width: Number(raw.width),
    height: Number(raw.height),
  };
  if (![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) || rect.width <= 0 || rect.height <= 0) {
    throw new Error(`Geometría inválida: x=${raw.x} y=${raw.y} width=${raw.width} height=${raw.height}.`);
  }
  return rect;
}

async function waitForStableRect(driver, elementId) {
  let previous = null;
  let stable = null;
  await driver.waitUntil(
    async () => {
      const next = await elementRect(driver, elementId);
      if (previous && sameRect(previous, next)) {
        stable = next;
        return true;
      }
      if (previous) {
        console.log(`[E2E-DIAG] rect changed old=${formatRect(previous)} new=${formatRect(next)}`);
      }
      previous = next;
      return false;
    },
    {
      timeout: STABLE_RECT_TIMEOUT,
      interval: STABLE_RECT_INTERVAL,
      timeoutMsg: 'La posición del elemento no se estabilizó.',
    },
  );
  return stable;
}

function adbServerArgs(udid) {
  return ['-H', ADB_HOST, '-P', ADB_PORT, '-s', udid];
}

function logAdbEnvironment() {
  if (adbEnvironmentLogged) {
    return;
  }
  adbEnvironmentLogged = true;
  for (const name of ['ADB_SERVER_SOCKET', 'ANDROID_ADB_SERVER_PORT', 'ADB_PORT', 'ANDROID_SERIAL']) {
    const value = process.env[name];
    const shown = typeof value === 'string' && value.trim() !== '' ? value.trim() : '<unset>';
    console.log(`[E2E-DIAG] adbEnv ${name}=${shown}`);
  }
  console.log(`[E2E-DIAG] adbTarget host=${ADB_HOST} port=${ADB_PORT}`);
}

function runAdb(adb, args) {
  const result = spawnSync(adb, args, { encoding: 'utf8' });
  if (result.error) {
    throw result.error;
  }
  const stdout = (result.stdout || '').trim();
  const stderr = (result.stderr || '').trim();
  if (stderr !== '') {
    console.log(`[E2E-DIAG] adbTap stderr=${stderr}`);
  }
  if ((result.status ?? 1) !== 0) {
    throw new Error(`adb terminó con código ${result.status ?? 1}${stdout ? `: ${stdout}` : ''}.`);
  }
  return stdout;
}

async function tapElement(driver, element) {
  const elementId = element && element.elementId;
  if (typeof elementId !== 'string' || elementId === '') {
    throw new Error('El elemento no expone elementId para leer su posición.');
  }

  let displayed = false;
  try {
    displayed = await driver.isElementDisplayed(elementId);
  } catch (error) {
    rethrowIfStale(error);
  }
  if (!displayed) {
    throw new Error('El elemento no está visible para el toque.');
  }

  let resourceId = elementId;
  try {
    resourceId = ((await driver.getElementAttribute(elementId, 'resource-id')) || '').trim() || elementId;
  } catch (error) {
    rethrowIfStale(error);
  }

  const rect = await waitForStableRect(driver, elementId);
  console.log(`[E2E-DIAG] adbTap rect stable resource-id=${resourceId} rect=${formatRect(rect)}`);
  const x = rect.x;
  const y = rect.y;
  const width = rect.width;
  const height = rect.height;
  const centerX = Math.round(x + width / 2);
  const centerY = Math.round(y + height / 2);
  const windowRect = await driver.getWindowRect();
  const windowWidth = Number(windowRect.width);
  const windowHeight = Number(windowRect.height);
  if (!Number.isFinite(windowWidth) || !Number.isFinite(windowHeight) || windowWidth <= 0 || windowHeight <= 0) {
    throw new Error(`No se pudo leer la ventana: ${windowRect.width}x${windowRect.height}.`);
  }
  if (centerX < 0 || centerY < 0 || centerX >= windowWidth || centerY >= windowHeight) {
    throw new Error(
      `El centro (${centerX}, ${centerY}) de "${resourceId}" queda fuera de la ventana ${windowWidth}x${windowHeight}.`,
    );
  }

  console.log(
    `[E2E-DIAG] mobileShellTap resource-id=${resourceId} rect=${formatRect(rect)} center=(${centerX},${centerY})`,
  );
  await driver.execute('mobile: shell', {
    command: 'input',
    args: ['tap', String(centerX), String(centerY)],
  });
  console.log(`[E2E-DIAG] mobileShellTap completed resource-id=${resourceId}`);
}

async function tap(driver, testId) {
  const element = await scrollTo(driver, testId);
  await element.click();
}

async function tapDescription(driver, labels, timeout = SHORT_TIMEOUT) {
  let lastError = null;
  for (const label of labels) {
    const element = await driver.$(`android=new UiSelector().description("${escapeUi(label)}")`);
    try {
      await element.waitForDisplayed({ timeout });
      await element.click();
      return;
    } catch (error) {
      lastError = error;
    }
  }
  const message = lastError instanceof Error ? lastError.message : 'no apareció';
  throw new Error(`No se encontró ${labels.join(' / ')}. ${message}`);
}

async function typeInto(driver, testId, value) {
  const container = await scrollTo(driver, testId);
  let input = await container.$('android.widget.EditText');
  if (!(await input.isExisting())) {
    input = container;
  }
  await input.click();
  try {
    await input.clearValue();
  } catch {
    // Algunos campos de React Native no aceptan clearValue.
  }
  await input.setValue(value);
  await dismissKeyboard(driver);
}

async function textContains(driver, text, timeout = MEDIUM_TIMEOUT) {
  const element = await driver.$(`android=new UiSelector().textContains("${escapeUi(text)}")`);
  await element.waitForDisplayed({
    timeout,
    timeoutMsg: `No apareció el texto "${text}".`,
  });
  return element;
}

module.exports = {
  SHORT_TIMEOUT,
  MEDIUM_TIMEOUT,
  LONG_TIMEOUT,
  find,
  scrollTo,
  readText,
  sourceIncludes,
  waitForTestId,
  waitForAny,
  dismissKeyboard,
  tapElement,
  tap,
  tapDescription,
  typeInto,
  textContains,
};
