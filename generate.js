"use strict";

var fs = require('fs'),
	path = require('path'),
	http = require('http'),
	tiptoe = require('tiptoe'),
	async = require('async');

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
	'manaCost',
	'cmc',
	'colorIdentity',
	'artist',
	'number',
	'type',
	'text',
	'printings',
	'flavor',
	'layout',
	'multiverseid',
	'power',
	'toughness',
	'rarity',
	'subtypes',
	'types'
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
				async.eachSeries(cards, function(card, cardCB) {
					var i;
					var contents = [];
					for (i = 0; i < csvFields.length; i++) {
						var curEntry = card[csvFields[i]];
						if (!curEntry)
							curEntry = "";

						if (Array.isArray(curEntry)) {
							curEntry = curEntry.join(',');
						};

						if ((typeof curEntry) === 'number') {
							curEntry = '' + curEntry;
						}

						if ((typeof curEntry) !== 'string') {
							console.log("Something is wrong!");
							console.log(curEntry);
						}
						curEntry = curEntry.replace(/\n/g, '\\n');
						curEntry = curEntry.replace(/"/g, '""');

						if (curEntry.indexOf(',') >= 0 || curEntry.indexOf('"') >= 0) {
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

		async.eachSeries(keys, function(setName, foreachCB) {
			saveSet(setName, setData[setName].cards, foreachCB);
		}, this);
	},
	function finish(err) {
		if (err)
			throw(err);

		console.log('done');
	}
);
