import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({ where: { id } });

      if (!reservation) throw new Error("NOT_FOUND");

      // idempotent — releasing an already-released reservation is fine
      if (reservation.status !== "pending") return reservation;

      const released = await tx.reservation.update({
        where: { id },
        data: { status: "released" },
      });

      await tx.stockLevel.update({
        where: {
          productId_warehouseId: {
            productId: reservation.productId,
            warehouseId: reservation.warehouseId,
          },
        },
        data: { reservedUnits: { decrement: reservation.quantity } },
      });

      return released;
    });

    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";

    if (msg === "NOT_FOUND") return NextResponse.json({ error: "Reservation not found" }, { status: 404 });

    console.error("release error:", err);
    return NextResponse.json({ error: "Failed to release" }, { status: 500 });
  }
}
