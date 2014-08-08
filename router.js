/*
router.js - The router takes a list of request handlers, and the pathname and query object from a client request.
'response' is our still-incomplete response to the user's request.  It will be completed and sent to the user later.
*/
function route(handle, pathname, query, response) {
	if (typeof handle[pathname] === 'function') { //The handle object comes from index.js
		handle[pathname](response, query);
	} else {
		response.writeHead(404,{"Content-Type": "text/plain","Access-Control-Allow-Origin": "*"});
		response.write("404 Not found");
		response.end();
	}
}

exports.route = route;