'use strict';

const { RFDevice } = require('homey-rfdriver');

const WINDOWCOVERINGS_STATE_RAIL_1 = 'windowcoverings_state';
const WINDOWCOVERINGS_STATE_RAIL_2 = 'windowcoverings_state.rail2';
const WINDOWCOVERINGS_STATE_RAIL_3 = 'windowcoverings_state.rail3';

module.exports = class extends RFDevice {

  static CAPABILITIES = {
    windowcoverings_state({ value, opts, data }) {
      if (this.getSetting('rotated') === '180' && value !== 'idle') {
        value = this.invertDirection(value);
      }
      return {
        address: data.address,
        unit: data.unit,
        group: data.group,
        windowcoverings_state: value,
        rail: 1,
      };
    },
    'windowcoverings_state.rail2': function rail2({ value, opts, data }) {
      if (this.getSetting('rotated') === '180' && value !== 'idle') {
        value = this.invertDirection(value);
      }
      return {
        address: data.address,
        unit: data.unit,
        group: data.group,
        'windowcoverings_state.rail2': value,
        rail: 2,
      };
    },
    'windowcoverings_state.rail3': function rail3({ value, opts, data }) {
      if (this.getSetting('rotated') === '180' && value !== 'idle') {
        value = this.invertDirection(value);
      }
      return {
        address: data.address,
        unit: data.unit,
        group: data.group,
        'windowcoverings_state.rail3': value,
        rail: 3,
      };
    },
    windowcoverings_tilt_down({ value, opts, data }) {
      if (this.getSetting('invert_tilt') === true) {
        return {
          address: data.address,
          unit: data.unit,
          group: data.group,
          windowcoverings_tilt_up: true,
          tilt: 'up',
        };
      }
      return {
        address: data.address,
        unit: data.unit,
        group: data.group,
        windowcoverings_tilt_down: true,
        tilt: 'down',
      };
    },
    windowcoverings_tilt_up({ value, opts, data }) {
      if (this.getSetting('invert_tilt') === true) {
        return {
          address: data.address,
          unit: data.unit,
          group: data.group,
          windowcoverings_tilt_down: true,
          tilt: 'down',
        };
      }
      return {
        address: data.address,
        unit: data.unit,
        group: data.group,
        windowcoverings_tilt_up: true,
        tilt: 'up',
      };
    },
  };

  onRFInit() {
    super.onRFInit();
    this.clearFromEmptySendObject = ['tilt', 'direction', 'cmd'];
  }

  send(command) {
    const data = this.parseOutgoingData({ ...this.getData(), ...command });
    this.log('Sending', data);
    this.driver.tx(data);
  }

  parseIncomingData(data) {
    if (this.isPairInstance) {
      if (data[WINDOWCOVERINGS_STATE_RAIL_1] && data[WINDOWCOVERINGS_STATE_RAIL_1] !== 'idle') {
        data.direction = data[WINDOWCOVERINGS_STATE_RAIL_1];
      }
      if (data.windowcoverings_tilt_up || data.windowcoverings_tilt_down) {
        data.tilt = data.windowcoverings_tilt_up ? 'up' : 'down';
      }
    }

    // If the rotated setting is set we invert the up/down axis of all incoming data
    if (this.getSetting('rotated') === '180') {
      if (data.cmd === 'up' || data.cmd === 'down') {
        data.cmd = data.cmd === 'up' ? 'down' : 'up';
      }
      if (data[WINDOWCOVERINGS_STATE_RAIL_1] === 'up' || data[WINDOWCOVERINGS_STATE_RAIL_1] === 'down') {
        const virtualDirection = data[WINDOWCOVERINGS_STATE_RAIL_1] === 'up' ? 'down' : 'up';
        data = { ...data, windowcoverings_state: virtualDirection, direction: virtualDirection };
      }
      if (data[WINDOWCOVERINGS_STATE_RAIL_2] === 'up' || data[WINDOWCOVERINGS_STATE_RAIL_2] === 'down') {
        const virtualDirection = data[WINDOWCOVERINGS_STATE_RAIL_2] === 'up' ? 'down' : 'up';
        data = { ...data, [WINDOWCOVERINGS_STATE_RAIL_2]: virtualDirection, direction: virtualDirection };
      }
      if (data.windowcoverings_tilt_up) {
        data = {
          ...data,
          windowcoverings_tilt_down: true,
          windowcoverings_tilt_up: undefined,
          tilt: 'down',
        };
      } else if (data.windowcoverings_tilt_down) {
        data = {
          ...data,
          windowcoverings_tilt_up: true,
          windowcoverings_tilt_down: undefined,
          tilt: 'up',
        };
      }
    }

    if (this.getSetting('invert_tilt')) {
      if (data.windowcoverings_tilt_up) {
        data = {
          ...data,
          windowcoverings_tilt_down: true,
          windowcoverings_tilt_up: undefined,
          tilt: 'down',
        };
      } else if (data.windowcoverings_tilt_down) {
        data = {
          ...data,
          windowcoverings_tilt_up: true,
          windowcoverings_tilt_down: undefined,
          tilt: 'up',
        };
      }
    }
    return data;
  }

  isTopDownModel() {
    let isATopDownModel = false;
    this.getCapabilities().forEach((capability) => {
      if (capability === WINDOWCOVERINGS_STATE_RAIL_3) {
        isATopDownModel = true;
      }
    });
    return isATopDownModel;
  }

  parseOutgoingData(data) {
    if (data.cmd === 'my') {
      const stateType = this.isTopDownModel() ? WINDOWCOVERINGS_STATE_RAIL_3 : WINDOWCOVERINGS_STATE_RAIL_1;
      data[stateType] = 'idle';
      delete data.cmd;
    }

    if (data[WINDOWCOVERINGS_STATE_RAIL_1] !== undefined) {
      data = { ...data, rail: 1 };
    }

    if (data[WINDOWCOVERINGS_STATE_RAIL_2] !== undefined) {
      data = { ...data, rail: 2 };
    }

    if (data[WINDOWCOVERINGS_STATE_RAIL_3] !== undefined) {
      data = { ...data, rail: 3 };
    }

    // If the rotated setting is set we invert the up/down axis of all outgoing data.
    if (!this.isPairInstance && this.getSetting('rotated') === '180') {
      if (data.cmd === 'up' || data.cmd === 'down') {
        data = { ...data, cmd: data.cmd === 'up' ? 'down' : 'up' };
      } else if (data.cmd === 'deep_up' || data.cmd === 'deep_down') {
        data = { ...data, cmd: data.cmd === 'deep_up' ? 'deep_down' : 'deep_up' };
      }

      if ((data[WINDOWCOVERINGS_STATE_RAIL_1] === 'up' || data[WINDOWCOVERINGS_STATE_RAIL_1] === 'down')) {
        data = { ...data, windowcoverings_state: data[WINDOWCOVERINGS_STATE_RAIL_1] === 'up' ? 'down' : 'up' };
      }
      if ((data[WINDOWCOVERINGS_STATE_RAIL_2] === 'up' || data[WINDOWCOVERINGS_STATE_RAIL_2] === 'down')) {
        data = { ...data, [WINDOWCOVERINGS_STATE_RAIL_2]: data[WINDOWCOVERINGS_STATE_RAIL_2] === 'up' ? 'down' : 'up' };
      }
      if ((data[WINDOWCOVERINGS_STATE_RAIL_3] === 'up' || data[WINDOWCOVERINGS_STATE_RAIL_3] === 'down')) {
        data = { ...data, [WINDOWCOVERINGS_STATE_RAIL_3]: data[WINDOWCOVERINGS_STATE_RAIL_3] === 'up' ? 'down' : 'up' };
      }
      if (!this.getSetting('invert_tilt')) {
        if (data.windowcoverings_tilt_up) {
          data = { ...data, windowcoverings_tilt_down: true, windowcoverings_tilt_up: undefined };
        } else if (data.windowcoverings_tilt_down) {
          data = { ...data, windowcoverings_tilt_up: true, windowcoverings_tilt_down: undefined };
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

};
