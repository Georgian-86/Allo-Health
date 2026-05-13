import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      include: {
        stockLevels: { include: { warehouse: true } },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(
      products.map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        stock: p.stockLevels.map((s) => ({
          warehouseId: s.warehouseId,
          warehouseName: s.warehouse.name,
          totalUnits: s.totalUnits,
          reservedUnits: s.reservedUnits,
          availableUnits: s.totalUnits - s.reservedUnits,
        })),
      }))
    );
  } catch (err) {
    console.error("products fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}
