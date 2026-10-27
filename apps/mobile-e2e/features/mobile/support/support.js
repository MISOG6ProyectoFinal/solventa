const { setWorldConstructor, setDefaultTimeout } = require('@cucumber/cucumber');

class KrakenWorld {
  constructor(input) {
    const params = input.parameters;
    const mobileInfo = params.mobile_info || {};
    this.userId = params.id;
    this.device = params.device || {};
    this.testScenarioId = params.testScenarioId;
    this.apkPath = mobileInfo.apk_path;
    this.apkPackage = mobileInfo.apk_package;
    this.apkLaunchActivity = mobileInfo.apk_launch_activity;
    this.attach = input.attach;
    this.policyNumber = null;
  }
}

setWorldConstructor(KrakenWorld);
setDefaultTimeout(300 * 1000);
