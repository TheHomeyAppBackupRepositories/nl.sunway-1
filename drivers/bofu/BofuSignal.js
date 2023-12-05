'use strict';

const { RFSignal } = require('homey-rfdriver');

const commandToStateMap = new Map([
  [0xC, 'up'],
  [0x5, 'idle'],
  [0x1, 'down'],
  [0xe, 'rail2.up'],
  [0x7, 'rail2.idle'],
  [0x3, 'rail2.down'],
  [0xC + 0x81, 'rail3.up'], // only for rail 3 we also count the next byte
  [0x5 + 0x81, 'rail3.idle'], // only for rail 3 we also count the next byte
  [0x1 + 0x81, 'rail3.down'], // only for rail 3 we also count the next byte
  [0x4, 'confirm'], // note; only for rail 1, rail 2 & 3 have other an other value
  [0x2, 'set_limit'], // note; only for rail 1, rail 2 & 3 have other an other value
]);

const stateToCommandMap = new Map([
  ['confirm', 0x4],
  ['set_limit', 0x2],
  ['up', 0xC],
  ['idle', 0x5],
  ['down', 0x1],
  ['rail2.up', 0xe],
  ['rail2.idle', 0x7],
  ['rail2.down', 0x3],
  ['rail3.up', 0xC],
  ['rail3.idle', 0x5],
  ['rail3.down', 0x1],
]);

const WINDOWCOVERINGS_STATE_RAIL_1 = 'windowcoverings_state';
const WINDOWCOVERINGS_STATE_RAIL_2 = 'windowcoverings_state.rail2';
const WINDOWCOVERINGS_STATE_RAIL_3 = 'windowcoverings_state.rail3';

module.exports = class extends RFSignal {

  static FREQUENCY = '433';
  static ID = 'bofu';

  static commandToPayload(data) { // Convert a data object to a bit array to be send
    if (data && Object.prototype.hasOwnProperty.call(data, 'address')) {
      let command;
      const isTiltCommand = data.windowcoverings_tilt_up || data.windowcoverings_tilt_down;

      if (isTiltCommand) {
        command = stateToCommandMap.get(data.windowcoverings_tilt_up ? 'up' : 'down');
      } else {
        const rail2Mapping = {
          up: 'rail2.up',
          down: 'rail2.down',
          idle: 'idle',
        };
        const rail3Mapping = {
          up: 'rail3.up',
          down: 'rail3.down',
          idle: 'idle',
        };

        command = stateToCommandMap.get(
          data.cmd
          || data[WINDOWCOVERINGS_STATE_RAIL_1]
          || rail2Mapping[data[WINDOWCOVERINGS_STATE_RAIL_2]]
          || rail3Mapping[data[WINDOWCOVERINGS_STATE_RAIL_3]],
        );
      }

      if (command) {
        const bytes = [
          (data.address >> 8) & 0xFF,
          data.address & 0xFF,
          ((command << 4) | data.unit) & 0xFF,
          (data.rail === 3 ? 0x81 : 0x01) + (isTiltCommand ? 0x10 : 0x00),
        ];
        const bits = bytes.concat(this.getChecksumForByteArray(bytes))
          .reduce(
            (bitArray, byte) => bitArray.concat(byte.toString(2).padStart(8, 0).split('').map(Number)
              .reverse()),
            [],
          );
        return bits;
      }
    }
    return null;
  }

  // This method converts a received payload
  // into a JavaScript object command.
  static payloadToCommand(payload) {
    const bytes = this.payloadToByteArray(payload);

    const commandValue = (bytes[2] >> 4) + ((bytes[3] >= 0x80) ? bytes[3] : 0x0);
    if (this.checkByteArrayChecksum(bytes) && commandToStateMap.has(commandValue)) {
      const data = {
        address: (bytes[0] << 8) | bytes[1],
        unit: bytes[2] & 0xF,
        group: bytes[2] & 0xF === 0,
        rail: this.calculateRailNumber(commandValue),
        cmd: commandToStateMap.get(commandValue),
      };

      if (data.cmd === 'up' || data.cmd === 'down') {
        if (bytes[3] >> 4 === 0x1) {
          data.tilt = data.cmd;
          data[`windowcoverings_tilt_${data.cmd}`] = true;
        } else {
          data.direction = data.cmd;
          data[WINDOWCOVERINGS_STATE_RAIL_1] = data.cmd;
        }
      } else if (data.cmd === 'rail2.up' || data.cmd === 'rail2.down') {
        data[WINDOWCOVERINGS_STATE_RAIL_2] = data.cmd.replace('rail2.', '');
        data.rail = 2;
      } else if (data.cmd === 'rail3.up' || data.cmd === 'rail3.down') {
        data[WINDOWCOVERINGS_STATE_RAIL_3] = data.cmd.replace('rail3.', '');
        data.rail = 3;
      } else if (data.cmd === 'idle' || data.cmd === 'rail2.idle' || data.cmd === 'rail3.idle') {
        data[WINDOWCOVERINGS_STATE_RAIL_1] = 'idle';
        data[WINDOWCOVERINGS_STATE_RAIL_2] = 'idle';
        data[WINDOWCOVERINGS_STATE_RAIL_3] = 'idle';
      }

      data.id = (data.address << 4) | data.unit;
      return data;
    }
    return null;
  }

  // This method takes a command object
  // and returns a device-unique data object
  static commandToDeviceData(command) {
    return {
      address: command.address,
      unit: command.unit,
      group: command.group,
      id: command.id,
    };
  }

  // not used
  static createPairCommand() {
    return this.tx({ cmd: 'idle' });
  }

  /**
   * Splits the payload bits in bytes, those bytes their bits get reversed and parsed to decimal values
   *
   * Example payload:
   * 01111001 11011111 10001000 10000001 01101011
   * Revert each bytes:
   * 10011110 11111011 00010001 10000001 11010110
   * Convert each byte to dec:
   * [158, 251, 17, 129, 214]
   */
  static payloadToByteArray(payload) {
    return payload.reduce((res, bit, index) => {
      const byteIndex = Math.floor(index / 8);
      // Append bit in reverse order for each byte
      res[byteIndex] = [bit].concat(res[byteIndex] || []);
      return res;
    }, []).map((byte) => parseInt(byte.join(''), 2));
  }

  static calculateRailNumber(commandValue) {
    // Those commands to rail should match the commandToStateMap
    const commandToRailMap = {
      0xC: 1, // 12 = up
      0x5: 1, //  5 = idle
      0x1: 1, //  1 = down
      0xe: 2, // 14 = up
      0x7: 2, //  7 = idle
      0x3: 2, //  3 = down
      [0xC + 0x81]: 3, // 141 = up
      [0x5 + 0x81]: 3, // 134 = idle
      [0x1 + 0x81]: 3, // 130 = down
    };

    return commandToRailMap[commandValue] || 1;
  }

  static checkByteArrayChecksum(bytes) {
    return this.getChecksumForByteArray(bytes.slice(0, -1)) === bytes.slice(-1)[0];
  }

  static getChecksumForByteArray(bytes) {
    return bytes.reduce((result, byte) => ((0x100 | result) - byte) & 0xFF, 0x1);
  }

};
