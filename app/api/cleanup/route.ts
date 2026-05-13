import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// This endpoint handles automatic cleanup of expired reservations
// Can be called by a Vercel Cron job or triggered manually
export async function POST(req: NextRequest) {
  // Optional: Add a secret header check for security
  const secret = req.headers.get("x-cleanup-secret");
  if (process.env.CLEANUP_SECRET && secret !== process.env.CLEANUP_SECRET) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    // Find all pending reservations that have expired
    const now = new Date();
    const expiredReservations = await prisma.reservation.findMany({
      where: {
        status: "pending",
        expiresAt: {
          lt: now,
        },
      },
    });

    if (expiredReservations.length === 0) {
      return NextResponse.json({
        message: "No expired reservations to clean up",
        cleaned: 0,
      });
    }

    // Release each expired reservation in a transaction
    let cleaned = 0;
    for (const reservation of expiredReservations) {
      try {
        await prisma.$transaction(async (tx) => {
          // Update reservation status
          await tx.reservation.update({
            where: { id: reservation.id },
            data: { status: "released" },
          });

          // Decrement reserved units
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
        });
        cleaned++;
      } catch (err) {
        console.error(
          `Failed to clean up reservation ${reservation.id}:`,
          err
        );
      }
    }

    return NextResponse.json({
      message: "Cleanup completed",
      cleaned,
      total: expiredReservations.length,
    });
  } catch (error) {
    console.error("Cleanup error:", error);
    return NextResponse.json(
      { error: "Cleanup failed" },
      { status: 500 }
    );
  }
}
