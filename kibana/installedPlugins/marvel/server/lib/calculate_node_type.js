module.exports = (node, state) => {
  let type = 'node';
  let data = true;
  let eligibleMaster = true;
  let client = true;
  const attributes = node.attributes || {};
  if (attributes.data) {
    data = attributes.data === 'true';
  }
  if (attributes.master) {
    eligibleMaster = attributes.master === 'true';
  }
  if (attributes.master && attributes.data) {
    client = attributes.master === 'false' && attributes.data === 'false';
  }
  node.master = (node.id === state.master_node);
  if (!data && !eligibleMaster) type = 'client';
  if (!data && eligibleMaster) type = 'master_only';
  if (data && !eligibleMaster) type = 'data';
  node.type = type;
  return node;

};
