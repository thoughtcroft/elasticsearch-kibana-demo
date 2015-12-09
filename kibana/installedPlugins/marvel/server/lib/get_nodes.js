const _ = require('lodash');
const createQuery = require('./create_query');
const getLastState = require('./get_last_state');
const calculateNodeType = require('./calculate_node_type');
module.exports = (req, indices) => {
  const config = req.server.config();
  const callWithRequest = req.server.plugins.elasticsearch.callWithRequest;
  const start = req.payload.timeRange.min;
  const end = req.payload.timeRange.max;
  const clusterUuid = req.params.clusterUuid;

  const params = {
    index: indices,
    type: 'nodes',
    body: {
      size: config.get('marvel.max_bucket_size'),
      query: createQuery({
        start: start,
        end: end,
        clusterUuid: clusterUuid
      }),
      aggs: {
        nodes: {
          terms: {
            field: 'node.id',
            size: config.get('marvel.max_bucket_size')
          }
        }
      }
    }
  };
  return getLastState(req, indices)
  .then((state) => {
    return callWithRequest(req, 'search', params)
    .then((resp) => {
      const buckets = _.get(resp, 'aggregations.nodes.buckets');
      if (!buckets || !buckets.length) return {};
      const ids = buckets.map((bucket) => bucket.key);
      const params = {
        index: config.get('marvel.index'),
        type: 'node',
        body: { ids: ids }
      };
      return callWithRequest(req, 'mget', params);
    })
    .then((resp) => {
      const docs = _.get(resp, 'docs');
      if (!docs) return {};
      const nodes = {};
      docs.forEach((doc) => {
        if (doc.found) {
          const node = _.get(doc, '_source.node');
          nodes[doc._id] = calculateNodeType(node, state.cluster_state);
        }
      });
      return nodes;
    });
  });
};

