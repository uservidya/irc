'use strict'

angular.module('Services', [])
  .factory('Connection', function () {
    return Primus;
  })
  .factory('Emitter', function () {
    var Emitter = function () {

      var _events = {};

      this.on = function (names, listener) {
        var _names = names;
        if (typeof names === 'string') { _names = [ names ] }

        _names.forEach(function (name) {
          if (!_events[name]) _events[name] = [];
          _events[name].push (listener);
        });
      }

      this.emit = function (name, data) {
        var fns = _events[name];
        if (fns) {
          fns.forEach(function (fn) {
            fn(data);
          });
        }
      }

      this.clear = function () {
        _events = {};
      }

      this.id = Math.random();

    }
    Emitter.shared = new Emitter;
    return Emitter;
  })
  .factory('Message', function () {
    var Message = function (room, message) {
      var _room = room;
      var _message = S(message).trim().s;

      var _isCommand = function () {
        return /^\/nick/.test(message);
      }

      Object.defineProperty(this, 'data', {
        get: function () {
          if (_isCommand()) {
            return { action: 'command', arguments: _message.split(' ') };
          }
          else {
            //Replace me as action
            var message = _message;
            if (S(message).startsWith('/me')) {
              message = '\u0001ACTION ' + message.replace(/^\/me /, '') + '\u0001';
            }
            return { action: 'say', room: _room, message: message };
          }
        }
      });
    }

    return Message;
  })
  .factory('IRC', [ 'Emitter', 'Message', 'Connection', function (Emitter, Message, Connection) {
    var IRC = function () {
      var _server = '';
      var _user = '';
      var _rooms = [];
      var _nickserv = null;

      this.isJoined = false;
      var self = this;
     
      var sharedEmitter = Emitter.shared;
      var primus = Connection.connect();
      primus.on('data', function (data) {
        switch (data.action) {
          case 'join':
            if (!self.isJoined) {
              _user = data.user;
              self.isJoined = true;
              // Special case for self join. Other command that has user maybe use the same pattern.
              sharedEmitter.emit('self.join', data);
              return;
            }
            break;
          case 'nick':
            if (data.oldname === _user) {
              _user = data.newname;
            }
            break;
        }

        sharedEmitter.emit(data.action, data);
        sharedEmitter.emit('postdata');
      });


      Object.defineProperty(this, 'isInit', {
        get: function () {
          return _server && _user && (_rooms.length > 0);
        }
      });
      Object.defineProperty(this, 'room', {
        get: function () {
          if (_rooms.length > 0) return _rooms[0];
          return '';
        }
      });
      Object.defineProperty(this, 'user', {
        get: function () { return _user; }
      });

      this.init = function (server, user, rooms) {
        _server = S(server).trim().s;
        _user = S(user).trim().s;
        _rooms = rooms || [];
      }

      this.setNickserv = function(password){
        _nickserv = password;
      }

      this.connect = function () {
        if (self.isInit) {
          // Not support more than 1 room yet.
          var room = _rooms[0];
          primus.write({
            action: 'connect',
            server: _server,
            room: room,
            user: _user,
            nickserv: _nickserv
          });
        }
      }

      this.send = function (text) {
        if (self.isInit) {
          var data = (new Message(this.room, text)).data;
          primus.write(data);
          if (data.action === 'say') {
            sharedEmitter.emit('send', { from: _user, room: this.room, message: data.message });
          }
        }
      }

    }
    IRC.shared = new IRC;
    return IRC;
  }]);
