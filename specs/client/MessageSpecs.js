'use strict'

describe('Message', function () {

  beforeEach(module('Services'));

  var Message;
  beforeEach(inject(function ($injector) {
    Message = $injector.get('Message');
  }));

  it ('should set /nick data action as command', function () {
    var message = new Message('#test', '/nick nat3');
    expect(message.data.action).toEqual('command');
    expect(message.data.arguments.length).toEqual(2);
  });

  it ('should set data as action and have room and message property for normal message', function () {
    var message = new Message('#test', 'Say something');
    expect(message.data.action).toEqual('say');
    expect(message.data.room).toEqual('#test');
    expect(message.data.message).toEqual('Say something');
  });

  it ('should set /me data action as say and change /me to ACTION', function () {
    var message = new Message('#test', '/me hello, world');
    expect(message.data.action).toEqual('say');
    expect(message.data.room).toEqual('#test');
    expect(message.data.message).toEqual('\u0001ACTION hello, world\u0001');
  });

});
