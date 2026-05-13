import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cleanup-secret");
  if (process.env.CLEANUP_SECRET && secret !== process.env.CLEANUP_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();

    const expired = await prisma.reservation.findMany({
      where: { status: "pending", expiresAt: { lt: now } },
    });

    if (!expired.length) {
      return NextResponse.json({ cleaned: 0 });
    }

    let cleaned = 0;

    for (const r of expired) {
      try {
        await prisma.$transaction([
          prisma.reservation.update({
            where: { id: r.id },
            data: { status: "released" },
          }),
          prisma.stockLevel.update({
            where: { productId_warehouseId: { productId: r.productId, warehouseId: r.warehouseId } },
            data: { reservedUnits: { decrement: r.quantity } },
          }),
        ]);
        cleaned++;
      } catch (e) {
        console.error(`cleanup skip ${r.id}:`, e);
      }
    }

    return NextResponse.json({ cleaned, total: expired.length });
  } catch (err) {
    console.error("cleanup error:", err);
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  }
}
