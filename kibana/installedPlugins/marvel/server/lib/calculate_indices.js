var _ = require('lodash');
var Promise = require('bluebird');
var moment = require('moment');
module.exports = function (req, start, end) {
  var server = req.server;
  var config = server.config();
  var pattern = config.get('marvel.index_prefix') + '*';
  var callWithRequest = server.plugins.elasticsearch.callWithRequest;
  var options = {
    index: pattern,
    level: 'indices',
    ignoreUnavailable: true,
    body: {
      fields: ['timestamp'],
      index_constraints: {
        timestamp: {
          max_value: { gte: moment.utc(start).toISOString() },
          min_value: { lte: moment.utc(end).toISOString() }
        }
      }
    }
  };
  return callWithRequest(req, 'fieldStats', options)
    .then(function (resp) {
      var indices = _.map(resp.indices, function (info, index) {
        return index;
      });
      if (indices.length === 0) return ['-*'];
      return indices.filter((index) => index !== config.get('marvel.index'));
    });
};
