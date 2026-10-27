const elements = require('./elements');

class ProductsPage {
  constructor(driver) {
    this.driver = driver;
  }

  async openProduct(productId) {
    await elements.tap(this.driver, 'tab-buy');
    await elements.waitForTestId(
      this.driver,
      'products-screen',
      elements.MEDIUM_TIMEOUT,
      'No se abrió el catálogo de productos.',
    );

    const productTestId = `product-${productId}`;
    try {
      await elements.waitForTestId(
        this.driver,
        productTestId,
        elements.MEDIUM_TIMEOUT,
        `No apareció el producto "${productId}". Revisa el backend y el catálogo móvil.`,
      );
    } catch (error) {
      if (await elements.sourceIncludes(this.driver, 'products-loading')) {
        throw new Error('El catálogo sigue cargando. El backend local no respondió a /movil/productos.');
      }
      throw error;
    }

    await elements.tap(this.driver, productTestId);
    await elements.waitForTestId(
      this.driver,
      'quote-form-screen',
      elements.MEDIUM_TIMEOUT,
      `El producto "${productId}" no abrió la cotización. En el catálogo móvil solo un producto disponible navega al formulario.`,
    );
  }
}

module.exports = { ProductsPage };
