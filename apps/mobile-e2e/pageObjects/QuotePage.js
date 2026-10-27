const elements = require('./elements');

const MONTHS_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

const MONTHS_EN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function displayDate(date) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function dayLabels(date) {
  const day = date.getDate();
  const year = date.getFullYear();
  return [
    `${day} de ${MONTHS_ES[date.getMonth()]} de ${year}`,
    `${day} de ${MONTHS_EN[date.getMonth()]} de ${year}`,
  ];
}

function dateLabel(testId) {
  if (testId.endsWith('fechaSalida')) {
    return 'salida';
  }
  if (testId.endsWith('fechaRegreso')) {
    return 'regreso';
  }
  return testId;
}

function visibleMonth(source) {
  const pattern =
    /(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/gi;
  const matches = [...source.matchAll(pattern)];
  const match = matches[matches.length - 1];
  if (!match) {
    return null;
  }
  const name = match[1].toLowerCase();
  const month = [...MONTHS_ES, ...MONTHS_EN.map((monthName) => monthName.toLowerCase())].indexOf(name);
  if (month < 0) {
    return null;
  }
  return {
    month: month % 12,
    year: Number(match[2]),
  };
}

class QuotePage {
  constructor(driver) {
    this.driver = driver;
  }

  async complete(quote) {
    const departure = addDays(new Date(), quote.salida);
    const returning = addDays(new Date(), quote.regreso);

    await elements.typeInto(this.driver, 'quote-nombre', quote.nombre);
    await elements.typeInto(this.driver, 'quote-documento', quote.cedula);
    await this.chooseDestination(quote.destino);
    await this.chooseDate('quote-field-fechaSalida', departure);
    await this.chooseDate('quote-field-fechaRegreso', returning);
    await elements.typeInto(this.driver, 'quote-field-viajeros', quote.viajeros);
    await elements.tap(this.driver, 'quote-calc');
    await elements.waitForTestId(
      this.driver,
      'quote-continue-pay',
      elements.LONG_TIMEOUT,
      'La cotización no mostró el resultado. Revisa el backend de cotización.',
    );
    await elements.tap(this.driver, 'quote-continue-pay');
    await elements.waitForTestId(
      this.driver,
      'quote-payment-screen',
      elements.MEDIUM_TIMEOUT,
      'No se abrió la pantalla de pago.',
    );
  }

  async chooseDestination(destino) {
    const field = await elements.scrollTo(this.driver, 'quote-field-destino');
    const current = await elements.readText(field);
    if (current === destino) {
      console.log(`[E2E] Destino ya es ${destino}`);
      return;
    }

    console.log(`[E2E] Abriendo destino: ${current} -> ${destino}`);
    await elements.tapElement(this.driver, field);
    await elements.waitForTestId(this.driver, 'select-sheet', elements.SHORT_TIMEOUT, 'No se abrió la lista de destinos.');
    console.log('[E2E] Selector de destino abierto');
    await elements.tap(this.driver, `select-option-${destino}`);
    await this.driver.waitUntil(async () => !(await elements.sourceIncludes(this.driver, 'select-sheet')), {
      timeout: elements.SHORT_TIMEOUT,
      interval: 1000,
      timeoutMsg: 'La lista de destinos no se cerró.',
    });

    const selected = await elements.readText(await elements.scrollTo(this.driver, 'quote-field-destino'));
    if (selected !== destino) {
      throw new Error(`El destino quedó en "${selected}" y se esperaba "${destino}".`);
    }
    console.log(`[E2E] Destino seleccionado: ${selected}`);
  }

  async chooseDate(testId, date) {
    const shown = displayDate(date);
    const label = dateLabel(testId);
    const field = await elements.scrollTo(this.driver, testId);
    const current = await elements.readText(field);
    if (current === shown) {
      console.log(`[E2E] Fecha ${label} ya es ${shown}`);
      return;
    }

    console.log(`[E2E] Abriendo fecha ${label}: ${current} -> ${shown}`);
    await elements.dismissKeyboard(this.driver);
    await elements.tapElement(this.driver, field);
    await elements.waitForTestId(this.driver, 'date-sheet', elements.SHORT_TIMEOUT, 'No se abrió el calendario.');
    console.log(`[E2E] Calendario de ${label} abierto`);

    for (let attempt = 0; attempt < 18; attempt += 1) {
      const source = await this.driver.getPageSource();
      const visible = visibleMonth(source);
      const sameMonth = visible && visible.year === date.getFullYear() && visible.month === date.getMonth();
      if (sameMonth) {
        break;
      }
      const forward =
        !visible ||
        visible.year < date.getFullYear() ||
        (visible.year === date.getFullYear() && visible.month < date.getMonth());
      await elements.tapDescription(
        this.driver,
        forward ? ['Mes siguiente', 'Next month'] : ['Mes anterior', 'Previous month'],
      );
    }

    await elements.tapDescription(this.driver, dayLabels(date));
    await this.driver.waitUntil(async () => !(await elements.sourceIncludes(this.driver, 'date-sheet')), {
      timeout: elements.SHORT_TIMEOUT,
      interval: 1000,
      timeoutMsg: 'El calendario no se cerró.',
    });

    const selected = await elements.readText(await elements.scrollTo(this.driver, testId));
    if (selected !== shown) {
      throw new Error(`La fecha de ${label} quedó en "${selected}" y se esperaba "${shown}".`);
    }
    console.log(`[E2E] Fecha ${label} seleccionada: ${selected}`);
  }
}

module.exports = { QuotePage };
