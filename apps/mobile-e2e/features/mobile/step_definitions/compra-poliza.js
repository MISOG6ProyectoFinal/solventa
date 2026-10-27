const { Given, When, Then } = require('@cucumber/cucumber');

const { quoteConfig } = require('../../../pageObjects/config');
const { LoginPage } = require('../../../pageObjects/LoginPage');
const { ProductsPage } = require('../../../pageObjects/ProductsPage');
const { QuotePage } = require('../../../pageObjects/QuotePage');
const { PaymentPage } = require('../../../pageObjects/PaymentPage');
const { PoliciesPage } = require('../../../pageObjects/PoliciesPage');

Given('el cliente ha iniciado sesión', async function () {
  const quote = quoteConfig();
  const login = new LoginPage(this.driver);
  await login.signIn(quote.email, quote.password);
});

Given('existen productos disponibles', async function () {
  const quote = quoteConfig();
  const products = new ProductsPage(this.driver);
  await products.openProduct(quote.productId);
});

When('realiza una cotización válida', async function () {
  const quote = quoteConfig();
  const form = new QuotePage(this.driver);
  await form.complete(quote);
});

When('realiza un pago aprobado', async function () {
  const payment = new PaymentPage(this.driver);
  await payment.payApproved();
});

Then('se debe emitir una póliza', async function () {
  const payment = new PaymentPage(this.driver);
  this.policyNumber = await payment.issuedPolicyNumber();
});

Then('la póliza debe aparecer entre sus pólizas', async function () {
  if (!this.policyNumber) {
    throw new Error('No hay un número de póliza de esta ejecución para buscar en el listado.');
  }
  const policies = new PoliciesPage(this.driver);
  await policies.expectPolicy(this.policyNumber);
});
