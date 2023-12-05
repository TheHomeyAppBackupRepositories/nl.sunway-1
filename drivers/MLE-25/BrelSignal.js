'use strict';

const { RFSignal, RFUtil } = require('homey-rfdriver');

// Helper function to turn a number into a bitString of 8 long
const numberToCmdString = (cmd) => cmd.toString(2).padStart(8, '0');
// The commands mapped to the corresponding bitString
const commandMap = new Map([
  ['up', numberToCmdString(0x11)],
  ['my', numberToCmdString(0x55)],
  ['idle', numberToCmdString(0x55)],
  ['down', numberToCmdString(0x33)],
  ['deep_up', numberToCmdString(0x1E)],
  ['deep_down', numberToCmdString(0x3C)],
  ['p2', numberToCmdString(0xCC)],
]);
// The bitStrings mapped to the corresponding command
const stateMap = new Map(Array.from(commandMap.entries()).map((entry) => {
  // Remove the last bit of the command since Homey core does not receive this bit correctly. Doesn't affect performance
  entry[1] = entry[1].substr(0, 7);
  return entry.reverse();
}));

module.exports = class extends RFSignal {

  static FREQUENCY = '433';
  static ID = 'brel';

  // This method converts a JavaScript object command
  // into a payload for our signal.
  static commandToPayload(data) {
    if (data) {
      let command;
      if (data.windowcoverings_tilt_up || data.windowcoverings_tilt_down) {
        command = commandMap.get(data.windowcoverings_tilt_up ? 'up' : 'down');
      } else {
        command = commandMap.get(data.cmd || data.windowcoverings_state);
      }
      if (command) {
        const address = RFUtil.bitStringToBitArray(data.address);
        const channel = RFUtil.bitStringToBitArray(data.channel);
        const cmd = command.split('').map(Number);
        const result = address.concat(channel, cmd);
        return result;
      }
    }
    return null;
  }

  // This method converts a received payload
  // into a JavaScript object command.
  static payloadToCommand(payload) {
    // Check if the bitString of bit 32-39 exists in the stateMap
    if (stateMap.has(RFUtil.bitArrayToString(payload.slice(32, 39)))) {
      // Create the data object
      const data = {
        address: RFUtil.bitArrayToString(payload.slice(0, 24)),
        channel: RFUtil.bitArrayToString(payload.slice(24, 32)),
        group: payload.slice(24, 32).indexOf(1) === -1,
        cmd: stateMap.get(RFUtil.bitArrayToString(payload.slice(32, 39))),
      };
      // If the command corresponds to a windowcoverings_state capability value set the value to data.windowcoverings_state
      // RFDriver will automatically call this.setCapabilityValue('windowcoverings_state', data.windowcoverings_state);
      if (data.cmd === 'idle') {
        data.windowcoverings_state = data.cmd;
      }
      // Initially we assume the up/down command is tilt since it triggers going up/down after holding it 2 seconds
      if (data.cmd === 'up' || data.cmd === 'down') {
        data[`windowcoverings_tilt_${data.cmd}`] = true;
        data.tilt = data.cmd;
      }
      // Set data.id to a unique value for this device. Since a remote has an address and 5 channels and each
      // channel can contain a different blind
      data.id = `${data.address}:${data.channel}`;
      return data;
    }
    return null;
  }

  // This method takes a command object
  // and returns a device-unique data object
  static commandToDeviceData(command) {
    return {
      address: command.address,
      channel: command.channel,
      group: command.group,
      id: command.id,
    };
  }

  // This method is invoked when a new receiver is added
  // We can generate a random address, as if someone pressed
  // the button on a remote.
  static createPairCommand() {
    return this.tx({ cmd: 'p2' })
      .then(() => {
        return new Promise((res) => setTimeout(() => res(this.tx({ cmd: 'p2' })), 1000));
      })
      .then(() => {
        return new Promise((res) => setTimeout(() => res(this.tx({ cmd: 'up' })), 1000));
      });
  }

};
