#!/bin/bash
#
# Remove marvel data for cleaner restart
#

shopt -s nullglob

FILES=(./data/*/wazza-is-awesome/nodes/*/indices/.marvel-es-2016*)

echo "Clearing the marvel problematic data..."

for FILE in "${FILES[@]}"; do
  echo "$FILE"
  rm -rf "$FILE"
done
