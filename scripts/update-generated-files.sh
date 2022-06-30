#!/bin/sh

# use provided source path or a default
DUALITY_CORE_DIRECTORY="${1:-"../duality"}"

# copy files
cp -r "$DUALITY_CORE_DIRECTORY/vue/src/store/generated/duality/duality.duality/module" \
      "src/generated/duality/duality.duality"

# copy version info
cp -r "$DUALITY_CORE_DIRECTORY/vue/src/store/generated/duality/duality.duality/package.json" \
      "src/generated/duality/duality.duality/package.json"

# copy readme info
cp -r "$DUALITY_CORE_DIRECTORY/vue/src/store/generated/readme.md" \
      "src/generated/readme.md"
