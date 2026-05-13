# Allo Reservation System

A Next.js application for managing inventory reservations across multiple warehouses. Handles the race condition between payment processing and inventory availability by temporarily reserving units during checkout.

## How It Works

When a customer proceeds to checkout:
1. Units are temporarily **reserved** for 10 minutes
2. If payment succeeds, the reservation is **confirmed** and stock is permanently decremented
3. If payment fails or time expires, the reservation is **released** and units become available again

This prevents overselling while maintaining good conversion rates.

## Setup

### Prerequisites
- Node.js 18+
- A Supabase or Neon PostgreSQL database
- (Optional) Redis for idempotent request handling

### Installation

1. Clone the repo and install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your database URL and any other settings.

3. Run migrations:
```bash
npm run prisma:migrate
```

4. Seed test data:
```bash
npm run prisma:seed
```

5. Start the dev server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## API Endpoints

### Products
- **GET** `/api/products` - List products with stock per warehouse

### Warehouses
- **GET** `/api/warehouses` - List all warehouses

### Reservations
- **POST** `/api/reservations` - Create a reservation (10-minute hold)
  - Returns `201` on success
  - Returns `409` if insufficient stock
  
- **POST** `/api/reservations/:id` - Confirm or release a reservation
  - Body: `{ action: "confirm" | "release" }`
  - Confirm returns `410` if expired
  
### Cleanup
- **POST** `/api/cleanup` - Manually trigger expired reservation cleanup
  - Optional header: `x-cleanup-secret` for security

## Concurrency Safety

The reservation endpoint uses **database transactions with row-level locks** (`SELECT ... FOR UPDATE`) to ensure exactly one request succeeds when two arrive simultaneously for the last unit:

1. Lock the `stock_levels` row for the product/warehouse
2. Check available units (total - reserved)
3. If enough, create reservation and increment reserved units
4. If not enough, return 409 before lock is released
5. Lock ensures atomicity; other concurrent requests wait and see updated reserved count

This approach is simpler and safer than distributed locks and doesn't require external services.

## Reservation Expiry

Expired reservations are cleaned up automatically via a cleanup route that can be called by:

- **Vercel Cron**: Add to `vercel.json`:
  ```json
  {
    "crons": [{
      "path": "/api/cleanup",
      "schedule": "*/1 * * * *"
    }]
  }
  ```

- **External scheduler** (e.g., GitHub Actions): `POST /api/cleanup` with optional `x-cleanup-secret` header

- **Lazy cleanup**: On first load after expiry, the cleanup runs automatically

The cleanup endpoint:
- Finds all pending reservations past `expiresAt`
- Releases them atomically (marks as released, decrements reserved units)
- Returns count of cleaned reservations

## Frontend Flow

1. **Product List** - Browse products, see available stock per warehouse
2. **Checkout** - Select warehouse and quantity, create reservation
3. **Live Countdown** - See 10-minute timer, errors displayed inline
4. **Confirm or Cancel** - Complete purchase or release reservation
5. **Instant Feedback** - UI updates without page refresh

## Trade-offs & Future Improvements

- **No session management** - Reservations tied to reservation ID, not user account. For production, associate to user and track separately.
- **No inventory forecasting** - Doesn't predict peak demand or suggest warehouse routing. Could add demand forecasting.
- **Cleanup frequency** - If using a cron job, every 1 minute may be too frequent or too sparse depending on workload. Adjust based on typical checkout duration.
- **Idempotency** - Basic key tracking, no Redis. For truly distributed systems, add Redis for faster lookups.
- **Notifications** - No email/SMS when reservation expires. Could integrate Twilio or SendGrid.
- **Multi-region** - Database is single-region. For global scale, would need read replicas and event streaming.

## Testing Concurrency

To test the race condition handling:

```bash
# Terminal 1: Reserve first unit
curl -X POST http://localhost:3000/api/reservations \
  -H "Content-Type: application/json" \
  -d '{"productId":"...", "warehouseId":"...", "quantity":1}'

# Terminal 2: Reserve same unit simultaneously
# Should get 409 from one, 201 from the other
```

## Stack

- **Next.js 15** with App Router
- **TypeScript** end-to-end
- **Prisma** for database access
- **PostgreSQL** (hosted, e.g., Supabase, Neon)
- **Tailwind CSS** for styling

## Deployment

Recommended: **Vercel + Supabase**

1. Push to GitHub
2. Create new Supabase project, get connection string
3. Connect GitHub repo to Vercel
4. Add `DATABASE_URL` to Vercel environment variables
5. Deploy; Vercel will auto-run migrations
6. Add cron job in `vercel.json` for cleanup

---

**Status**: Fully functional core system with manual test coverage. Ready for debrief.
