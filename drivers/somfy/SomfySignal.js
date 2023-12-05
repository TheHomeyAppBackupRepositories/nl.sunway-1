'use strict';

const { RFSignal, RFUtil } = require('homey-rfdriver');

// The commands mapped to the corresponding commandId
const cmdMap = new Map([
  ['idle', 0x1],
  ['up', 0x2],
  ['down', 0x4],
  ['program', 0x8],
  ['ext', 0xB],
]);

const extCmdMap = new Map([
  ['tilt_up', 0x30],
  ['tilt_down', 0x38],
]);

module.exports = class extends RFSignal {

  static FREQUENCY = '433';
  static ID = 'somfy';

  static commandToDeviceData(command) {
    if (command !== null) {
      return {
        address: command.address,
        cmd: command.cmd,
        rollingCode: command.rollingCode,
      };
    }
    return null;
  }

  static commandToPayload({
    address,
    cmd,
    rollingCode,
    extCmd,
    repeatCount,
  }) {
    rollingCode = Number(rollingCode);
    address = parseInt(address, 2);

    // Add data to payload array
    const payload = [
      0xA0,
      cmdMap.get(cmd) << 4,
      rollingCode >> 8,
      rollingCode,
      address,
      (address >> 8),
      (address >> 16),
    ].map((byte) => byte & 0xFF);
    // Calculate checksum and add to payload[1]
    payload[1] |= this.calculateChecksum(payload);

    // XOR payload bytes
    for (let i = 1; i < payload.length; i++) {
      payload[i] ^= payload[i - 1];
    }

    if (cmd === 'ext') {
      // push constant
      payload.push(0x84);
      // push extCmd
      payload.push(extCmdMap.get(extCmd));
      const repetitions = (repeatCount || 1) & 0xF;
      // push repetitions with checksum
      payload.push((repetitions << 4) | (this.calculateChecksum(payload.slice(-2)) ^ repetitions));
    }

    // convert bytes to bit arrays and flatten array
    return payload.reduce((bitArray, byte) => bitArray.concat(RFUtil.numberToBitArray(byte, 8)), []);
  }

  static calculateChecksum(bytes) {
    return bytes.reduce((chkSum, byte) => chkSum ^ byte ^ (byte >> 4), 0) & 0xF;
  }

  static createPairCommand() {
    const data = {
      address: RFUtil.generateRandomBitString(24),
      cmd: 'program',
      rollingCode: 0,
      repeatCount: 6,
    };
    data.id = data.address;

    return data;
  }

};
