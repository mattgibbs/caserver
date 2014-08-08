/*
index.js - This is the entry point for the entire application.  To start the server, you run 'node index.js'.

This file doesn't do too much on its own, it just loads the different parts of the server, then runs server.start().
*/

var server = require("./server");
var router = require("./router");
var requestHandlers = require("./requestHandlers");
var captureStatus = require("./captureStatus");
var handle = {} //handle is a dictionary that maps URLs to functions which the server runs.
handle["/PV"] = requestHandlers.PV; //for example, when a user visits server-address/PV, the 'PV' function in requestHandlers.js is run.
handle["/history"] = requestHandlers.history;
handle["/status"] = requestHandlers.status;
handle["/PV/PV"] = requestHandlers.PV;
handle["/PV/history"] = requestHandlers.history;
server.start(router.route, handle);