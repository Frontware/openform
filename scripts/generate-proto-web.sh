#!/bin/bash

# Generate TypeScript files from proto
npx protoc -I=. \
  --es_out=lib/proto \
  --es_opt=target=ts \
  --connect-es_out=lib/proto \
  --connect-es_opt=target=ts \
  proto/*.proto

# Fix import extensions (remove .js from imports in .ts files)
find lib/proto/proto -name "*.ts" -exec sed -i 's/from "\.\/\(.*\)\.js"/from ".\/\1"/g' {} +

echo "✓ Generated TypeScript proto files"
