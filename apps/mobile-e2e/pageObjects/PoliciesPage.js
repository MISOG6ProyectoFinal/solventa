const elements = require('./elements');

class PoliciesPage {
  constructor(driver) {
    this.driver = driver;
  }

  async expectPolicy(policyNumber) {
    await elements.tap(this.driver, 'view-policy');
    await elements.waitForTestId(
      this.driver,
      'policies-screen',
      elements.MEDIUM_TIMEOUT,
      'No se abrió el listado de pólizas.',
    );

    await this.driver.waitUntil(async () => !(await elements.sourceIncludes(this.driver, 'policies-loading')), {
      timeout: elements.MEDIUM_TIMEOUT,
      interval: 1000,
      timeoutMsg: 'El listado de pólizas no terminó de cargar.',
    });

    const selector = `android=new UiScrollable(new UiSelector().scrollable(true)).scrollIntoView(new UiSelector().textContains("${policyNumber}"))`;
    try {
      const scrolled = await this.driver.$(selector);
      if (await scrolled.isExisting()) {
        return;
      }
    } catch {
      // El número puede estar visible sin necesidad de desplazar.
    }

    await elements.textContains(this.driver, policyNumber, elements.MEDIUM_TIMEOUT);
  }
}

module.exports = { PoliciesPage };
