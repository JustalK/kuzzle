var
  should = require('should'),
  Promise = require('bluebird'),
  sinon = require('sinon'),
  Kuzzle = require.main.require('lib/api/kuzzle'),
  Profile = require.main.require('lib/api/core/models/security/profile'),
  User = require.main.require('lib/api/core/models/security/user');

describe('Test: security/userTest', () => {
  var
    kuzzle,
    sandbox,
    profile,
    profile2,
    user;

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    kuzzle = new Kuzzle();

    profile = new Profile();
    profile._id = 'profile';
    profile.isActionAllowed = sinon.stub().returns(Promise.resolve(true));

    profile2 = new Profile();
    profile2._id = 'profile2';
    profile2.isActionAllowed = sinon.stub().returns(Promise.resolve(false));

    user = new User();
    user.profileIds = ['profile', 'profile2'];

    kuzzle.repositories = {
      profile: {
        loadProfile: sinon.stub().returns(Promise.resolve(profile)),
        loadProfiles: sinon.stub().returns(Promise.resolve([profile, profile2]))
      }
    };
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should retrieve the good rights list', () => {
    var
      profileRights = {
        rights1: {
          controller: 'read', action: 'get', index: 'foo', collection: 'bar',
          value: 'allowed'
        },
        rights2: {
          controller: 'write', action: 'delete', index: '*', collection: '*',
          value: 'conditional'
        }
      },
      profileRights2 = {
        rights1: {
          controller: 'read', action: 'get', index: 'foo', collection: 'bar',
          value: 'conditional'
        },
        rights3: {
          controller: 'write', action: 'create', index: 'foo', collection: 'bar',
          value: 'allowed'
        }
      };

    sandbox.stub(user, 'getProfiles').returns(Promise.resolve([profile, profile2]));
    sandbox.stub(profile, 'getRights').returns(Promise.resolve(profileRights));
    sandbox.stub(profile2, 'getRights').returns(Promise.resolve(profileRights2));

    return user.getRights(kuzzle)
      .then(rights => {
        var filteredItem;

        should(rights).be.an.Object();
        rights = Object.keys(rights).reduce((array, item) => array.concat(rights[item]), []);
        should(rights).be.an.Array();

        filteredItem = rights.filter(item => {
          return item.controller === 'read' &&
                  item.action === 'get';
        });
        should(filteredItem).length(1);
        should(filteredItem[0].index).be.equal('foo');
        should(filteredItem[0].collection).be.equal('bar');
        should(filteredItem[0].value).be.equal('allowed');

        filteredItem = rights.filter(item => {
          return item.controller === 'write' &&
                  item.action === 'delete';
        });
        should(filteredItem).length(1);
        should(filteredItem[0].index).be.equal('*');
        should(filteredItem[0].collection).be.equal('*');
        should(filteredItem[0].value).be.equal('conditional');

        filteredItem = rights.filter(item => {
          return item.controller === 'write' &&
                  item.action === 'create';
        });
        should(filteredItem).length(1);
        should(filteredItem[0].index).be.equal('foo');
        should(filteredItem[0].collection).be.equal('bar');
        should(filteredItem[0].value).be.equal('allowed');

        filteredItem = rights.filter(item => {
          return item.controller === 'read' && item.action === 'listIndexes';
        });
        should(filteredItem).length(0);

      });
  });

  it('should retrieve the profile', () => {
    return user.getProfiles(kuzzle)
      .then(p => {
        should(p).be.an.Array();
        should(p[0]).be.an.Object();
        should(p[0]).be.exactly(profile);
      });
  });

  it('should use the isActionAlloed method from its profile', () => {
    return user.isActionAllowed({}, {}, kuzzle)
      .then(isActionAllowed => {
        should(isActionAllowed).be.a.Boolean();
        should(isActionAllowed).be.true();
        should(profile.isActionAllowed.called).be.true();
      });
  });

  it('should respond false if the user have no profileIds', () => {
    user.profileIds = [];
    return user.isActionAllowed({}, {}, kuzzle)
      .then(isActionAllowed => {
        should(isActionAllowed).be.a.Boolean();
        should(isActionAllowed).be.false();
        should(profile.isActionAllowed.called).be.false();
      });
  });

  it('should rejects if the loadProfiles throws an error', () => {
    sandbox.stub(user, 'getProfiles').returns(Promise.reject(new Error('error')));
    return should(user.isActionAllowed({}, {}, kuzzle)).be.rejectedWith('error');
  });
});
