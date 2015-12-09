module.exports = function mapArgumentsToObject(fields) {
  return function () {
    const reduce = Array.prototype.reduce.bind(arguments);
    return reduce((data, arg, index) => {
      data[fields[index]] = arg;
      return data;
    }, {});
  };
};
