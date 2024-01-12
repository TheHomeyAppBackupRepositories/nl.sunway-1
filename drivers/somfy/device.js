'use strict';

const { RFDevice } = require('homey-rfdriver');

module.exports = class extends RFDevice {

  async onAdded() {
    if (this.hasCapability('onoff')) {
      await this.setCapabilityValue('onoff', false);
    }
  }

  async onCapability(capabilityId, value, opts) {
    opts.rollingCode = await this.updateRollingCode();
    await super.onCapability(capabilityId, value, opts);
  }

  /**
   * Updates the Rolling code number and stores it in the settings
   *
   * @returns {Promise<*|number>}
   */
  async updateRollingCode() {
    // Update  the rollingCode everytime a new command is send
    let rollingCode = this.getStoreValue('rollingCode') || 0;
    rollingCode++;
    await this.setStoreValue('rollingCode', rollingCode);

    return rollingCode;
  }

  /**
   * Inverts the tit command
   *
   * @param type
   * @returns {string|*}
   */
  static invertTilt(type) {
    if (type === 'tilt_up') {
      return 'tilt_down';
    }
    if (type === 'tilt_down') {
      return 'tilt_up';
    }

    return type;
  }

  static CAPABILITIES = {
    windowcoverings_state({ value, opts, data }) {
      let cmd = value;
      if (this.getSetting('rotated') === '180') {
        if (value === 'up') {
          cmd = 'down';
        } else if (value === 'down') {
          cmd = 'up';
        }
      }

      if (cmd === 'idle') {
        data.repeatCount = 2;
      } else {
        data.repeatCount = 1;
      }

      return {
        ...data,
        rollingCode: opts.rollingCode,
        cmd,
        extCmd: data.extCmd,
      };
    },
    windowcoverings_tilt_up({ value, opts, data }) {
      return {
        ...data,
        rollingCode: opts.rollingCode,
        repeatCount: 1,
        cmd: 'ext',
        extCmd: this.getSetting('invert_tilt') ? this.constructor.invertTilt('tilt_up') : 'tilt_up',
      };
    },
    windowcoverings_tilt_down({ value, opts, data }) {
      return {
        ...data,
        rollingCode: opts.rollingCode,
        repeatCount: 1,
        cmd: 'ext',
        extCmd: this.getSetting('invert_tilt') ? this.constructor.invertTilt('tilt_down') : 'tilt_down',
      };
    },
  };

};
