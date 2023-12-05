'use strict';

const { RFDriver } = require('homey-rfdriver');
const BrelSignal = require('./BrelSignal');

module.exports = class BrelDriver extends RFDriver {

  static SIGNAL = BrelSignal;
  onRFInit() {
    super.onRFInit();

    this.homey.flow.getActionCard('tilt_brel')
      .registerRunListener((args, state) => {
        return this.doTiltFlowSteps(args.device, args.direction, args.steps);
      });

    this.homey.flow.getActionCard('my_brel')
      .registerRunListener((args) => {
        // The stop button must be held 3 seconds to trigger this action. 20 repetitions simulates this.
        return args.device.send({ cmd: 'my', windowcoverings_state: 'idle' }, { repetitions: 20 });
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
