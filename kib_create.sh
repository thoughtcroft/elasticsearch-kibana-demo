#!/bin/bash
#
# Create kibana node
#

CONT_DIR="/opt/kibana"
HOST_DIR="${PWD}/kibana"
CONFIG_FILE="kibana.yml"
DOCKER_IP=$(docker-machine ip dev 2> /dev/null)
PORT=5601
ELASTICSEARCH_URL="http://${DOCKER_IP}:9201"

echo "Creating new kibana node..."

for FOLDER in "config optimize installedPlugins"; do
  mkdir -p ${HOST_DIR}/${FOLDER}
done

rm -f ${HOST_DIR}/config/${CONFIG_FILE}
while read line; do
  eval echo "$line" >> ${HOST_DIR}/config/${CONFIG_FILE}
done < ${HOST_DIR}/${CONFIG_FILE}

docker run --name kibana -d \
  --restart always \
  --net host \
  -e ELASTICSEARCH_URL=${ELASTICSEARCH_URL} \
  -p ${DOCKER_IP}:${PORT}:${PORT} \
  -v ${HOST_DIR}/config:${CONT_DIR}/config \
  -v ${HOST_DIR}/installedPlugins:${CONT_DIR}/installedPlugins \
  -v ${HOST_DIR}/optimize:${CONT_DIR}/optimize \
  kibana \
  /bin/bash -c 'usermod -u 1000 kibana; gosu kibana kibana'

echo "Access kibana at 'http://dockerhost:5601'"
