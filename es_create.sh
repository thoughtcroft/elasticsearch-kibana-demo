#!/bin/bash
#
# Create elasticsearch cluster
#

NODES=${1:-3}
BASE_DIR="${HOME}/elasticsearch"
DOCKER_IP=$(boot2docker ip 2> /dev/null)

for NUM in $(seq 1 ${NODES})
do
  NAME=es${NUM}
  docker run --name ${NAME} -d \
    -p ${DOCKER_IP}:920${NUM}:9200 \
    -v ${BASE_DIR}/plugins:/usr/share/elasticsearch/plugins \
    elasticsearch
done

  # DATA=${BASE_DIR}/data/${NAME}
  # mkdir -p ${DATA}/elasticsearch/nodes
  #  -v ${DATA}:/usr/share/elasticsearch/data \
