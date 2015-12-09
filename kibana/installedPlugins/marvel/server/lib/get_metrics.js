const Promise = require('bluebird');
const getSeries = require('./get_series');
module.exports = (req, indices, filters = []) => {
  const metrics = req.payload.metrics || [];
  return Promise.map(metrics, (metricName) => {
    return getSeries(req, indices, metricName, filters);
  })
  .then(function (rows) {
    const data = {};
    metrics.forEach(function (key, index) {
      data[key] = rows[index];
    });
    return data;
  });
};
