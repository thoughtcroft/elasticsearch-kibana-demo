const _ = require('lodash');
const createQuery = require('./create_query.js');
module.exports = (req, indices) => {
  // Alias callWithRequest so we don't have to use this long ugly string
  const callWithRequest = req.server.plugins.elasticsearch.callWithRequest;

  // Get the params from the POST body for the request
  const start = req.payload.timeRange.min;
  const end = req.payload.timeRange.max;
  const clusterUuid = req.params.clusterUuid;

  // Build up the Elasticsearch request
  const params = {
    index: indices,
    type: 'node_stats',
    body: {
      size: 1,
      sort: { timestamp: { order: 'desc' } },
      query: createQuery({
        end: end,
        clusterUuid: clusterUuid,
        filters: [{
          term: { 'node_stats.node_id': req.params.id }
        }]
      })
    }
  };

  return callWithRequest(req, 'search', params)
  .then((resp) => {
    const summary = { documents: 0, dataSize: 0, freeSpace: 0 };
    const nodeStats = _.get(resp, 'hits.hits[0]._source.node_stats');
    if (nodeStats) {
      summary.documents = _.get(nodeStats, 'indices.docs.count');
      summary.dataSize = _.get(nodeStats, 'indices.store.size_in_bytes');
      summary.freeSpace = _.get(nodeStats, 'fs.total.available_in_bytes');
    }
    return summary;
  });
};
