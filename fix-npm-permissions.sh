#!/bin/bash
# Jalankan di terminal: bash fix-npm-permissions.sh
# Memperbaiki EACCES saat npm install (node_modules/dist dibuat oleh root/Docker)

set -e
cd "$(dirname "$0")"

echo "Memperbaiki kepemilikan node_modules dan dist..."
sudo chown -R "$(whoami):$(whoami)" node_modules dist 2>/dev/null || true
sudo chown "$(whoami):$(whoami)" tsconfig.app.tsbuildinfo tsconfig.node.tsbuildinfo 2>/dev/null || true

# Opsi: hapus node_modules lalu install ulang (jika chown tidak cukup)
if [ -d "node_modules" ] && [ "$(ls -A node_modules 2>/dev/null)" = "" ]; then
  rmdir node_modules 2>/dev/null || true
fi
if [ ! -d "node_modules" ] || [ "$(stat -c '%U' node_modules 2>/dev/null)" != "$(whoami)" ]; then
  echo "Menghapus node_modules (owned by root) agar npm install membuat ulang..."
  sudo rm -rf node_modules
fi

echo "Menjalankan npm install..."
npm install

echo "Selesai."
