import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { reserveRequestSchema } from "@/lib/schemas";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const idempotencyKey = req.headers.get("idempotency-key") ?? undefined;

    const parsed = reserveRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { productId, warehouseId, quantity } = parsed.data;

    if (idempotencyKey) {
      const existing = await prisma.reservation.findUnique({
        where: { idempotencyKey },
      });
      if (existing) return NextResponse.json(existing, { status: 200 });
    }

    const reservation = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        { totalUnits: number; reservedUnits: number }[]
      >`
        SELECT "totalUnits", "reservedUnits"
        FROM stock_levels
        WHERE "productId" = ${productId} AND "warehouseId" = ${warehouseId}
        FOR UPDATE
      `;

      if (!rows.length) throw new Error("STOCK_NOT_FOUND");

      const { totalUnits, reservedUnits } = rows[0];
      if (totalUnits - reservedUnits < quantity) throw new Error("INSUFFICIENT_STOCK");

      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      const newReservation = await tx.reservation.create({
        data: { productId, warehouseId, quantity, status: "pending", expiresAt, idempotencyKey },
      });

      await tx.stockLevel.update({
        where: { productId_warehouseId: { productId, warehouseId } },
        data: { reservedUnits: reservedUnits + quantity },
      });

      return newReservation;
    });

    return NextResponse.json(reservation, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";

    if (msg === "INSUFFICIENT_STOCK") {
      return NextResponse.json({ error: "Insufficient stock available" }, { status: 409 });
    }
    if (msg === "STOCK_NOT_FOUND") {
      return NextResponse.json({ error: "Product not found at this warehouse" }, { status: 404 });
    }

    console.error("reservation error:", err);
    return NextResponse.json({ error: "Failed to create reservation" }, { status: 500 });
  }
}
