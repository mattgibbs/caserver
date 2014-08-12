caserver
========

A node.js server to get channel access data via the web.

This server listens for requests, parses the 'PV' field from the GET request, uses channel access to get the PV data, then sends it back to the user as JSON.

Once a PV is requested, a monitor is set up for the PV, and whenever new data comes in, a cache is updated.  All requests to that PV recieve the latest cached data.  Only one monitor will be created per PV, no matter how many different users request it.  If the monitor recieves no additional requests for ten seconds, it is closed.

Issues
------
Right now the server spawns individual camonitor processes for each PV, which is a memory hog, and leads to unreliable results when connected to hundreds of PVs (you'll start missing monitor updates).  Long term, it would be good to create a C-based channel access client which can make a lightweight thread for each PV, and open a single link of communication to and from the node.js server
