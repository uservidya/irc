'use strict'

describe('Emitter', function () {

  beforeEach(module('Services'));

  var emitter;
  beforeEach(inject(function (Emitter) {
    emitter = new Emitter;
  }));

  it ('should call function that registers to', function () {
    var functionHasBeenCalled = false;
    emitter.on('test', function () {
      functionHasBeenCalled = true;
    });
    emitter.emit('test');
    expect(functionHasBeenCalled).toBeTruthy();
  });

  it ('should pass the data to function listener', function () {
    var data = null;
    emitter.on('test', function (value) {
      data = value;
    });
    emitter.emit('test', { hello: 'world' });
    expect(data).toEqual({ hello: 'world' });
  });

  it ('should call all functions that registers to', function () {
    var function1HasBeenCalled = false;
    var function2HasBeenCalled = false;
    emitter.on(['test1', 'test2'], function (value) {
      switch (value.name) {
        case 'test1':
          function1HasBeenCalled = true;
          break;
        case 'test2':
          function2HasBeenCalled = true;
          break;
      }
    });
    emitter.emit('test1', { name: 'test1' });
    emitter.emit('test2', { name: 'test2' });
    expect(function1HasBeenCalled).toBeTruthy();
    expect(function2HasBeenCalled).toBeTruthy();
  });

});
