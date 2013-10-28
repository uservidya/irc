'use strict'

angular.module('Services', [])
  .factory('$emitter', function () {
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
        fns.forEach(function (fn) {
          fn(data);
        });
      }

      this.clear = function () {
        _events = {};
      }

    }
    return new Emitter;
  })
  .factory('$message', function () {
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

    Message.$new = function (room, message) {
      return new Message(room, message);
    }

    return Message;
  })
  .factory('IRC', [ '$emitter', '$message', function ($emitter, $message) {
    var IRC = function () {
      var _server = '';
      var _user = '';
      var _rooms = [];
      var _isJoined = false;
      var _nickserv = null;
      
      var primus = Primus.connect();
      primus.on('data', function (data) {
        switch (data.action) {
          case 'join':
            if (!_isJoined) {
              _user = data.user;
              _isJoined = true;
              // Special case for self join. Other command that has user maybe use the same pattern.
              $emitter.emit('self.join', data);
              return;
            }
            break;
          case 'nick':
            if (data.oldname === _user) {
              _user = data.newname;
            }
            break;
        }

        $emitter.emit(data.action, data);
        $emitter.emit('postdata');
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

      this.clear = function () {
        // Clear all events
        _events = {};
      }

      this.init = function (server, user, rooms) {
        _server = S(server).trim().s;
        _user = S(user).trim().s;
        _rooms = rooms || [];
      }

      this.setNickserv = function(password){
        _nickserv = password;
      }

      this.connect = function () {
        if (this.isInit) {
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
        var data = $message.$new(this.room, text).data;
        primus.write(data);
        if (data.action === 'say') {
          $emitter.emit('send', { from: _user, room: this.room, message: data.message });
        }
      }

    }

    var _instance = new IRC;
    return _instance;
  }]);
