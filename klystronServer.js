/* klystronServer.js sets up an LCLS Klystron CUD session via websocket.
Since the klystron CUD connects to hundreds of PVs for a single panel (six PVs per klystron, for about 88 klystrons), just setting up individual camonitors for each PV for each user of the CUD is a pretty inefficient way to do things.  Instead, klystronServer gets all the PVs one time, computes a klystron's state from its five status PVs, and broadcasts messages whenever the state changes.  Behind the scenes, it is still using the same caClient that all individual PV requests go through, so there shouldn't be any redundant camonitors.*/

//There are six different 'status words', which are all bitmasks that give information about klystrons.
var STATUS_WORDS = ["HSTA","STAT","SWRD","DSTA","BADB","HDSC"];

//Each word has a bunch of flags, each of which correspond to a bit in the word.
//HSTA flags
var HSTA_ONLINE = 0x1;
var HSTA_MAINTENANCE = 0x2;
var HSTA_OFFLINE = 0x4;

//STAT flags
var STAT_OK = 0x0001;
var STAT_MAINTENANCE = 0x0002;
var STAT_OFFLINE = 0x0004;
var STAT_OUT_OF_TOL = 0x0008;
var STAT_CAMAC_ERR = 0x0010;
var STAT_DEAD_MAN = 0x0040;
var STAT_FOX_HOME_ERR = 0x0080;
var STAT_PHASE_MEAN = 0x0200;
var STAT_IPL_REQUIRED = 0x1000;
var STAT_UPDATE_REQUIRED = 0x4000;

//SWRD flags
var SWRD_BAD_CABLE = 0x0001;
var SWRD_MKSU_PROTECT = 0x0002;
var SWRD_NO_TRIGGERS = 0x0004;
var SWRD_MOD_FAULT = 0x0008;
var SWRD_LOW_RF = 0x0020;
var SWRD_AMPL_MEAN = 0x0040;
var SWRD_AMPL_JITTER = 0x0080;
var SWRD_LOST_PHASE = 0x0100;
var SWRD_PHASE_MEAN = 0x0200;
var SWRD_PHASE_JITTER = 0x0400;
var SWRD_NO_SAMPLE_RATE = 0x4000;
var SWRD_NO_ACCELERATE_RATE = 0x8000;

//DSTA Flags
var DSTA_SLED_MOTOR_LIMIT = 0x0000000000000004;
var DSTA_SLED_UPPER_NEEDLE = 0x0000000000000008;
var DSTA_SLED_LOWER_NEEDLE = 0x0000000000000010;
var DSTA_ELECTROMAGNET_CURRENT = 0x0000000000000020;
var DSTA_KLYSTRON_TEMPERATURE = 0x0000000000000040;
var DSTA_REFLECTED_ENERGY = 0x0000000000000100;
var DSTA_OVER_VOLTAGE = 0x0000000000000200;
var DSTA_OVER_CURRENT = 0x0000000000000400;
var DSTA_PPYY_RESYNC = 0x0000000000000800;
var DSTA_ADC_READ_ERROR = 0x0000000000001000;
var DSTA_ADC_OUT_OF_TOL = 0x0000000000002000;
var DSTA_WATER_SUMMARY_FAULT = 0x0000000000010000;
var DSTA_WATER_ACCEL_1 = 0x0000000000020000;
var DSTA_WATER_ACCEL_2 = 0x0000000000040000;
var DSTA_WATER_WAVEGUIDE_1 = 0x0000000000080000;
var DSTA_WATER_WAVEGUIDE_2 = 0x0000000000100000;
var DSTA_WATER_KLYSTRON = 0x0000000000200000;
var DSTA_24V_BATTERY = 0x0000000000400000;
var DSTA_WAVEGUIDE_VACUUM = 0x0000000000800000;
var DSTA_KLYSTRON_VACUUM = 0x0000000002000000;
var DSTA_KLYSTRON_MAGNET_CURRENT = 0x0000000004000000;
var DSTA_KLYSTRON_MAGNET_BREAKER = 0x0000000008000000;
var DSTA_MKSU_TRIGGER = 0x0000000010000000;
var DSTA_MOD_AVAILABLE = 0x0000000020000000;
var DSTA_LOCAL_MODE = 0x0000000800000000;
var DSTA_MOD_EVOC = 0x0000002000000000;
var DSTA_MOD_EOLC = 0x0000004000000000;
var DSTA_MOD_TRIGGER_OVERCURRENT = 0x0000008000000000;
var DSTA_MOD_HV_ON = 0x0000010000000000;
var DSTA_MOD_EXT_FAULT = 0x0000020000000000;
var DSTA_MOD_FAULT_LOCKOUT = 0x0000040000000000;
var DSTA_MOD_HV_READY = 0x0000080000000000;
var DSTA_MOD_INTERLOCKS_OK = 0x0000100000000000;
var DSTA_KLYSTRON_HEATER_DELAY = 0x0000200000000000;
var DSTA_VVS_VOLTAGE = 0x0000400000000000;
var DSTA_CONTROL_POWER = 0x0000800000000000;
var DSTA_VETO_ASSERT = 0x0001000000000000;
var DSTA_VETO_DISABLED = 0x0002000000000000;
var DSTA_VETO_TESTING = 0x0004000000000000;
var DSTA_MOD_TRIGGERING = 0x0008000000000000;

//BADB Flags
var BADB_POOR_TIMING = 0x00000001;
var BADB_BAD_TIMING = 0x00000002;
var BADB_POOR_ENLD = 0x00000004;
var BADB_BAD_ENLD = 0x00000008;
var BADB_POOR_STBY_TIMING = 0x00000010;
var BADB_BAD_STBY_TIMING = 0x00000020;

