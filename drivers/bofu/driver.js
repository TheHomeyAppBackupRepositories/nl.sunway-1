'use strict';

const { RFDriver } = require('homey-rfdriver');
const BofuSignal = require('./BofuSignal');

module.exports = class BofuDriver extends RFDriver {

  static SIGNAL = BofuSignal;
  onRFInit() {
    super.onRFInit();

    this.homey.flow
      .getActionCard('tilt_bofu')
      .registerRunListener(async (args) => {
        return this.doTiltFlowSteps(args.device, args.direction, args.steps);
      });

    this.homey.flow
      .getActionCard('my_bofu')
      .registerRunListener(async (args, state) => {
        return args.device.send({ cmd: 'my', windowcoverings_state: 'idle' });
      });

    this.homey.flow
      .getActionCard('set_windowcoverings_state_bofu')
      .registerRunListener((args, state) => {
        const command = {
          cmd: '',
          rail: 1,
        };
        if (args.rail === 'rail2') {
          command.cmd += 'rail2.';
          command.rail = 2;
        }
        if (args.rail === 'rail3') {
          command.cmd += 'rail3.';
          command.rail = 3;
        }
        command.cmd += args.state;
        return args.device.send(command);
      });
  }

  msleep(ms) {
    return new Promise((res) => setTimeout(res, ms));
  }

  async doTiltFlowSteps(device, direction, times) {
    const capability = direction === 'up' ? 'windowcoverings_tilt_up' : 'windowcoverings_tilt_down';

    const data = {};
    data[capability] = true;

    for (;times > 0; times -= 15) {
      data.repeatCount = Math.min(15, times);

      await device.send(data);
      await this.msleep(data.repeatCount * 100);
    }
  }

};
