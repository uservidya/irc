'use strict'

describe('IRC', function () {

  beforeEach(module('Services'));
  beforeEach(module(function ($provide) {
    $provide.value('Connection', {
      connect: function () {
        return {
          on: function () {
          }
        }
      }
    });
  }));

  var IRC;
  beforeEach(inject(function ($injector) {
    IRC = $injector.get('IRC');
  }));

  it ('should have isInit as false when there is no server, nick and room', function () {
    var client = new IRC;
    expect(client.isInit).toBeFalsy();
  });

  it ('should have isInit as true when init with all values', function () {
    var client = new IRC;
  });

});
