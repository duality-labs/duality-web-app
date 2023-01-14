#!/bin/sh

docker exec -it $(docker ps -q) /bin/bash -c  "cd ../workspaces/duality && git config --global --add safe.directory /workspaces/duality && git checkout . && git checkout $1 && rm -rf ts-client && ignite generate ts-client -y"

# use provided source path or a default
DUALITY_CORE_DIRECTORY="../duality"

# remove previous files
rm -rf "src/lib/web3/generated/ts-client"

# copy module files
cp -r "$DUALITY_CORE_DIRECTORY/ts-client" "src/lib/web3/generated"

# transform files to pass TypeScript compilation with our settings
node ./scripts/update-generated-files.mjs

cp scripts/template.md README.md;

PR="$(echo $(cd ../duality && git log -1 --format="%s" | grep -Eo "\(#(\d+)\)" | cut -c "3-5"))"
SHA="$(cd ../duality && git rev-parse HEAD)"
SHORT_SHA="$(echo "$SHA" | cut -c1-7)"
sed -i '' -e "s/{PR}/$PR/g" -e "s/{SHA}/$SHA/g" -e "s/{SHORT_SHA}/$SHORT_SHA/g" -- README.md;

git add .
git commit -m "Add new backend changes for commit ${SHORT_SHA}:

    - see: https://github.com/duality-labs/duality/commit/${SHA}"
