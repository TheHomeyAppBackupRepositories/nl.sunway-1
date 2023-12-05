'use strict';

const { RFDevice } = require('homey-rfdriver');

module.exports = class extends RFDevice {

  static CAPABILITIES = {
    windowcoverings_state({ value, opts, data }) {
      data = { ...data, cmd: null, windowcoverings_state: value };
      return this.parseOutgoingData(data);
    },
    windowcoverings_tilt_up({ value, opts, data }) {
      data = { ...data, cmd: null, windowcoverings_tilt_up: value };
      return this.parseOutgoingData(data);
    },
    windowcoverings_tilt_down({ value, opts, data }) {
      data = { ...data, cmd: null, windowcoverings_tilt_down: value };
      return this.parseOutgoingData(data);
    },
  };

  onRFInit() {
    super.onRFInit();
  }

  send(command, { ...props } = {}) {
    const data = this.parseOutgoingData({ ...this.getData(), ...command });
    this.log('Sending', data);
    this.driver.tx(data, { ...props });
  }

  _preParserOutgoingData(data) {
    // If the rotated setting is set we invert the up/down axis of all outgoing data.
    if (!this.isPairInstance && this.getSetting('rotated') === '180') {
      if (data.cmd === 'up' || data.cmd === 'down') {
        data = { ...data, cmd: data.cmd === 'up' ? 'down' : 'up' };
      } else if (data.cmd === 'deep_up' || data.cmd === 'deep_down') {
        data = { ...data, cmd: data.cmd === 'deep_up' ? 'deep_down' : 'deep_up' };
      }

      if ((data.windowcoverings_state === 'up' || data.windowcoverings_state === 'down')) {
        data = { ...data, windowcoverings_state: data.windowcoverings_state === 'up' ? 'down' : 'up' };
      }
      if (!this.getSetting('invert_tilt')) {
        if (data.windowcoverings_tilt_up) {
          data = {
            ...data,
            windowcoverings_tilt_down: true,
            windowcoverings_tilt_up: undefined,
          };
        } else if (data.windowcoverings_tilt_down) {
          data = {
            ...data,
            windowcoverings_tilt_up: true,
            windowcoverings_tilt_down: undefined,
          };
        }
      }
    } else if (this.getSetting('invert_tilt')) {
      if (data.windowcoverings_tilt_up) {
        data = { ...data, windowcoverings_tilt_down: true, windowcoverings_tilt_up: undefined };
      } else if (data.windowcoverings_tilt_down) {
        data = { ...data, windowcoverings_tilt_up: true, windowcoverings_tilt_down: undefined };
      }
    }

    return data;
  }

  parseOutgoingData(data) {
    const hasPulseMode = this.getSetting('pulse_mode');

    data = this._preParserOutgoingData(data);

    if ((data.windowcoverings_tilt_up || data.windowcoverings_tilt_down) && !hasPulseMode) {
      setImmediate(() => this.driver.tx({ ...data, cmd: 'idle' }));
    } else if (
      data.windowcoverings_state !== 'idle'
      && data.cmd !== 'idle'
      && !(data.windowcoverings_state && hasPulseMode)
      && !(data.cmd && data.cmd.startsWith('deep_'))
    ) {
      // If we are not sending a long signal we should end the signal with a deep_* command to indicate the button was released
      setImmediate(() => this.driver.tx({ ...data, cmd: data.windowcoverings_tilt_up || data.windowcoverings_state === 'up' ? 'deep_up' : 'deep_down' }));
    }

    return data;
  }

  getSendOptionsForData(data, options) {
    const newOpts = {};

    this.log(data);
    this.log(options);

    if ((data.windowcoverings_state && data.windowcoverings_state === 'idle') || this.getSetting('pulse_mode')) {
      newOpts.repetitions = 45;
    }

    return Object.assign(options, newOpts);
  }

};
