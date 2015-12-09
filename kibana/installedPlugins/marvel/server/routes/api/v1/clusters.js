const Promise = require('bluebird');
const _ = require('lodash');
const root = require('requirefrom')('');
const getClustersStats = root('server/lib/get_clusters_stats');
const getClusters = root('server/lib/get_clusters');
const getClustersHealth = root('server/lib/get_clusters_health');
const getShardStatsForClusters = root('server/lib/get_shard_stats_for_clusters');
const getNodesForClusters = root('server/lib/get_nodes_for_clusters');
const Joi = require('joi');
const Boom = require('boom');

const calculateIndices = root('server/lib/calculate_indices');
const calculateClusterStatus = root('server/lib/calculate_cluster_status');
const mapArgumentsToObject = root('server/lib/map_arguments_to_object');
const getClusterStatus = root('server/lib/get_cluster_status');
const getMetrics = root('server/lib/get_metrics');
const getShardStats = root('server/lib/get_shard_stats');
const getLastRecovery = root('server/lib/get_last_recovery');
const getNodes = root('server/lib/get_nodes');

module.exports = (server) => {

  const config = server.config();
  const callWithRequest = server.plugins.elasticsearch.callWithRequest;

  server.route({
    method: 'GET',
    path: '/api/marvel/v1/clusters',
    handler: (req, reply) => {
      return getClusters(req)
        .then(getClustersStats(req))
        .then(getClustersHealth(req))
        .then(getNodesForClusters(req))
        .then(getShardStatsForClusters(req))
        .then((clusters) => reply(_.sortBy(clusters, 'cluster_uuid')))
        .catch(reply);
    }
  });

  server.route({
    method: 'POST',
    path: '/api/marvel/v1/clusters/{clusterUuid}',
    config: {
      validate: {
        params: Joi.object({
          clusterUuid: Joi.string().required()
        }),
        payload: Joi.object({
          timeRange: Joi.object({
            min: Joi.date().required(),
            max: Joi.date().required()
          }).required(),
          metrics: Joi.array().required()
        })
      }
    },
    handler: (req, reply) => {
      const start = req.payload.timeRange.min;
      const end = req.payload.timeRange.max;
      calculateIndices(req, start, end)
      .then((indices) => {
        return Promise.join(
          getClusterStatus(req, indices),
          getMetrics(req, indices),
          getShardStats(req, indices),
          getLastRecovery(req, indices),
          getNodes(req, indices),
          mapArgumentsToObject([
            'clusterStatus',
            'metrics',
            'shardStats',
            'shardActivity',
            'nodes'
          ])
        );
      })
      .then(calculateClusterStatus)
      .then(reply, reply);
    }
  });

  server.route({
    method: 'GET',
    path: '/api/marvel/v1/clusters/{clusterUuid}/info',
    config: {
      validate: {
        params: Joi.object({
          clusterUuid: Joi.string().required()
        })
      }
    },
    handler: (req, reply) => {
      const params = {
        index: config.get('marvel.index_prefix') + 'data',
        type: 'cluster_info',
        id: req.params.clusterUuid
      };
      return callWithRequest(req, 'get', params)
        .then((resp) => reply(resp._source))
        .catch((err) => {
          if (err.message === 'Not Found') return reply(Boom.notFound());
          reply(err);
        });
    }
  });

};
