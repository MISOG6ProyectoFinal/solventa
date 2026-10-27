const elements = require('./elements');

class LoginPage {
  constructor(driver) {
    this.driver = driver;
  }

  async signIn(email, password) {
    const screen = await elements.waitForAny(
      this.driver,
      ['login-screen', 'home-screen'],
      60000,
      'La aplicación no mostró el login ni el inicio. Revisa que Metro esté corriendo y que el APK debug pueda descargar el bundle.',
    );

    if (screen === 'home-screen') {
      return;
    }

    await elements.typeInto(this.driver, 'login-email', email);
    await elements.typeInto(this.driver, 'login-password', password);
    await elements.tap(this.driver, 'login-submit');

    try {
      await elements.waitForTestId(
        this.driver,
        'home-screen',
        60000,
        'El inicio de sesión no abrió Inicio.',
      );
    } catch (error) {
      if (await elements.sourceIncludes(this.driver, 'login-error')) {
        const banner = await elements.find(this.driver, 'login-error', 5000);
        const message = await elements.readText(banner);
        throw new Error(message || 'No se pudo iniciar sesión.');
      }
      throw error;
    }
  }
}

module.exports = { LoginPage };
