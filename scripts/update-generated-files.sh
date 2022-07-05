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

# TODO: fix Starports terrible code
# the follow code should work in some environment?: https://unix.stackexchange.com/questions/26284/how-can-i-use-sed-to-replace-a-multi-line-string#525524

REPLACE_THIS="let client;\n  if (addr) {\n    client = await SigningStargateClient.connectWithSigner(addr, wallet, { registry });\n  }else{\n    client = await SigningStargateClient.offline( wallet, { registry });\n  }"
REPLACE_WITH="const client = addr\n    ? await SigningStargateClient.connectWithSigner(addr, wallet, { registry })\n    : await SigningStargateClient.offline( wallet, { registry });"

sed -z "s/$REPLACE_THIS/$REPLACE_WITH/" -i src/generated/duality/duality.duality/module/index.ts
