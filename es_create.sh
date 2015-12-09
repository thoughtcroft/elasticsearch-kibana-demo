#!/bin/bash
#
# Create elasticsearch cluster
#
# work out how many nodes we want default 3
# to add more $1 = count and $2 = start number
NODES=${1:-3}
START=${2:-1}
END=$(($START + $NODES - 1))

PREFIX="es"
CONT_DIR="/usr/share/elasticsearch"
HOST_DIR="${PWD}"
PLUGINS="${HOST_DIR}/plugins"
CONFIG_FILES="elasticsearch.yml logging.yml"
CLUSTER="wazza-is-awesome"
DOCKER_IP=$(docker-machine ip dev 2> /dev/null)

echo "Creating new elasticsearch nodes..."

for NUM in $(printf "%02d " $(seq ${START} ${END})); do
  NODE=${PREFIX}${NUM}
  DATA=${HOST_DIR}/data/${NODE}
  mkdir -p ${DATA}

  CONFIG=${HOST_DIR}/config/${NODE}
  mkdir -p ${CONFIG}/scripts  # need an empty scripts dir until permissions fixed in image
  for FILE in ${CONFIG_FILES}; do
    rm -f ${CONFIG}/${FILE}
    cp ${HOST_DIR}/${FILE} ${CONFIG}/${FILE}
  done

  docker run --name ${NODE} -d \
    --restart always \
    --net host \
    -p ${DOCKER_IP}:92${NUM}:9200 \
    -e "CLUSTER=${CLUSTER}" \
    -e "NODE=${NODE}" \
    -v ${DATA}:${CONT_DIR}/data \
    -v ${CONFIG}:${CONT_DIR}/config \
    -v ${PLUGINS}:${CONT_DIR}/plugins \
    elasticsearch \
    /bin/bash -c 'usermod -u 1000 elasticsearch; gosu elasticsearch elasticsearch'
done

echo "Access the cluster at 'http://dockerhost:9201'"
