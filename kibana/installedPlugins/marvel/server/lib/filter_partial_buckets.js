const moment = require('moment');

/* calling .subtract or .add on a moment object mutates the object
 * so this function shortcuts creating a fresh object */
function getTime(bucket) {
  return moment.utc(bucket.key);
}

/* find the milliseconds of difference between 2 moment objects */
function getDelta(t1, t2) {
  return moment.duration(t1 - t2).asMilliseconds();
}

module.exports = (min, max, bucketSize) => {
  return (bucket) => {
    if (getDelta(getTime(bucket).subtract(bucketSize, 'seconds'), min) < 0) {
      return false;
    }
    if (getDelta(max, getTime(bucket).add(bucketSize, 'seconds')) < 0) {
      return false;
    }
    return true;
  };
};

