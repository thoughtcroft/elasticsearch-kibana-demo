#!/bin/bash
#
# Destroy kibana nodes
#

NODES=$(docker ps -a -q --filter "name=kib")

if [ "${NODES}" ]; then
  echo "Stopping and removing kibana nodes..."
  docker kill ${NODES}
  docker rm ${NODES}
fi
