#!/bin/bash

# Generate TypeScript files from proto
npx protoc -I=. \
  --es_out=lib/proto \
  --es_opt=target=ts \
  --connect-es_out=lib/proto \
  --connect-es_opt=target=ts \
  proto/*.proto

echo "✓ Generated TypeScript proto files"
