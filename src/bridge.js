const _                  = require('lodash');
const config             = require('./config.js');
const Atem               = require('./device/atem.js');
const MIDIControlPanel   = require('./device/midi_control_panel.js');
const atemSoftwareConfig = require('./utils/atem_software_config.js');

const bridge = () => {
  let atem;
  let panel;
  let pgmPvwButtons;
  let USK1_invert = 0;
  let USK2_invert = 0;

  const onAtemPgmPvwChange = (type, data) => {
    const index = pgmPvwButtons.findIndex((b) => b.id == data[0]);
    if (index >= 0) {
      panel.turnonButtonInGroup(type, index);
    }
  };

  const onAtemFTBChange = (ftbState) => {
    let lightState = 'off';
    
    if (ftbState.inTransition) {
      lightState = 'on';
    } else if (ftbState.isFullyBlack) {
      lightState = 'flashing';
    }

    panel.fadeToBlackLight(lightState);
  }

  const syncState = () => {
    _.each(atem.getPgmPvwState(), (data, type) => {
      onAtemPgmPvwChange(type, data);
    });
    onAtemFTBChange(atem.getFTBState());
  };

  const onControllerReconnect = () => {
    console.log("onControllerConnect");
    syncState();
  };
  
  const onControllerButtonPress = async (group, name, param) => {
    switch (group) {
      case 'PGM':
      case 'PVW':
        const btnNum = Number(name);
        if (_.isFinite(btnNum)) {
          const btnId = pgmPvwButtons[name - 1]?.id;
          if (btnId) {
            await atem.changeInput(group, btnId);
          }
        }
        break;
	  case 'USK':
	    switch (name) {
		  case 'USK_1':
	        if (param == 'invert') {
	          if (USK1_invert == 1) USK1_invert = 0; else USK1_invert = 1;
			  console.log("USK_1 invert: ", USK1_invert);
		      await atem.setUSKLumaSettings({'invert' : USK1_invert}, 0, 0);
	        }
		    break;
	    case 'USK_2':
	        if (param == 'invert') {
	          if (USK2_invert == 1) USK2_invert = 0; else USK2_invert = 1;
			  console.log("USK_2 invert: ", USK2_invert);
		      await atem.setUSKLumaSettings({'invert' : USK2_invert}, 0, 1);
	        }
		    break;
		}
		break;
      case 'transition':
        await atem.transition(name);
        break;
    }
  };

  const onControllerFader = async (name, param, value) => {
    switch (name) {
	  case 'USK_1':
		switch (param) {
		  case 'clip':
		    await atem.setUSKLumaSettings({'clip' : Math.round(value/10)}, 0, 0);
		    break;
		  case 'gain':
			await atem.setUSKLumaSettings({'gain' : Math.round(value/10)}, 0, 0);
		    break;
		}
		break;
    }
  };
  
  const onControllerTbar = async (name, value) => {
    switch (name) {
      case 'transition':
        await atem.setFaderPosition(value);
        break;
    }
  };

  const start = async () => {
    panel = new MIDIControlPanel(config.midiDevice, {
      onButtonPress: onControllerButtonPress,
      onFader:       onControllerFader,
	  onTbar:        onControllerTbar,
      onReconnect:   onControllerReconnect,
    });
    atem = new Atem(config.atemIP, {
      onPgmPvwChange: onAtemPgmPvwChange,
      onFTBChange:    onAtemFTBChange,
    });
    await atem.connect();
    pgmPvwButtons = await atemSoftwareConfig.buttonOrder();

    syncState();
  }

  const stop = async () => {
    await atem.disconnect();
    panel.disconnect();
  }

  return {
    start,
    stop,
  };
};

module.exports = bridge;
