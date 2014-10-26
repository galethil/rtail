#!/usr/bin/env node

'use strict';

var dgram = require('dgram')
  , readline = require('readline')
  , crypto = require('crypto')
  , Writable = require('stream').Writable
  , yargs = require('yargs')
  , uuid = require('node-uuid')
  , pkg = require('./package')

// fix yargs help
uuid.v4.toString = function () { return 'self assigned' }

/**
 * Parsing argv
 */

var argv = yargs
  .usage('Usage: cmd | $0 -h [string] -p [num] [--mute]')
  .example('server | $0 -h localhost -p 43567 > server.log', 'remote + file')
  .example('server | $0 -h localhost -p 43567', 'remote + stdout')
  .example('server | $0 -h localhost -p 43567 -m', 'only remote')
  .example('server | $0 -h localhost -p 43567 -id "prod server"', 'only remote')
  .boolean('mute')
  .alias('mute', 'm')
  .describe('mute', 'don\'t pipe stdin with stdout')
  .string('host')
  .default('host', 'localhost')
  .describe('host', 'the recipient server host')
  .demand('port')
  .alias('port', 'p')
  .string('port')
  .describe('port', 'the recipient server port')
  .string('id')
  .alias('id', ['name', 'n'])
  .default('id', uuid.v4)
  .describe('id', 'the log stream id')
  .help('help')
  .alias('help', 'h')
  .version(pkg.version, 'version')
  .alias('version', 'v')
  .strict()
  .argv

/**
 * Setup pipes
 */

var lines = readline.createInterface({
  input: process.stdin,
  output: !argv.mute ? process.stdout : new Writable()
})

var isClosed = false
var isSending = false
var socket = dgram.createSocket('udp4')
var baseMessage = { id: argv.id }

/**
 * Initialize socket
 */

socket.bind(function () {
  socket.setBroadcast(true)
})

lines.on('line', function (line) {
  // set semaphore
  isSending = true

  // try to JSON parse
  try { line = JSON.parse(line) }
  catch (e) {}

  // update default message
  baseMessage.line = line

  // prepare binary message
  var buffer = new Buffer(JSON.stringify(baseMessage))

  socket.send(buffer, 0, buffer.length, argv.port, argv.host, function () {
    if (isClosed) socket.close()
    isSending = false
  })
})

lines.on('close', function () {
  isClosed = true
  if (!isSending) socket.close()
})