//HDSC Flags
var HDSC_TO_BE_REPLACED = 0x00000004;
var HDSC_AWAITING_RUN_UP = 0x00000008;
var HDSC_CHECK_PHASE = 0x00000040;


//Generate the list of LCLS klystrons.
var LI20 = {                                            5: "51", 6: "61", 7: "71", 8: "81"};
var LI21 = {0: "1", 1: "11", 2: "21", 3: "31", 4: "41", 5: "51", 6: "61", 7: "71", 8: "81"};
var LI22 = {0: "1", 1: "11", 2: "21", 3: "31", 4: "41", 5: "51", 6: "61", 7: "71", 8: "81"};
var LI23 = {0: "1", 1: "11", 2: "21", 3: "31", 4: "41", 5: "51", 6: "61", 7: "71", 8: "81"};
var LI24 = {0: "1", 1: "11", 2: "21", 3: "31", 4: "41", 5: "51", 6: "61",          8: "81"};
var LI25 = {0: "1", 1: "11", 2: "21", 3: "31", 4: "41", 5: "51", 6: "61", 7: "71", 8: "81"};
var LI26 = {0: "1", 1: "11", 2: "21", 3: "31", 4: "41", 5: "51", 6: "61", 7: "71", 8: "81"};
var LI27 = {0: "1", 1: "11", 2: "21", 3: "31", 4: "41", 5: "51", 6: "61", 7: "71", 8: "81"};
var LI28 = {0: "1", 1: "11", 2: "21", 3: "31", 4: "41", 5: "51", 6: "61", 7: "71", 8: "81"};
var LI29 = {0: "1", 1: "11", 2: "21", 3: "31", 4: "41", 5: "51", 6: "61", 7: "71", 8: "81"};
var LI30 = {0: "1", 1: "11", 2: "21", 3: "31", 4: "41", 5: "51", 6: "61", 7: "71", 8: "81"};
var klystrons = {20: LI20, 21: LI21, 22: LI22, 23: LI23, 24: LI24, 25: LI25, 26: LI26, 27: LI27, 28: LI28, 29: LI29, 30: LI30};
for (var sector in klystrons) {
    for (var station in klystrons[sector]) {
        var PV;
        if (station == 0) {
            PV = "SBST:LI" + sector + ":1";
        } else {
            PV = "KLYS:LI" + sector + ":" + station + "1"; //Something like KLYS:LI24:31
        }
        klystrons[sector][station] = {"PV": PV, "sector": sector, "station": station};
        for (var stat_word_index in STATUS_WORDS) {
            klystrons[sector][station][STATUS_WORDS[stat_word_index]] = null;
        }
    }
}

function startKlystronCUDSession(socket, caClient) {
    console.log("Starting Klystron CUD Session.");
    
    var pv_queue = [];
    
    for (var sector in klystrons) {
        for (var station in klystrons[sector]) {
            var klys = klystrons[sector][station];
            for (var stat_word_index in STATUS_WORDS) {
                var status_word = STATUS_WORDS[stat_word_index];
                var status_pv = klys["PV"] + ":" + status_word;
                
                pv_queue.push(status_pv);
            }
        }
    }
    
    function pv_callback(err, result, monitor) {
        if (err) {
            console.log("Error while connecting to klystron CUD PV: status_pv");
            return;
        }
        
        monitor.addSocketConnection();
        
        //This is the initial piece of data we get when the connection opens.
        calcKlystronState(socket, klys, status_word, result);
        
        //This callback happens on all following PV changes.
        monitor.on('cached', function(data) {
            calcKlystronState(socket, klys, status_word, data);
        });
        
        var nextPV = pv_queue.shift();
        if (nextPV) {
            caClient.get(nextPV, pv_callback);
        }
    }
    
    caClient.get(pv_queue.shift(),pv_callback);
    
    socket.on('disconnect',function(){
        for (var sector in klystrons) {
            for (var station in sector) {
                var klys = klystrons[sector][station];
                for (var stat_word_index in STATUS_WORDS) {
                    var status_word = STATUS_WORDS[stat_word_index];
                    var status_pv = klys["PV"] + ":" + status_word;
                    caClient.get(status_pv,function(err, result, monitor) {
                        monitor.removeSocketConnection();
                    });
                }
            }
        }
    });
}

/* calcKlystronState updates a klystron's state when one of its words updates, then emits a websocket message if the state changes. */
function calcKlystronState(socket, klys, status_word, new_value) {
    klys[status_word] = new_value;
    
    var readyForStateCalc = true;
    for (var stat_word_index in STATUS_WORDS) {
        if (klys[status_word] === null) {
            readyForStateCalc = false;
        }
    }
    
    if (readyForStateCalc) {
        var old_state = klys.state;
        
        if ((klys["HSTA"] & (HSTA_MAINTENANCE | HSTA_OFFLINE)) || (klys["HDSC"] & (HDSC_CHECK_PHASE | HDSC_AWAITING_RUN_UP | HDSC_TO_BE_REPLACED))) {
            klys.state = "Offline";
        }
        
        if ((klys["HSTA"] & HSTA_ONLINE) && (klys["STAT"] & STAT_OK) && (klys["SWRD"] & SWRD_NO_ACCELERATE_RATE)) {
            klys.state = "Deactivated";
        }
        
        if ((klys["HSTA"] & HSTA_ONLINE) && (klys["STAT"] & STAT_OK) && (klys["SWRD"] & ~SWRD_NO_ACCELERATE_RATE)) {
            klys.state = "On Beam";
        }
        
        if (klys.state != old_state) {            
            socket.emit("update",klys);
        }
    }
}

exports.startKlystronCUDSession = startKlystronCUDSession;