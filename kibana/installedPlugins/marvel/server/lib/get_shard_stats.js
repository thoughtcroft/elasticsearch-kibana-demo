const createQuery = require('./create_query');
const getLastState = require('./get_last_state');
const _ = require('lodash');
module.exports = (req, indices) => {
  const config = req.server.config();
  const callWithRequest = req.server.plugins.elasticsearch.callWithRequest;
  const start = req.payload.timeRange.min;
  const end = req.payload.timeRange.max;
  const clusterUuid = req.params.clusterUuid;

  return getLastState(req, indices)
  .then((state) => {
    if (!state) return {};
    const params = {
      index: indices,
      type: 'shards',
      searchType: 'count',
      body: {
        sort: { timestamp: { order: 'desc' } },
        query: createQuery({
          end: end,
          clusterUuid: clusterUuid,
          filters: [ { term: { state_uuid: state.cluster_state.state_uuid } } ]
        }),
        aggs: {
          indices: {
            terms: {
              field: 'shard.index',
              size: config.get('marvel.max_bucket_size')
            },
            aggs: {
              states: {
                terms: {
                  field: 'shard.state',
                  size: 10
                },
                aggs: {
                  primary: {
                    terms: {
                      field: 'shard.primary',
                      size: 10
                    }
                  }
                }
              }
            }
          },
          nodes: {
            terms: {
              field: 'shard.node',
              size: config.get('marvel.max_bucket_size')
            },
            aggs: {
              index_count: {
                cardinality: {
                  field: 'shard.index'
                }
              }
            }
          }
        }
      }
    };
    return callWithRequest(req, 'search', params);
  })
  .then((resp) => {
    const data = { nodes: {}, totals: { primary: 0, replica: 0, unassigned: { replica: 0, primary: 0 } } };

    function createNewMetric() {
      return {
        status: 'green',
        primary: 0,
        replica: 0,
        unassigned: {
          replica: 0,
          primary: 0
        }
      };
    };

    function setStats(bucket, metric, ident) {
      const states = _.filter(bucket.states.buckets, ident);
      states.forEach((state) => {
        metric.primary = state.primary.buckets.reduce((acc, state) => {
          if (state.key) acc += state.doc_count;
          return acc;
        }, metric.primary);
        metric.replica = state.primary.buckets.reduce((acc, state) => {
          if (!state.key) acc += state.doc_count;
          return acc;
        }, metric.replica);
      });
    }

    function processIndexShards(bucket) {
      const metric = createNewMetric();
      setStats(bucket, metric, { key: 'STARTED' });
      setStats(bucket, metric.unassigned, (bucket) => bucket.key !== 'STARTED');
      data.totals.primary += metric.primary;
      data.totals.replica += metric.replica;
      data.totals.unassigned.primary += metric.unassigned.primary;
      data.totals.unassigned.replica += metric.unassigned.replica;
      if (metric.unassigned.replica) metric.status = 'yellow';
      if (metric.unassigned.primary) metric.status = 'red';
      data[bucket.key] = metric;
    };

    function processNodeShards(bucket) {
      data.nodes[bucket.key] = {
        shardCount: bucket.doc_count,
        indexCount: bucket.index_count.value
      };
    }

    if (resp && resp.hits && resp.hits.total !== 0) {
      resp.aggregations.indices.buckets.forEach(processIndexShards);
      resp.aggregations.nodes.buckets.forEach(processNodeShards);
    }
    return data;

  });

};
