'use strict';

const { RFDriver } = require('homey-rfdriver');
const SomfySignal = require('./SomfySignal');

module.exports = class extends RFDriver {

  static SIGNAL = SomfySignal;

  async onRFInit() {
    await super.onRFInit();

    this.homey.flow
      .getActionCard('tilt_somfy')
      .registerRunListener(async (args, state) => {
        await this.doTiltFlowSteps(args.device, args.direction, args.steps);
      });

    this.homey.flow
      .getActionCard('my_somfy')
      .registerRunListener(async (args, state) => {
        await this.sendMySomfyCommand(args.device);
      });
  }

  msleep(ms) {
    return new Promise((res) => this.homey.setTimeout(res, ms));
  }

  /**
   * Builds he base command with the address and the updated rollingCode
   *
   * @param device
   * @returns {Promise<{address, rollingCode: (*|number)}>}
   */
  async buildBaseCommand(device) {
    const { address } = device.getData();

    return {
      address,
      rollingCode: await device.updateRollingCode(),
    };
  }

  async doTiltFlowSteps(device, direction, steps) {
    const command = await this.buildBaseCommand(device);
    command.cmd = 'ext';
    command.extCmd = device.getSetting('invert_tilt') ? device.invertTilt(`tilt_${direction}`) : `tilt_${direction}`;

    const signal = await this.getRFSignal();

    // Implementation copied from old app, no info on why the max repeatCount is 15.
    // When testing the implementation it seems like 15 is the max repeats the controller will execute on 1 command.
    for (;steps > 0; steps -= 15) {
      command.repeatCount = Math.min(15, steps);
      await signal.tx(command);
      await this.msleep(command.repeatCount * 100);
    }
  }

  /**
   * Special command for the pre-defined MY position
   *
   * @returns {Promise<void>}
   */
  async sendMySomfyCommand(device) {
    const command = await this.buildBaseCommand(device);
    command.cmd = 'idle';
    command.repeatCount = 2;
    this.homey.log('sendMySomfyCommand');
    const signal = await this.getRFSignal();
    await signal.tx(command);
  }

};
