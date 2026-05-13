import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id },
    });

    if (!reservation) {
      return NextResponse.json(
        { error: "Reservation not found" },
        { status: 404 }
      );
    }

    if (reservation.status !== "pending") {
      return NextResponse.json(
        { error: "Reservation is not pending" },
        { status: 400 }
      );
    }

    // Check expiry
    if (new Date() > reservation.expiresAt) {
      return NextResponse.json(
        { error: "Reservation has expired" },
        { status: 410 }
      );
    }

    // Confirm the reservation
    const confirmed = await prisma.reservation.update({
      where: { id },
      data: { status: "confirmed" },
    });

    // Update stock level - decrement both total and reserved
    await prisma.stockLevel.update({
      where: {
        productId_warehouseId: {
          productId: reservation.productId,
          warehouseId: reservation.warehouseId,
        },
      },
      data: {
        totalUnits: {
          decrement: reservation.quantity,
        },
        reservedUnits: {
          decrement: reservation.quantity,
        },
      },
    });

    return NextResponse.json(confirmed, { status: 200 });
  } catch (error) {
    console.error("Confirm error:", error);
    return NextResponse.json(
      { error: "Failed to confirm reservation" },
      { status: 500 }
    );
  }
}
