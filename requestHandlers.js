var spawn = require("child_process").spawn;
var fork = require("child_process").fork;
var http = require("http");
var caClient = require("./caClient");
var monitors = {};

//HTTP GET request for a PV.
function PV(response, query) {
	var PVtoGet = query["PV"];
	//We will run this if we successfully get some PV data back.
	function respondWithData(data) {
		response.writeHead(200, {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"});
		response.write(JSON.stringify(data));
		response.end();
	}
	
	//We will run this if there is some kind of a problem getting the PV data.
	function respondWithFailure() {
		response.writeHead(404,{"Content-Type": "text/plain","Access-Control-Allow-Origin": "*"});
		response.write("Could not connect to PV.");
		console.log("Cached data not availabe for " + PVtoGet);
		response.end();
	}
	
	caClient.get(PVtoGet,function(err,data){
		if (err) {
			console.log("/PV Error: " + err);
			respondWithFailure();
		} else {
			respondWithData(data);
		}
	});	
}

function status(response, query) {
	var data = caClient.status();
	response.writeHead(200, {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"});
	response.write(JSON.stringify(data));
	response.end();
}

//New WebSocket connection to the server.
/*
function socketConnection(socket) {
	socket.setMaxListeners(100);
	
	//Message from client to connect to a PV.
	socket.on('connectToPV',function (connectData) {
		var PVtoGet = connectData.pv;
		
		if(monitors[PVtoGet] === undefined) {
			spawnNewMonitor(PVtoGet,function(newMonitor){
				newMonitor.addSocketConnection();
				newMonitor.on('cached',function(dataCache){
					socket.emit(dataCache.PV,dataCache);
				});
				socket.on('disconnect', function (){
					console.log("Socket disconnected.  Removing connection to " + newMonitor.PV);
					newMonitor.removeSocketConnection();
				});
			});
		} else {
			var camonitor = monitors[PVtoGet];
			camonitor.addSocketConnection();
			camonitor.on('cached',function(dataCache){
				socket.emit(dataCache.PV,dataCache);
			});
			socket.on('disconnect', function (){
				console.log("Socket disconnected.  Removing connection to " + camonitor.PV);
				camonitor.removeSocketConnection();
			});
		}
	});
}
*/

//Get history for a PV from the channel archiver via XML-RPC.

function history(response, query) {
	var PVtoGet = query["PV"];
	//console.log("Getting history for PV: " + PVtoGet);
	//Default end time to now, start time to 24 hours ago.
	var end_sec = Number(new Date())/1000;
	var start_sec = end_sec - (60*60*24);
	var count = 800;
	var style = 0;
	//Start Time in seconds since 1970
	if (query["start"]) {
		start_sec = parseInt(query["start"],10);
	}
	//End Time in seconds since 1970
	if (query["end"]) {
		end_sec = parseInt(query["end"],10);
	}
	//Number of samples.
	if (query["count"]) {
		count = parseInt(query["count"],10);
	}
	//0 = Raw, 1 = 'Spreadsheet' (Interpolated with staircase), 2 = Averaged (bin size = end-start/count), 3 = plot binned (binned into 'count' bins), 4 = linear (linearly interpolated)
	if (query["style"]) {
		style = parseInt(query["style"],10);
	}
	
	var xmlrpc = "<?xml version='1.0'?>\n<methodCall>\n<methodName>archiver.values</methodName>\n<params>\n<param>\n<value><int>1</int></value>\n</param>\n<param>\n<value><array><data>\n<value><string>"+PVtoGet+"</string></value>\n</data></array></value>\n</param>\n<param>\n<value><int>"+start_sec.toFixed(0)+"</int></value>\n</param>\n<param>\n<value><int>0</int></value>\n</param>\n<param>\n<value><int>"+end_sec.toFixed(0)+"</int></value>\n</param>\n<param>\n<value><int>0</int></value>\n</param>\n<param>\n<value><int>"+count+"</int></value>\n</param>\n<param>\n<value><int>"+style+"</int></value>\n</param>\n</params>\n</methodCall>\n"
	var archiverRequestOptions = {
		host: 'lcls-archsrv',
		port: 80,
		path: '/cgi-bin/ArchiveDataServer.cgi',
		method: 'POST',
		headers: {'Content-Type': 'text/xml', 'Content-Length': Buffer.byteLength(xmlrpc, 'utf8') }
	};

	var req = http.request(archiverRequestOptions, function(archResponse) {
		response.writeHead(200, {"Content-Type": "text", "Access-Control-Allow-Origin": "*"});
		//console.log('STATUS: ' + archResponse.statusCode);
		//console.log('HEADERS: ' + JSON.stringify(archResponse.headers));
		archResponse.setEncoding('utf8');
		
		//Spawn a child node.js process to parse the XML, so that it doesn't block
		//the main server thread.
		
		var parser = fork(__dirname + '/parseHistory.js',[],{silent: true});
		
		parser.on('message', function(parsedObject) {
			response.write(JSON.stringify(parsedObject));
			response.end();
			parser.kill();
			//console.log(parsedObject.length);
		});
		
		archResponse.pipe(parser.stdin);
		archResponse.on('close', function(err) {
			console.log("Archiver response was closed before end.  Error: " + err);
		});
	});
	
	req.on('error', function(err) {
		console.log('Problem with request: ' + err.message);
	});
	
	req.write(xmlrpc);
	req.end();
}

exports.PV = PV;
exports.history = history;
exports.status = status;
//exports.socketConnection = socketConnection;