import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();
    const { action } = body;

    if (action === "confirm") {
      return handleConfirm(id);
    } else if (action === "release") {
      return handleRelease(id);
    } else {
      return NextResponse.json(
        { error: "Invalid action. Use 'confirm' or 'release'" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Reservation action error:", error);
    return NextResponse.json(
      { error: "Failed to process reservation action" },
      { status: 500 }
    );
  }
}

async function handleConfirm(reservationId: string) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({
        where: { id: reservationId },
      });

      if (!reservation) {
        throw new Error("NOT_FOUND");
      }

      if (reservation.status !== "pending") {
        throw new Error("INVALID_STATUS");
      }

      if (new Date() > reservation.expiresAt) {
        throw new Error("EXPIRED");
      }

      // Mark as confirmed and decrement total units
      const updated = await tx.reservation.update({
        where: { id: reservationId },
        data: { status: "confirmed" },
      });

      // Decrement both reserved and total units
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

      return updated;
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    if (message === "NOT_FOUND") {
      return NextResponse.json(
        { error: "Reservation not found" },
        { status: 404 }
      );
    }

    if (message === "EXPIRED") {
      return NextResponse.json(
        { error: "Reservation has expired" },
        { status: 410 }
      );
    }

    if (message === "INVALID_STATUS") {
      return NextResponse.json(
        { error: "Reservation is not pending" },
        { status: 400 }
      );
    }

    console.error("Confirm error:", error);
    return NextResponse.json(
      { error: "Failed to confirm reservation" },
      { status: 500 }
    );
  }
}

async function handleRelease(reservationId: string) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({
        where: { id: reservationId },
      });

      if (!reservation) {
        throw new Error("NOT_FOUND");
      }

      if (reservation.status === "released" || reservation.status === "confirmed") {
        // Idempotent: already released/confirmed, return as-is
        return reservation;
      }

      // Mark as released and decrement reserved units
      const updated = await tx.reservation.update({
        where: { id: reservationId },
        data: { status: "released" },
      });

      // Decrement only reserved units (total stays the same)
      await tx.stockLevel.update({
        where: {
          productId_warehouseId: {
            productId: reservation.productId,
            warehouseId: reservation.warehouseId,
          },
        },
        data: {
          reservedUnits: { decrement: reservation.quantity },
        },
      });

      return updated;
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    if (message === "NOT_FOUND") {
      return NextResponse.json(
        { error: "Reservation not found" },
        { status: 404 }
      );
    }

    console.error("Release error:", error);
    return NextResponse.json(
      { error: "Failed to release reservation" },
      { status: 500 }
    );
  }
}
