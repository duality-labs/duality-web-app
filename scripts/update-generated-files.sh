#!/bin/sh

# use provided source path or a default
CHAIN_REPO="${1:-"duality"}"
CHAIN_REPO_USER_NAME=$(echo $CHAIN_REPO | cut -d '/' -f 1)                          # get name part
CHAIN_REPO_PROJECT_NAME=$(echo "$CHAIN_REPO" | cut -d '/' -f 2)                     # get name part
CHAIN_REPO_PROJECT_NAME="${CHAIN_REPO_PROJECT_NAME:-$CHAIN_REPO_USER_NAME}"         # default project name to copy of username if not specified
CHAIN_REPO_MODULE_NAME=$(echo $CHAIN_REPO_USER_NAME | tr '[:upper:]' '[:lower:]')   # get name part as lowercase of username
DUALITY_CORE_DIRECTORY="${2:-"../duality"}"

# copy module files
cp -r "$DUALITY_CORE_DIRECTORY/vue/src/store/generated/$CHAIN_REPO" \
      "src/lib/web3/generated"

# copy readme info
cp -r "$DUALITY_CORE_DIRECTORY/vue/src/store/generated/readme.md" \
      "src/lib/web3/generated/readme.md"

node ./scripts/update-generated-files.mjs
