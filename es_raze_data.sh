#!/bin/bash
#
# Totally remove cluster data
#

HOST_DIR="${PWD}"
DATA_DIR="${HOST_DIR}/data"

echo "Razing the elasticsearch cluster data..."

rm -rf "${DATA_DIR}"
