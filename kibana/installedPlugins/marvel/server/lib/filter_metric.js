const _ = require('lodash');
module.exports = (metric) => {
  const fields = [
    'field',
    'label',
    'description',
    'units',
    'format'
  ];
  return _.pick(metric, fields);
};
