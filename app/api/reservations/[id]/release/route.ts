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

    // Release the reservation
    const released = await prisma.reservation.update({
      where: { id },
      data: { status: "released" },
    });

    // Update stock level - decrement only reserved units
    await prisma.stockLevel.update({
      where: {
        productId_warehouseId: {
          productId: reservation.productId,
          warehouseId: reservation.warehouseId,
        },
      },
      data: {
        reservedUnits: {
          decrement: reservation.quantity,
        },
      },
    });

    return NextResponse.json(released, { status: 200 });
  } catch (error) {
    console.error("Release error:", error);
    return NextResponse.json(
      { error: "Failed to release reservation" },
      { status: 500 }
    );
  }
}
