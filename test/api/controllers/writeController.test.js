var
  should = require('should'),
  q = require('q'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  RequestObject = require.main.require('lib/api/core/models/requestObject');

/*
 * Since we're sending voluntarily false requests, we expect most of these
 * calls to fail.
 */
describe('Test: write controller', function () {
  var
    kuzzle;

  before(function (done) {
    kuzzle = new Kuzzle();
    kuzzle.start(params, {dummy: true})
      .then(function () {
        kuzzle.services.list.writeEngine = {};
        done();
      });
  });

  it('should reject an empty request', function () {
    var requestObject = new RequestObject({});
    delete requestObject.data.body;

    return should(requestObject.isValid()).be.rejected();
  });

  it('should reject an empty create request', function () {
    var requestObject = new RequestObject({});
    delete requestObject.data.body;

    return should(kuzzle.funnel.write.create(requestObject)).be.rejected();
  });

  it('should reject an empty createOrUpdate request', function () {
    var requestObject = new RequestObject({});
    delete requestObject.data.body;

    return should(kuzzle.funnel.write.createOrUpdate(requestObject)).be.rejected();
  });

  it('should reject an empty update request', function () {
    var requestObject = new RequestObject({});
    delete requestObject.data.body;

    return should(kuzzle.funnel.write.update(requestObject)).be.rejected();
  });

  it('should reject an empty replace request', function () {
    var requestObject = new RequestObject({});
    delete requestObject.data.body;

    return should(kuzzle.funnel.write.replace(requestObject)).be.rejected();
  });

  describe('#create', function () {
    it('should emit a hook on a create data query', function (done) {
      var
        requestObject = new RequestObject({index: 'test', body: {foo: 'bar'}}, {}, 'unit-test');

      this.timeout(50);

      kuzzle.once('data:create', function (obj) {
        try {
          should(obj).be.exactly(requestObject);
          done();
        }
        catch (e) {
          done(e);
        }
      });

      kuzzle.funnel.write.create(requestObject)
        .catch(function (error) {
          done(error);
        });
    });
  });

  describe('#publish', function () {
    it('should send notifications when publishing messages', function (done) {
      var
        mockupRooms = ['foo', 'bar'],
        requestObject = new RequestObject({index: 'test', body: {foo: 'bar'}}, {}, 'unit-test');

      this.timeout(50);

      kuzzle.dsl.testFilters = function () {
        return q(mockupRooms);
      };

      kuzzle.notifier.notify = function (rooms) {
        try {
          should(rooms).be.exactly(mockupRooms);
          done();
        }
        catch (e) {
          done(e);
        }
      };

      kuzzle.funnel.write.publish(requestObject)
        .catch(function (error) {
          done(error);
        });
    });

    it('should return a rejected promise if publishing fails', function () {
      var requestObject = new RequestObject({body: {foo: 'bar'}}, {}, 'unit-test');
      kuzzle.notifier.publish = function () { return q.reject(new Error('error')); };
      return should(kuzzle.funnel.write.publish(requestObject)).be.rejectedWith(Error);
    });
  });

  describe('#createOrUpdate', function () {
    it('should emit a hook on a createOrUpdate query', function (done) {
      var requestObject = new RequestObject({body: {foo: 'bar'}}, {}, 'unit-test');

      this.timeout(50);

      kuzzle.once('data:createOrUpdate', function (obj) {
        try {
          should(obj).be.exactly(requestObject);
          done();
        }
        catch (e) {
          done(e);
        }
      });

      kuzzle.funnel.write.createOrUpdate(requestObject)
        .catch(function (error) {
          done(error);
        });
    });
  });

  describe('#update', function () {
    it('should emit a hook on an update data query', function (done) {
      var requestObject = new RequestObject({body: {foo: 'bar'}}, {}, 'unit-test');

      this.timeout(50);

      kuzzle.once('data:update', function (obj) {
        try {
          should(obj).be.exactly(requestObject);
          done();
        }
        catch (e) {
          done(e);
        }
      });

      kuzzle.funnel.write.update(requestObject)
        .catch(function (error) {
          done(error);
        });
    });
  });

  describe('#replace', function () {
    it('should emit a hook on a replace query', function (done) {
      var requestObject = new RequestObject({body: {foo: 'bar'}}, {}, 'unit-test');

      this.timeout(50);

      kuzzle.once('data:replace', function (obj) {
        try {
          should(obj).be.exactly(requestObject);
          done();
        }
        catch (e) {
          done(e);
        }
      });

      kuzzle.funnel.write.replace(requestObject)
        .catch(function (error) {
          done(error);
        });
    });
  });

  describe('#delete', function () {
    it('should emit a hook on a delete data query', function (done) {
      var requestObject = new RequestObject({body: {foo: 'bar'}}, {}, 'unit-test');

      this.timeout(50);

      kuzzle.once('data:delete', function (obj) {
        try {
          should(obj).be.exactly(requestObject);
          done();
        }
        catch (e) {
          done(e);
        }
      });

      kuzzle.funnel.write.delete(requestObject)
        .catch(function (error) {
          done(error);
        });
    });
  });

  describe('#deleteByQuery', function () {
    it('should emit a hook on a deleteByQuery data query', function (done) {
      var requestObject = new RequestObject({body: {foo: 'bar'}}, {}, 'unit-test');

      this.timeout(50);

      kuzzle.once('data:deleteByQuery', function (obj) {
        try {
          should(obj).be.exactly(requestObject);
          done();
        }
        catch (e) {
          done(e);
        }
      });

      kuzzle.funnel.write.deleteByQuery(requestObject)
        .catch(function (error) {
          done(error);
        });
    });
  });


  describe('#createCollection', function () {
    it('should trigger a hook on a createCollection call', function (done) {
      var requestObject = new RequestObject({}, {}, 'unit-test');

      this.timeout(50);

      kuzzle.once('data:createCollection', obj => {
        try {
          should(obj).be.exactly(requestObject);
          done();
        }
        catch (e) {
          done(e);
        }
      });

      kuzzle.funnel.write.createCollection(requestObject);
    });
  });
});
