import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { reserveRequestSchema, confirmRequestSchema } from "@/lib/schemas";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const validation = reserveRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { productId, warehouseId, quantity, idempotencyKey } = validation.data;

    // Check for idempotency key
    if (idempotencyKey) {
      const existing = await prisma.reservation.findUnique({
        where: { idempotencyKey },
      });
      if (existing) {
        return NextResponse.json(existing, { status: 200 });
      }
    }

    // Use transaction with row-level lock for concurrency safety
    const reservation = await prisma.$transaction(async (tx) => {
      // Lock the stock level row and fetch current state
      const stockLevel = await tx.$queryRaw<
        { totalUnits: number; reservedUnits: number }[]
      >`
        SELECT "totalUnits", "reservedUnits" 
        FROM stock_levels 
        WHERE "productId" = ${productId} AND "warehouseId" = ${warehouseId}
        FOR UPDATE
      `;

      if (!stockLevel || stockLevel.length === 0) {
        throw new Error("Stock level not found");
      }

      const { totalUnits, reservedUnits } = stockLevel[0];
      const availableUnits = totalUnits - reservedUnits;

      if (availableUnits < quantity) {
        throw new Error("INSUFFICIENT_STOCK");
      }

      // Create reservation and update reserved units
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      const newReservation = await tx.reservation.create({
        data: {
          productId,
          warehouseId,
          quantity,
          status: "pending",
          expiresAt,
          idempotencyKey: idempotencyKey || undefined,
        },
      });

      // Update stock level
      await tx.stockLevel.update({
        where: {
          productId_warehouseId: { productId, warehouseId },
        },
        data: {
          reservedUnits: reservedUnits + quantity,
        },
      });

      return newReservation;
    });

    return NextResponse.json(reservation, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    if (message === "INSUFFICIENT_STOCK") {
      return NextResponse.json(
        { error: "Insufficient stock available" },
        { status: 409 }
      );
    }

    console.error("Reservation error:", error);
    return NextResponse.json(
      { error: "Failed to create reservation" },
      { status: 500 }
    );
  }
}
