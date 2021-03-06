
/**
 * Module dependencies.
 */

var express = require('express');
var routes = require('./routes');
var user = require('./routes/user');

var http = require('http')
  , dns = require('dns')
  , crypto = require('crypto')
  , path = require('path')
  , irc = require('irc')
  , Primus = require('primus')
  , Q = require('q');

var app = express();

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(require('connect-assets')());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

// routes
app.get('/', routes.index);
app.get('/users', user.list);

var server = http.createServer(app)
  , primus = new Primus(server, { transformer: 'browserchannel' });

server.listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});

var clients = {};
var clientCount = 0;

primus.on('connection', function (spark) {

  clientCount++;
  clients[spark.id] = {
    spark: spark,
    irc: null
  };
  spark.on('data', function (data) {
    var self = this;

    if (data.action === 'connect') {
      var room = data.room;
      var user = data.user;
      var server = data.server;

      // make webchat user identifiable
      var sha256 = crypto.createHash('sha256');
      sha256.update(spark.address.ip);
      var username = sha256.digest('base64').substr(0, 9);
      var firedConnect = false;

      var connect = function(hostname){
        if(firedConnect){
          return false;
        }
        firedConnect = true;

        var connection = new irc.Client(server, user, { 
          userName: username,
          realName: hostname+' via llunchat'
        });

        connection.once('registered', function(){
          if(!data.nickserv){
            connection.join(room);
            return;
          }
          // OFTC use IDENTIFY password [nick]
          // Espernet use IDENTIFY [nick] password
          connection.say('NickServ', 'IDENTIFY ' + data.nickserv);
          var nickservTimeout = setTimeout(function(){
            nickservCb('NickServ');
          }, 1000);
          var nickservCb = function(from){
            if(from === 'NickServ'){
              connection.join(room);
              connection.removeListener('message', nickservCb);
              clearTimeout(nickservTimeout);
            }
          };
          connection.addListener('message', nickservCb);
        });

        clients[spark.id].irc = connection;
        connection.addListener('join', function (room, user) {
          spark.write({ action: 'join', room: room, user: user});
        });
        connection.addListener('part', function (room, user, reason) {
          spark.write({ action: 'part', room: room, user: user });
        });
        connection.addListener('quit', function (user, reason, rooms) {
          spark.write({ action: 'quit', rooms: rooms, user: user });
        });
        connection.addListener('message', function (from, room, message) {
          spark.write({ action: 'message', from: from, room: room, message: message });
        });
        connection.addListener('action', function (from, room, message) {
          spark.write({ action: 'message', from: from, room: room, message: '\001ACTION '+message+'\001' });
        });
        connection.addListener('names', function (room, users) {
          spark.write({ action: 'names', room: room, users: users});
        });
        connection.addListener('nick', function (oldName, newName, room) {
          spark.write({ action: 'nick', room: room, oldname: oldName, newname: newName });
        });
        connection.addListener('topic', function (channel, topic, nick, message) {
          spark.write({ action: 'topic', channel: channel, topic: topic, nick: nick, message: message });
        });
        connection.addListener('error', function (message) {
          console.error ('error: ' + JSON.stringify(message));
        });
      }

      var dnsTimeout = setTimeout(function(){
        console.error("DNS Timeout for "+spark.address.ip);
        connect(spark.address.ip);
      }, 500);

      Q.nfcall(dns.reverse, spark.address.ip)
        .then(function (hostname) {
          clearTimeout(dnsTimeout);
          if (hostname.length > 0) {
            connect (hostname[0]);
          }
          else {
            connect(spark.address.ip);
          }
        })
        .fail(function () {
          clearTimeout(dnsTimeout);
          connect(spark.address.ip);
        }).done();

    }
    else if (data.action === 'say') {
      var connection = clients[spark.id].irc;
      connection.say(data.room, data.message);
    }
    else if (data.action === 'command') {
      var arguments = data.arguments;
      var connection = clients[spark.id].irc;
      arguments[0] = arguments[0].substring(1);
      connection.send.apply(connection, arguments);
    }

  });
});
primus.on('disconnection', function (spark) {
  if (clients[spark.id].irc) {
    clients[spark.id].irc.disconnect('llunchat: Client close browser');
  }
  delete clients[spark.id];
  clientCount--;
});

primus.save(__dirname +'/assets/js/libs/primus.js');

