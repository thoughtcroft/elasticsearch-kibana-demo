const _ = require('lodash');
const createQuery = require('./create_query');
const getLastState = require('./get_last_state');
module.exports = (req, indices, filters) => {
  const config = req.server.config();
  const callWithRequest = req.server.plugins.elasticsearch.callWithRequest;
  const start = req.payload.timeRange.min;
  const end = req.payload.timeRange.max;
  const clusterUuid = req.params.clusterUuid;
  return getLastState(req, indices)
  .then((state) => {
    if (!state) return {};
    filters.push({ term: { state_uuid: state.cluster_state.state_uuid }});
    const params = {
      index: config.get('marvel.index_prefix') + '*',
      type: 'shards',
      body: {
        size: config.get('marvel.max_bucket_size'),
        query: createQuery({
          end: end,
          clusterUuid: clusterUuid,
          filters: filters
        })
      }
    };
    return callWithRequest(req, 'search', params);
  })
  .then((resp) => {
    const hits = _.get(resp, 'hits.hits');
    if (!hits) return [];
    return hits.map((doc) => doc._source.shard);
  });
};
