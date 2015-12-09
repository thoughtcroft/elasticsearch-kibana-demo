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
    type: 'index_stats',
    body: {
      size: 1,
      sort: { timestamp: { order: 'desc' } },
      query: createQuery({
        end: end,
        clusterUuid: clusterUuid,
        filters: [{
          term: { 'index_stats.index': req.params.id }
        }]
      })
    }
  };

  return callWithRequest(req, 'search', params)
  .then((resp) => {
    const indexSummary = { documents: 0, dataSize: 0 };
    const totals = _.get(resp, 'hits.hits[0]._source.index_stats.total');
    if (totals) {
      indexSummary.documents = _.get(totals, 'docs.count');
      indexSummary.dataSize = _.get(totals, 'store.size_in_bytes');
    }

    return indexSummary;
  });
};
