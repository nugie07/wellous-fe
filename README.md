# Wellous

Frontend React (Vite + TypeScript) dengan **shadcn/ui** sebagai base template.

- **URL development:** http://wellous.nuradigital.test
- **Stack:** React 18, Vite 6, Tailwind CSS v4, shadcn/ui (New York style)

## Menjalankan (Docker) — Vite dev + hot reload

Dari root repo nuradigital:

```bash
docker compose up -d frontend-wellous
```

Buka **http://wellous.nuradigital.test**. Perubahan kode langsung terlihat (tanpa build). Pastikan hostname mengarah ke localhost (misalnya di `/etc/hosts` atau Traefik).

**Setelah menambah dependency di `package.json`** (misalnya leaflet, recharts), wajib install di dalam container agar volume `node_modules` ter-update:

```bash
docker compose exec frontend-wellous sh -c "npm install"
```

Atau hapus volume lalu jalankan ulang (install dari nol):

```bash
docker compose down frontend-wellous
docker volume rm nuradigital_wellous_node_modules
docker compose up -d frontend-wellous
```

## Development lokal (tanpa Docker)

```bash
npm install
npm run dev
```

Buka http://localhost:5173. Untuk akses dari hostname `wellous-dev.nuradigital.test`, pastikan `server.allowedHosts` di `vite.config.ts` sudah sesuai.

## Menambah komponen shadcn

Di dalam container atau di host (jika sudah ada Node):

```bash
npx shadcn@latest add <nama-komponen>
```

Contoh: `npx shadcn@latest add input`, `npx shadcn@latest add dialog`
