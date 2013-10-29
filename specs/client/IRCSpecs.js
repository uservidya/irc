'use strict'

describe('IRC', function () {

  var connectionStub = null;

  beforeEach(module('Services'));
  beforeEach(module(function ($provide) {
    connectionStub = jasmine.createSpyObj('connection', ['write']);
    connectionStub.map = {};
    connectionStub.on = function (name, fn) {
      if (!connectionStub.map[name]) { connectionStub.map[name] = []; }
      connectionStub.map[name].push(fn);
    }
    connectionStub.emit = function (name, data) {
      var fns = connectionStub.map[name];
      if (fns) {
        fns.forEach(function(fn) {
          fn(data);
        });
      }
    }

    $provide.value('Connection', {
      connect: function () {
        return connectionStub;
      }
    });
  }));

  var IRC;
  var Emitter;
  var client;
  beforeEach(inject(function ($injector) {
    IRC = $injector.get('IRC');
    Emitter = $injector.get('Emitter');
    
    spyOn(Emitter.shared, 'emit');
    client = new IRC;
  }));

  it ('should have isInit as false when there is no server, nick and room', function () {
    expect(client.isInit).toBeFalsy();
  });

  it ('should have room value and isInit should be true after init with all values', function () {
    client.init('irc.oftc.net', 'nat3', ['#oftc']);

    expect(client.isInit).toBeTruthy();
    expect(client.room).toEqual('#oftc');
    expect(client.user).toEqual('nat3');
  });

  it ('should not connect if connection is not init yet', function () {
    client.connect();

    expect(connectionStub.write).not.toHaveBeenCalled();
  });

  it ('should connect with first room', function () {
    client.init('irc.oftc.net', 'nat3', ['#first', '#second']);
    client.connect();

    expect(connectionStub.write).toHaveBeenCalledWith({
      action: 'connect',
      server: 'irc.oftc.net',
      room: '#first',
      user: 'nat3',
      nickserv: null
    });
  });

  it ('should emit event and postdata when backend send data', function () {
    connectionStub.emit('data', { action: 'event', key: 'value' });
    expect(Emitter.shared.emit).toHaveBeenCalledWith('event', { action: 'event', key: 'value' });
    expect(Emitter.shared.emit).toHaveBeenCalledWith('postdata');
  });

  it ('should change nickname when got nick action with oldname is current user', function () {
    client.init('irc.oftc.net', 'nat3', ['#first', '#second']);
    connectionStub.emit('data', { action: 'nick', oldname: 'nat3', newname: 'nat5'});
    expect(client.user).toEqual('nat5');
  });

  it ('should not change nickname when got nick action with different user', function () {
    client.init('irc.oftc.net', 'nat3', ['#first', '#second']);
    connectionStub.emit('data', { action: 'nick', oldname: 'nat4', newname: 'nat5'});
    expect(client.user).toEqual('nat3');
  });

  it ('should change user name when joined and name is conflict', function () {
    connectionStub.emit('data', { action: 'join', room: '#oftc', user: 'nat4'});
    expect(client.user).toEqual('nat4');
    expect(Emitter.shared.emit).toHaveBeenCalledWith('self.join', { action: 'join', room: '#oftc', user: 'nat4'});
    expect(Emitter.shared.emit).not.toHaveBeenCalledWith('join', { action: 'join', room: '#oftc', user: 'nat4'});
    expect(Emitter.shared.emit).not.toHaveBeenCalledWith('postdata');
  });

  it ('should not send data if client is not init', function () {
    client.send('hello, world');
    expect(connectionStub.write).not.toHaveBeenCalled();
  });

  it ('should send data and emit for normal message after init', function () {
    client.init('irc.oftc.net', 'nat3', ['#tlwg']);
    client.send('hello, world');
    expect(connectionStub.write).toHaveBeenCalled();
    expect(Emitter.shared.emit).toHaveBeenCalledWith('send', { from: 'nat3', room: '#tlwg', message: 'hello, world'});
  });

  it ('should send data and should not emit for command', function () {
    client.init('irc.oftc.net', 'nat3', ['#tlwg']);
    client.send('/nick nat5');
    expect(connectionStub.write).toHaveBeenCalled();
    expect(Emitter.shared.emit).not.toHaveBeenCalled();
  });

});
