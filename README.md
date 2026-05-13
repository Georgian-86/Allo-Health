# allo-reservation

**Live Demo**: [https://allo-reservation.vercel.app](https://allo-reservation.vercel.app)

Inventory reservation system for multi-warehouse retail. Handles the race condition between payment processing and available stock by holding units during checkout.

## How it works

When a customer proceeds to checkout, the API temporarily reserves units for 10 minutes. If payment succeeds, the reservation is confirmed and stock is permanently decremented. If payment fails or the timer expires, the hold is released and units become available again.

The core of the concurrency guarantee is a `SELECT ... FOR UPDATE` lock inside a database transaction. Two requests arriving simultaneously for the last unit of a SKU will serialize at the lock — exactly one gets a 201, the other a 409.

## Running locally

```bash
npm install
cp .env.local.example .env.local
# fill in DATABASE_URL and DIRECT_URL from your Supabase project settings
```

Run migrations and seed:
```bash
npx prisma migrate dev --name init
node prisma/seed.js
npm run dev
```

Open http://localhost:3000.

## Environment variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | Supabase pooler connection string (port 5432, session mode) |
| `DIRECT_URL` | Direct Supabase connection for migrations (port 5432, direct) |
| `CLEANUP_SECRET` | Optional header secret for the `/api/cleanup` endpoint |

## API

| Method | Path | Description |
|---|---|---|
| GET | `/api/products` | Products with stock per warehouse |
| GET | `/api/warehouses` | All warehouses |
| POST | `/api/reservations` | Create reservation (returns 409 if insufficient stock) |
| POST | `/api/reservations/:id/confirm` | Confirm reservation (returns 410 if expired) |
| POST | `/api/reservations/:id/release` | Release reservation early |
| POST | `/api/cleanup` | Release all expired pending reservations |

The reserve endpoint accepts an optional `Idempotency-Key` header. Retrying with the same key returns the original response without creating a duplicate reservation.

## Expiry mechanism

In production (Vercel), `vercel.json` schedules `POST /api/cleanup` every minute via Vercel Cron. The endpoint finds all `pending` reservations past their `expiresAt`, marks them `released`, and decrements `reservedUnits` back to the stock level — atomically, per reservation.

The frontend also handles expiry gracefully: the countdown timer zeroes out and the UI resets to the reservation form so the user can try again.

## Concurrency

The reservation endpoint uses `SELECT ... FOR UPDATE` inside a Prisma `$transaction`. This locks the `stock_levels` row for the duration of the transaction, so concurrent requests for the same product/warehouse serialize. The second request sees the updated `reservedUnits` after the lock is released, and if stock is now insufficient, it gets a 409.

## Trade-offs and what I'd do differently

- **No user sessions** — reservations are ID-based. In production you'd associate them to authenticated users and show them their active reservations.
- **Idempotency is DB-only** — the `idempotencyKey` unique constraint in Postgres is sufficient for this scale. At higher throughput, a Redis lookup would be faster (no DB hit for cache hits).
- **Cleanup is eventually consistent** — there's a window of up to ~1 minute where expired reservations still count against available stock. An alternative would be treating `reservedUnits` as expired if `expiresAt < now` inline in the stock query, but that adds complexity to every read path.
- **No soft delete / audit trail** — a production system would want to keep a history of reservation state changes rather than just a final status field.
