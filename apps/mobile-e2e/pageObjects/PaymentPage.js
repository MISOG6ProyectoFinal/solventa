const elements = require('./elements');

class PaymentPage {
  constructor(driver) {
    this.driver = driver;
  }

  async payApproved() {
    await elements.waitForTestId(
      this.driver,
      'quote-pay',
      elements.MEDIUM_TIMEOUT,
      'No está disponible el botón de pago.',
    );
    await elements.tap(this.driver, 'quote-pay');
  }

  async issuedPolicyNumber() {
    const started = Date.now();
    while (Date.now() - started < elements.LONG_TIMEOUT) {
      const source = await this.driver.getPageSource();
      if (source.includes('policy-issue-failed')) {
        const banner = await elements.find(this.driver, 'policy-issue-failed', 5000);
        const message = await elements.readText(banner);
        throw new Error(message || 'El pago fue aprobado, pero la póliza no se emitió.');
      }
      if (source.includes('policy-issued-banner')) {
        const match = source.match(/POL-[A-F0-9]{10}/);
        if (!match) {
          throw new Error('La confirmación no mostró un número de póliza POL-.');
        }
        return match[0];
      }
      await this.driver.pause(1000);
    }
    throw new Error('La aplicación no confirmó la emisión de la póliza.');
  }
}

module.exports = { PaymentPage };
