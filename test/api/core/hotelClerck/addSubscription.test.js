var
  should = require('should'),
  q = require('q'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  InternalError = require.main.require('lib/api/core/errors/internalError'),
  BadRequestError = require.main.require('lib/api/core/errors/badRequestError'),
  RealTimeResponseObject = require.main.require('lib/api/core/models/realTimeResponseObject'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  Profile = require.main.require('lib/api/core/models/security/profile'),
  Role = require.main.require('lib/api/core/models/security/role');

describe('Test: hotelClerk.addSubscription', function () {
  var
    kuzzle,
    roomId,
    channel,
    connection = {id: 'connectionid'},
    context = {
      connection: connection,
      token: null
    },
    roomName = 'roomName',
    index = 'test',
    collection = 'user',
    filter = {
      term: {
        firstName: 'Ada'
      }
    };

  beforeEach(function (done) {
    require.cache = {};
    kuzzle = new Kuzzle();
    kuzzle.removeAllListeners();

    return kuzzle.start(params, {dummy: true})
      .then(function () {
        kuzzle.repositories.role.roles.guest = new Role();
        return kuzzle.repositories.role.hydrate(kuzzle.repositories.role.roles.guest, params.userRoles.guest);
      })
      .then(function () {
        kuzzle.repositories.profile.profiles.anonymous = new Profile();
        return kuzzle.repositories.profile.hydrate(kuzzle.repositories.profile.profiles.anonymous, params.userProfiles.anonymous);
      })
      .then(function () {
        return kuzzle.repositories.token.anonymous();
      })
      .then(function (token) {
        context.token = token;
        done();
      });
  });

  it('should have object filtersTree, customers and rooms empty', function () {
    should(kuzzle.dsl.filtersTree).be.an.Object();
    should(kuzzle.dsl.filtersTree).be.empty();

    should(kuzzle.hotelClerk.rooms).be.an.Object();
    should(kuzzle.hotelClerk.rooms).be.empty();

    should(kuzzle.hotelClerk.customers).be.an.Object();
    should(kuzzle.hotelClerk.customers).be.empty();
  });

  it('should have the new room and customer', function () {
    var requestObject = new RequestObject({
      controller: 'subscribe',
      action: 'on',
      requestId: roomName,
      index: index,
      collection: collection,
      body: filter,
      metadata: {
        foo: 'bar',
        bar: [ 'foo', 'bar', 'baz', 'qux']
      }
    });

    return kuzzle.hotelClerk.addSubscription(requestObject, context)
      .then(function (realTimeResponseObject) {
        var customer;

        should(kuzzle.dsl.filtersTree).be.an.Object();
        should(kuzzle.dsl.filtersTree).not.be.empty();

        should(kuzzle.hotelClerk.rooms).be.an.Object();
        should(kuzzle.hotelClerk.rooms).not.be.empty();

        should(kuzzle.hotelClerk.customers).be.an.Object();
        should(kuzzle.hotelClerk.customers).not.be.empty();

        should(realTimeResponseObject).be.an.Object();
        should(realTimeResponseObject.roomId).be.a.String();
        should(kuzzle.hotelClerk.rooms[realTimeResponseObject.roomId]).be.an.Object();
        should(kuzzle.hotelClerk.rooms[realTimeResponseObject.roomId]).not.be.empty();

        roomId = kuzzle.hotelClerk.rooms[realTimeResponseObject.roomId].id;

        customer = kuzzle.hotelClerk.customers[connection.id];
        should(customer).be.an.Object();
        should(customer).not.be.empty();
        should(customer[roomId]).not.be.undefined().and.match(requestObject.metadata);

        should(kuzzle.hotelClerk.rooms[roomId].channels).be.an.Object().and.not.be.undefined();
        should(Object.keys(kuzzle.hotelClerk.rooms[roomId].channels).length).be.exactly(1);

        channel = Object.keys(kuzzle.hotelClerk.rooms[roomId].channels)[0];
        should(kuzzle.hotelClerk.rooms[roomId].channels[channel].scope).not.be.undefined().and.be.exactly('all');
        should(kuzzle.hotelClerk.rooms[roomId].channels[channel].state).not.be.undefined().and.be.exactly('done');
        should(kuzzle.hotelClerk.rooms[roomId].channels[channel].users).not.be.undefined().and.be.exactly('none');
      });
  });

  it('should trigger a protocol:joinChannel hook', function (done) {
    var requestObject = new RequestObject({
      controller: 'subscribe',
      collection: collection,
      index: index,
      body: filter
    });

    this.timeout(50);

    kuzzle.once('protocol:joinChannel', (data) => {
      should(data).be.an.Object();
      should(data.channel).be.a.String();
      should(data.id).be.eql(context.connection.id);
      done();
    });

    kuzzle.hotelClerk.addSubscription(requestObject, context);
  });

  it('should return the same response when the user has already subscribed to the filter', done => {
    var requestObject = new RequestObject({
      controller: 'subscribe',
      collection: collection,
      index: index,
      body: filter
    });
    var response;

    return kuzzle.hotelClerk.addSubscription(requestObject, context)
      .then(result => {
        response = result;
        return kuzzle.hotelClerk.addSubscription(requestObject, context);
      })
      .then(result => {
        should(result).match(response);
        done();
      });
  });

  it('should reject an error when a filter is unknown', function () {
    var
      pAddSubscription,
      requestObject = new RequestObject({
        controller: 'subscribe',
        action: 'on',
        collection: collection,
        index: index,
        body: {badterm : {firstName: 'Ada'}}
      });

    pAddSubscription = kuzzle.hotelClerk.addSubscription(requestObject, context);
    return should(pAddSubscription).be.rejected();
  });

  it('should return the same room ID if the same filters are used', done => {
    var
      requestObject1 = new RequestObject({
        controller: 'subscribe',
        collection: collection,
        index: index,
        body: {
          term: {
            firstName: 'Ada'
          },
          exists: {
            field: 'lastName'
          }
        }
      }),
      requestObject2 = new RequestObject({
        controller: 'subscribe',
        collection: collection,
        index: index,
        body: {
          exists: {
            field: 'lastName'
          },
          term: {
            firstName: 'Ada'
          }
        }
      }),
      response;

    return kuzzle.hotelClerk.addSubscription(requestObject1, context)
      .then(result => {
        response = result;
        return kuzzle.hotelClerk.addSubscription(requestObject2, context);
      })
      .then(result => {
        should(result.roomId).be.exactly(response.roomId);
        done();
      })
      .catch(error => {
        done(error);
      });
  });

  it('should allow subscribing with an empty filter', function () {
    var
      requestObject = new RequestObject({
        controller: 'subscribe',
        index: index,
        collection: collection
      });

    delete requestObject.data.body;
    
    return should(kuzzle.hotelClerk.addSubscription(requestObject, context)).be.fulfilled();
  });

  it('should delay a room creation if it has been marked for destruction', function (done) {
    var
      requestObject = new RequestObject({
        controller: 'subscribe',
        index: index,
        collection: collection
      });

    kuzzle.hotelClerk.addSubscription(requestObject, context)
      .then(response => {
        kuzzle.hotelClerk.rooms[response.roomId].destroyed = true;

        kuzzle.hotelClerk.addSubscription(requestObject, {connection: {id: 'anotherID'}, user: null})
          .then(recreated => {
            should(recreated.roomId).be.exactly(response.roomId);
            should(kuzzle.hotelClerk.rooms[recreated.roomId].destroyed).be.undefined();
            should(kuzzle.hotelClerk.rooms[recreated.roomId].customers.length).be.exactly(1);
            should(kuzzle.hotelClerk.rooms[recreated.roomId].customers).match(['anotherID']);
            done();
          })
          .catch(error => done(error));

        process.nextTick(() => delete kuzzle.hotelClerk.rooms[response.roomId]);
      })
      .catch(error => done(error));
  });

  it('should allow to subscribe to an existing room', done => {
    var
      roomId,
      requestObject1 = new RequestObject({
        controller: 'subscribe',
        index: index,
        collection: collection
      });

    kuzzle.hotelClerk.addSubscription(requestObject1, {connection: 'connection1', user: null})
      .then(result => {
        should(result).be.an.instanceOf(RealTimeResponseObject);
        should(result).have.property('roomId');

        return q(result.roomId);
      })
      .then(id => {
        var requestObject2 = new RequestObject({
          collection: collection,
          index: index,
          controller: 'subscribe',
          action: 'join',
          body: {
            roomId: id
          }
        });

        roomId = id;
        requestObject2.body = {roomId: roomId};
        return kuzzle.hotelClerk.join(requestObject2, {connection: 'connection2', user: null});
      })
      .then(result => {
        should(result).be.an.instanceOf(RealTimeResponseObject);
        should(result).have.property('roomId', roomId);
        done();
      })
      .catch(error => {
        done(error);
      });

  });

  it('#join should reject the promise if the room does not exist', () => {
    return should(kuzzle.hotelClerk.join(
      new RequestObject({
        collection: collection,
        index: index,
        controller: 'subscribe',
        action: 'join',
        body: {roomId: 'no way I can exist'}
      }),
      context
    ))
      .be.rejectedWith(InternalError);
  });

  it('should reject the subscription if the given state argument is incorrect', function () {
    return should(kuzzle.hotelClerk.addSubscription(
      new RequestObject({
        collection: collection,
        controller: 'subscribe',
        action: 'on',
        body: {},
        state: 'foo'
      }),
      context
    ))
      .be.rejectedWith(BadRequestError);
  });

  it('should reject the subscription if the given scope argument is incorrect', function () {
    return should(kuzzle.hotelClerk.addSubscription(
      new RequestObject({
        collection: collection,
        controller: 'subscribe',
        action: 'on',
        body: {},
        scope: 'foo'
      }),
      context
    ))
      .be.rejectedWith(BadRequestError);
  });

  it('should reject the subscription if the given users argument is incorrect', function () {
    return should(kuzzle.hotelClerk.addSubscription(
      new RequestObject({
        collection: collection,
        controller: 'subscribe',
        action: 'on',
        body: {},
        users: 'foo'
      }),
      context
    ))
      .be.rejectedWith(BadRequestError);
  });

  it('should treat null/undefined filters as empty filters', function (done) {
    var
      requestObject1 = new RequestObject({
        controller: 'subscribe',
        collection: collection,
        index: index,
        body: {}
      }),
      requestObject2 = new RequestObject({
        controller: 'subscribe',
        collection: collection,
        index: index,
        body: null
      }),
      response;

    return kuzzle.hotelClerk.addSubscription(requestObject1, context)
      .then(result => {
        response = result;
        return kuzzle.hotelClerk.addSubscription(requestObject2, context);
      })
      .then(result => {
        should(result.roomId).be.exactly(response.roomId);
        done();
      })
      .catch(error => {
        done(error);
      });
  });
});
