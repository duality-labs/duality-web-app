#!/bin/sh

# use provided source path or a default
DUALITY_CORE_DIRECTORY="${1:-"../duality"}"

# remove previous files
rm -r "src/lib/web3/generated/ts-client"

# copy module files
cp -r "$DUALITY_CORE_DIRECTORY/ts-client" "src/lib/web3/generated"

# transform files to pass TypeScript compilation with our settings
node ./scripts/update-generated-files.mjs
