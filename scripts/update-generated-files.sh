#!/bin/sh

# use provided source path or a default
DUALITY_CORE_DIRECTORY="${1:-"../duality"}"

# copy type files
cp -r "$DUALITY_CORE_DIRECTORY/vue/src/store/generated/duality/duality.duality/module/types" \
      "src/lib/web3/generated/duality/duality.duality/module"

# copy REST API file
cp -r "$DUALITY_CORE_DIRECTORY/vue/src/store/generated/duality/duality.duality/module/rest.ts" \
      "src/lib/web3/generated/duality/duality.duality/module/rest.ts"

# copy version info
cp -r "$DUALITY_CORE_DIRECTORY/vue/src/store/generated/duality/duality.duality/package.json" \
      "src/lib/web3/generated/duality/duality.duality/package.json"

# copy readme info
cp -r "$DUALITY_CORE_DIRECTORY/vue/src/store/generated/readme.md" \
      "src/lib/web3/generated/readme.md"
