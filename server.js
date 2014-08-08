/*
server.js - This is the http server code.  There isn't too much of it!

We just use node's built-in http module to make the server.
*/

var http = require("http");
var url = require("url");
var socketConnection = require("./requestHandlers").socketConnection;

function start(route, handle) {
  
  //Every time the server recieves an HTTP request, this function runs.
  //The 'response' object starts out blank here, and is passed from function to function, where it gets built.
  //Eventually, some function actually sends the response back to the client.
	function onRequest(request, response) {
		var parsedURL = url.parse(request.url,true);
		var pathname = parsedURL.pathname;
		var query = parsedURL.query;
		route(handle, pathname, query, response); //The route() function comes from router.js.
	}
	var pvserver = http.createServer(onRequest).listen(8888);
	
	//Set up Socket.IO for websockets support.  This could potentually be used to make very fast connections to PVs.
	var io = require('socket.io').listen(pvserver);
	io.sockets.on('connection', socketConnection);
}

console.log("Server is running...");

exports.start = start;