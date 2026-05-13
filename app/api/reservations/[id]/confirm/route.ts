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
      if (reservation.status !== "pending") throw new Error("INVALID_STATUS");
      if (new Date() > reservation.expiresAt) throw new Error("EXPIRED");

      const confirmed = await tx.reservation.update({
        where: { id },
        data: { status: "confirmed" },
      });

      await tx.stockLevel.update({
        where: {
          productId_warehouseId: {
            productId: reservation.productId,
            warehouseId: reservation.warehouseId,
          },
        },
        data: {
          totalUnits: { decrement: reservation.quantity },
          reservedUnits: { decrement: reservation.quantity },
        },
      });

      return confirmed;
    });

    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";

    if (msg === "NOT_FOUND") return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    if (msg === "EXPIRED")   return NextResponse.json({ error: "Reservation has expired" }, { status: 410 });
    if (msg === "INVALID_STATUS") return NextResponse.json({ error: "Reservation is not pending" }, { status: 400 });

    console.error("confirm error:", err);
    return NextResponse.json({ error: "Failed to confirm" }, { status: 500 });
  }
}
