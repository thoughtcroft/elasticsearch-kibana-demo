#!/bin/bash
#
# Destroy elasticsearch cluster
#

NODES=$(docker ps -a -q --filter "name=es")

if [ "${NODES}" ]; then
  echo "Stopping and removing elasticsearch nodes..."
  docker kill ${NODES}
  docker rm ${NODES}
fi
