var server = require("./server");
var router = require("./router");
var requestHandlers = require("./requestHandlers");
var captureStatus = require("./captureStatus");
var handle = {}
handle["/PV"] = requestHandlers.PV;
handle["/history"] = requestHandlers.history;
handle["/status"] = requestHandlers.status;
handle["/PV/PV"] = requestHandlers.PV;
handle["/PV/history"] = requestHandlers.history;
server.start(router.route, handle);