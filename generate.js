"use strict";

var fs = require('fs'),
	path = require('path'),
	http = require('http'),
	tiptoe = require('tiptoe');
//var mtgcsv = require('./mtgcsv.js');

Array.prototype.forEachCallback = function(callback, finishCallback) {
	var current = 0;
	var self = this;

	function next() {
		if (current >= self.length) {
			if (finishCallback) {
				finishCallback.bind(self);
				finishCallback();
			}
			return;
		}

		var currentItem = self[current++];
		callback.bind(currentItem);
		callback(currentItem, next);		
	}

	next();
}

function createDir(dir, callback) {
	var dir = path.join(__dirname, dir);
	fs.mkdir(dir, function(e) {
		if (!e)
			return(setImmediate(callback));
		if (e.code == 'EEXIST')
			return(setImmediate(callback));

		throw(e);
	});
}

function downloadJSON(url, fn, callback) {
	function getData() {
		var retData = undefined;
		fs.readFile(fn, 'utf8', function(err, data) {
			if (!err) {
				retData = data;
			}

			if (callback)
				callback(undefined, retData);
		})
	}

	var request = http.get(url, function(response) {
		var file = fs.createWriteStream(fn);
		response.pipe(file);

		file.on('finish', function() {
			file.close(getData);
		});
	}).on('error', function(err) {
		if (callback)
			callback(err.message);
	});	
}

function downloadVersionJSON(callback) {
	var url = 'http://mtgjson.com/json/version.json';
	var fn = path.join(__dirname, 'json', 'version.json');

	downloadJSON(url, fn, callback);
}

function finish(err) {
	console.log('done');
	if (err)
		throw(err);
}

// Read current version
var curVer = 0;
var remoteVer = 0;

function readVersion(callback) {
	fs.readFile(path.join(__dirname, 'json', 'version.json'), 'utf8', function(err, data) {
		if (err) {
			console.log("no version information found.");
		}
		else {
			curVer = data;
		}

		if (callback)
			callback();
	});
}

var csvFields = [
	'name',
	'cost',
	'artist',
	'number',
	'type',
	'text',
	'printings'
];

function saveSet(setName, cards, callback) {
	var fn = path.join(__dirname, 'csv', setName + '.csv');
	fs.open(fn, 'w', function (err, fd) {
		if (err)
			return(setImmediate(function() {
				if (callback) callback(err);
			}));

		tiptoe(
			function header() {
				fs.write(fd, csvFields.join(',') + "\n", this);
			},
			function body() {
				cards.forEachCallback(function(card, cardCB) {
					var i;
					var contents = [];
					for (i = 0; i < csvFields.length; i++) {
						var curEntry = card[csvFields[i]];
						if (!curEntry)
							curEntry = "";

						if (Array.isArray(curEntry)) {
							curEntry = curEntry.join(',');
						};

						curEntry = curEntry.replace("\n", '\\n');

						if (curEntry.indexOf(',') >= 0) {
							curEntry = '"' + curEntry + '"';
						}
						contents.push(curEntry);
					}
					fs.write(fd, contents.join(',') + "\n", cardCB);
				}, this);
			},
			function finish(err) {
				if (err)
					throw(err);

				fs.close(fd, callback);
			}
		);
	});
}

tiptoe(
	function init() {
		createDir('json', this.parallel());
		createDir('csv', this.parallel());
	},
	function() {
		var fn = path.join(__dirname, 'json', 'AllSets-x.json');
		fs.exists(fn, function(e) {
			if (e) {
				fs.readFile(fn, 'utf8', this);
			}
			else {
				console.log("Downloading...");
				var url = 'http://mtgjson.com/json/AllSets-x.json';
				downloadJSON(url, fn, this);
			}
		}.bind(this));
	},
	function processFile(data) {
		var setData = JSON.parse(data);
		var keys = Object.keys(setData);
		var i;

		keys.forEachCallback(function(setName, foreachCB) {
			saveSet(setName, setData[setName].cards, foreachCB);
		}, this);
	},
	function finish(err) {
		if (err)
			throw(err);

		console.log('done');
	}
);

/*
tiptoe(
	function init() {
		checkDir(this);
	},
	function readStuff() {
		readVersion(this);
	},
	function fetchVersion() {
		downloadVersionJSON(this);
	},
	function compareVersions(remoteVersion) {
		console.log("Current version: " + curVer);
		console.log("Remote version: " + remoteVersion);
		
		var fn = path.join(__dirname, 'json', 'AllSets-x.json');
		if (remoteVersion != curVer) {
			// Fetch file
			console.log("Downloading new version...");
			var url = 'http://mtgjson.com/json/AllSets-x.json';
			downloadJSON(url, fn, this);
		}
		else {
			console.log("Using cached version");
			fs.readFile(fn, 'utf8', this);
		}
	},
	function processFile(data) {
		this();
	},
	function finish(err) {
		console.log('finish()');
		if (err)
			throw(err);

		console.log('done.');
	}
);
*/
/*
checkDir(function(){
	downloadJSON(finish);
});
*/