const _ = require('lodash');
const moment = require('moment');
const createQuery = require('./create_query.js');
const calcAuto = require('./calculate_auto');
const root = require('requirefrom')('');
const metrics = root('public/lib/metrics');
const filterMetric = require('./filter_metric');
const filterPartialBuckets = require('./filter_partial_buckets');
var Promise = require('bluebird');
module.exports = (req, indices, type) => {
  const config = req.server.config();
  const callWithRequest = req.server.plugins.elasticsearch.callWithRequest;
  const listingMetrics = req.payload.listingMetrics || [];
  let start = moment.utc(req.payload.timeRange.min).valueOf();
  const orgStart = start;
  const end = moment.utc(req.payload.timeRange.max).valueOf();
  if (type === 'indices') {
    start = moment.utc(end).subtract(2, 'minutes').valueOf();
  }
  const clusterUuid = req.params.clusterUuid;
  const maxBucketSize = config.get('marvel.max_bucket_size');
  const minIntervalSeconds = config.get('marvel.min_interval_seconds');

  function calcSlope(data) {
    var length = data.length;
    var xSum = data.reduce(function (prev, curr) { return prev + curr.x; }, 0);
    var ySum = data.reduce(function (prev, curr) { return prev + curr.y; }, 0);
    var xySum = data.reduce(function (prev, curr) { return prev + (curr.y * curr.x); }, 0);
    var xSqSum = data.reduce(function (prev, curr) { return prev + (curr.x * curr.x); }, 0);
    var numerator = (length * xySum) - (xSum * ySum);
    var denominator = (length * xSqSum) - (xSum * ySum);
    return numerator / denominator;
  }

  function mapChartData(metric) {
    return (row) => {
      const data = {x: row.key};
      if (metric.derivative && row.metric_deriv) {
        data.y = row.metric_deriv.normalized_value || row.metric_deriv.value || 0;
      } else {
        data.y = row.metric.value;
      }
      return data;
    };
  }

  function createTermAgg(type) {
    if (type === 'indices') {
      return {
        field: 'index_stats.index',
        size: maxBucketSize
      };
    }
    if (type === 'nodes') {
      return {
        field: 'node_stats.node_id',
        size: maxBucketSize
      };
    }
  };

  const params = {
    index: indices,
    searchType: 'count',
    ignoreUnavailable: true,
    body: {
      query: createQuery({
        start: start,
        end: end,
        clusterUuid: clusterUuid
      }),
      aggs: {}
    }
  };

  const min = start;
  const max = end;
  const duration = moment.duration(max - orgStart, 'ms');
  const bucketSize = Math.max(minIntervalSeconds, calcAuto.near(100, duration).asSeconds());

  var aggs = {
    items: {
      terms: createTermAgg(type),
      aggs: {  }
    }
  };

  listingMetrics.forEach((id) => {
    const metric = metrics[id];
    let metricAgg = null;
    if (!metric) return;
    if (!metric.aggs) {
      metricAgg = {
        metric: {},
        metric_deriv: {
          derivative: { buckets_path: 'metric', unit: 'second' }
        }
      };
      metricAgg.metric[metric.metricAgg] = {
        field: metric.field
      };
    }

    aggs.items.aggs[id] = {
      date_histogram: {
        field: 'timestamp',
        min_doc_count: 0,
        interval: bucketSize + 's',
        extended_bounds: {
          min: min,
          max: max
        }
      },
      aggs: metric.aggs || metricAgg
    };
  });

  params.body.aggs = aggs;

  return callWithRequest(req, 'search', params)
  .then(function (resp) {
    if (!resp.hits.total) {
      return [];
    }
    const items = resp.aggregations.items.buckets;
    const data =  _.map(items, function (item) {
      const row = { name: item.key, metrics: {} };
      _.each(listingMetrics, function (id) {
        const metric = metrics[id];
        const data = _.chain(item[id].buckets)
          .filter(filterPartialBuckets(min, max, bucketSize))
          .map(mapChartData(metric))
          .value();
        const minVal = _.min(_.pluck(data, 'y'));
        const maxVal = _.max(_.pluck(data, 'y'));
        const lastVal = _.last(_.pluck(data, 'y'));
        const slope = calcSlope(data);
        row.metrics[id] = {
          metric: filterMetric(metric),
          min: minVal  || 0,
          max: maxVal || 0,
          last: lastVal || 0,
          slope: slope
        };
      }); // end each
      return row;
    }); // end map
    return data;
  });

};
