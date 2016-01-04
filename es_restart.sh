#!/bin/bash
#
# Restart elasticsearch cluster
#

NODES=$(docker ps -a -q --filter "name=es")

if [ "${NODES}" ]; then
  echo "Stopping elasticsearch nodes..."
  docker stop ${NODES}

  # remove problematic marvel data
  ./es_clean_marvel.sh

  echo "Starting elasticsearch nodes..."
  docker start ${NODES}
fi
