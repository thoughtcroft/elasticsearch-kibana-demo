const _ = require('lodash');
const Promise = require('bluebird');
const Joi = require('joi');
const boom = require('boom');
const root = require('requirefrom')('');
const getClusterStatus = root('server/lib/get_cluster_status');
const getIndexSummary = root('server/lib/get_index_summary');
const getMetrics = root('server/lib/get_metrics');
const getListing = root('server/lib/get_listing');
const getShardStats = root('server/lib/get_shard_stats');
const getShardAllocation = root('server/lib/get_shard_allocation');
const getNodes = root('server/lib/get_nodes');
const calculateIndices = root('server/lib/calculate_indices');
const calculateClusterStatus = root('server/lib/calculate_cluster_status');
const getDefaultNodeFromId = root('server/lib/get_default_node_from_id');
const mapArgumentsToObject = root('server/lib/map_arguments_to_object');

module.exports = (server) => {

  server.route({
    method: 'POST',
    path: '/api/marvel/v1/clusters/{clusterUuid}/indices',
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
          metrics: Joi.array().required(),
          listingMetrics: Joi.array().required()
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
          getListing(req, indices, 'indices'),
          getShardStats(req, indices),
          getNodes(req, indices),
          mapArgumentsToObject([
            'clusterStatus',
            'metrics',
            'rows',
            'shardStats',
            'nodes'
          ])
        );
      })
      // Add the index status to each index from the shardStats
      .then((body) => {
        body.rows.forEach((row) => {
          if (body.shardStats[row.name]) {
            row.status = body.shardStats[row.name].status;
          } else {
            row.status = 'Unknown';
            _.set(row, 'metrics.index_document_count.inapplicable', true);
            _.set(row, 'metrics.index_size.inapplicable', true);
            _.set(row, 'metrics.index_search_request_rate.inapplicable', true);
            _.set(row, 'metrics.index_request_rate.inapplicable', true);
          }
        });
        return body;
      })
      // Send the response
      .then(calculateClusterStatus)
      .then(reply, reply);
    }
  });

  server.route({
    method: 'POST',
    path: '/api/marvel/v1/clusters/{clusterUuid}/indices/{id}',
    config: {
      validate: {
        params: Joi.object({
          clusterUuid: Joi.string().required(),
          id: Joi.string().required()
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
      const id = req.params.id;
      const start = req.payload.timeRange.min;
      const end = req.payload.timeRange.max;
      calculateIndices(req, start, end)
      .then((indices) => {
        return Promise.join(
          getClusterStatus(req, indices),
          getIndexSummary(req, indices),
          getMetrics(req, indices, [{ term: { 'index_stats.index': id } }]),
          getShardAllocation(req, indices, [{ term: { 'shard.index': id } }]),
          getShardStats(req, indices),
          getNodes(req, indices),
          mapArgumentsToObject([
            'clusterStatus',
            'indexSummary',
            'metrics',
            'shards',
            'shardStats',
            'nodes'
          ])
        );
      })
      .then(calculateClusterStatus)
      .then(function (body) {
        var shardStats = body.shardStats[id];
        if (shardStats) {
          body.indexSummary.unassignedShards = shardStats.unassigned.primary + shardStats.unassigned.replica;
          body.indexSummary.totalShards = shardStats.primary + shardStats.replica + body.indexSummary.unassignedShards;
          body.indexSummary.status = shardStats.status;
          body.indexSummary.shardStats = shardStats;
        } else {
          body.indexSummary.status = 'Not Available';
          body.indexSummary.totalShards = 'N/A';
          body.indexSummary.unassignedShards = 'N/A';
          body.indexSummary.documents = 'N/A';
          body.indexSummary.dataSize = 'N/A';
        }
        // check if we need a legacy workaround for Marvel 2.0 node data
        if (_.isEmpty(body.nodes)) {
          const shardNodes = _.get(body, 'shardStats.nodes');
          _.forEach(shardNodes, function (shardNode, id) {
            body.nodes[id] = getDefaultNodeFromId(id);
          });
        }
        return body;
      })
      .then(reply, reply);
    }
  });

};
