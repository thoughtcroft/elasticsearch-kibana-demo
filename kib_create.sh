#!/bin/bash
#
# Create kibana nodes
#

CONT_DIR="/opt/kibana"
HOST_DIR="${PWD}/kibana"
CONFIG_FILE="kibana.yml"
DOCKER_IP=$(docker-machine ip dev 2> /dev/null)
CONT_PORT=5601
CONTAINERS="kibana_marvel kibana_timelion"
ELASTICSEARCH_URL="http://${DOCKER_IP}:9201"

echo "Creating new kibana nodes..."

# set up the config
mkdir -p ${HOST_DIR}/config
rm -f ${HOST_DIR}/config/${CONFIG_FILE}
while read line; do
  eval echo "$line" >> ${HOST_DIR}/config/${CONFIG_FILE}
done < ${HOST_DIR}/${CONFIG_FILE}

NUM=0
for CONTAINER in ${CONTAINERS}; do

  NUM=$((NUM + 1))

  docker run --name ${CONTAINER} -d \
    --restart always \
    -e ELASTICSEARCH_URL=${ELASTICSEARCH_URL} \
    -p ${DOCKER_IP}:808${NUM}:${CONT_PORT} \
    -v ${HOST_DIR}/config:${CONT_DIR}/config \
    ${CONTAINER}

  echo "Access ${CONTAINER} at 'http://dockerhost:808${NUM}'"
done
