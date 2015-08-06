#!/bin/bash
#
# Destroy elasticseach cluster
#

NODES=$(docker ps -a -q --filter "name=es")
docker stop ${NODES}
docker rm ${NODES}
