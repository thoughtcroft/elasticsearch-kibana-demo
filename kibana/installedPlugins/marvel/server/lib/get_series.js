const _ = require('lodash');
const moment = require('moment');
const root = require('requirefrom')('');
const metrics = root('public/lib/metrics');
const createQuery = require('./create_query.js');
const calcAuto = require('./calculate_auto');
const filterPartialBuckets = require('./filter_partial_buckets');
const filterMetric = require('./filter_metric');

module.exports = (req, indices, metricName, filters) => {
  const config = req.server.config();
  const callWithRequest = req.server.plugins.elasticsearch.callWithRequest;
  const metric = metrics[metricName];
  const start = req.payload.timeRange.min;
  const end = req.payload.timeRange.max;
  const clusterUuid = req.params.clusterUuid;
  const id = req.params.id;
  const minIntervalSeconds = config.get('marvel.min_interval_seconds');

  const params = {
    index: indices,
    searchType: 'count',
    ignoreUnavailable: true,
    body: {
      query: createQuery({
        start: start,
        end: end,
        clusterUuid: clusterUuid,
        filters: filters
      }),
      aggs: {}
    }
  };
  const min = moment.utc(start).valueOf();
  const max = moment.utc(end).valueOf();
  const duration = moment.duration(max - min, 'ms');
  const bucketSize = Math.max(minIntervalSeconds, calcAuto.near(100, duration).asSeconds());
  const aggs = {
    check: {
      date_histogram: {
        field: 'timestamp',
        min_doc_count: 0,
        interval: bucketSize + 's',
        extended_bounds: {
          min: min,
          max: max
        }
      },
      aggs: { metric: { } },
      meta: {
        timefilterMin: min,
        timefilterMax: max,
        bucketSize: bucketSize
      }
    }
  };
  aggs.check.aggs.metric[metric.metricAgg] = {
    field: metric.field
  };
  if (metric.derivative) {
    aggs.check.aggs.metric_deriv = {
      derivative: { buckets_path: 'metric', gap_policy: 'skip' }
    };
  }
  if (metric.aggs) {
    _.assign(aggs.check.aggs, metric.aggs);
  }
  params.body.aggs = aggs;
  return callWithRequest(req, 'search', params)
  .then(function (resp) {
    if (!resp.aggregations) return;
    const aggCheck = resp.aggregations.check;
    const bucketSize = aggCheck.meta.bucketSize;
    const defaultCalculation = (bucket) => {
      const key = (metric.derivative) ? 'metric_deriv' : 'metric';
      let value =  bucket[key] && bucket[key].value || 0;
      // We need to convert metric_deriv from the bucket size to seconds if
      // the units are per second
      if (metric.units === '/s') {
        value = value / bucketSize;
        if (value < 0) {
          value = 0;
        }
      }
      return value;
    };
    const calculation = metric && metric.calculation || defaultCalculation;
    const buckets = aggCheck.buckets;
    const boundsMin = moment.utc(aggCheck.meta.timefilterMin);
    const boundsMax = moment.utc(aggCheck.meta.timefilterMax);
    const data = _.chain(buckets)
    .filter(filterPartialBuckets(boundsMin, boundsMax, bucketSize))
    .map((bucket) => {
      return {
        x: bucket.key,
        y: calculation(bucket) // Why are one of these null?
      };
    })
    .value();
    return {
      metric: filterMetric(metric),
      data: data
    };
  });
};
