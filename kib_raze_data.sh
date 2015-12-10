#!/bin/bash
#
# Totally remove kibana data
#

HOST_DIR="${PWD}/kibana"
FOLDERS="optimize installedPlugins"

echo "Razing the kibana data..."

for FOLDER in ${FOLDERS}; do
  rm -rf "${HOST_DIR}/${FOLDER}"
done
