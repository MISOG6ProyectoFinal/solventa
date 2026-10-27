const { After, Before } = require('@cucumber/cucumber');
const { AndroidClient } = require('kraken-node');

Before(async function () {
  const serial = this.device && this.device.id != null ? String(this.device.id).trim() : '';
  if (serial !== '') {
    process.env.KRAKEN_UDID = serial;
  }

  this.deviceClient = new AndroidClient(
    this.device.id,
    this.apkPath,
    this.apkPackage,
    this.apkLaunchActivity,
    {
      noReset: false,
      fullReset: false,
      autoGrantPermissions: true,
      newCommandTimeout: 300,
      adbExecTimeout: 120000,
      androidInstallTimeout: 180000,
      uiautomator2ServerInstallTimeout: 180000,
      uiautomator2ServerLaunchTimeout: 120000,
      appWaitActivity: this.apkLaunchActivity,
      appWaitDuration: 30000,
      disableWindowAnimation: true,
    },
    this.userId,
  );
  // Kraken fija 60 s. La primera instalación de UiAutomator2 en el dispositivo suele tardar más.
  this.deviceClient.defaultClientTimout = 180000;
  this.driver = await this.deviceClient.startKrakenForUserId(this.userId);
});

After(async function () {
  if (!this.deviceClient) {
    return;
  }

  try {
    await this.deviceClient.stopKrakenForUserId(this.userId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`Cierre de Kraken: ${message}`);
    try {
      this.deviceClient.notifyFinished(this.userId);
    } catch {
      // Sin este aviso, el proceso padre de Kraken espera hasta su propio timeout.
    }
  }
});
