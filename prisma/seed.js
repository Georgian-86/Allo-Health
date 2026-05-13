const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  await prisma.reservation.deleteMany({});
  await prisma.stockLevel.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.warehouse.deleteMany({});

  const [delhi, mumbai, bengaluru] = await Promise.all([
    prisma.warehouse.create({ data: { name: "Delhi FC", location: "New Delhi" } }),
    prisma.warehouse.create({ data: { name: "Mumbai FC", location: "Andheri East" } }),
    prisma.warehouse.create({ data: { name: "Bengaluru FC", location: "Electronic City" } }),
  ]);

  const [testo, ashwa, sleep, omega, stack] = await Promise.all([
    prisma.product.create({ data: { name: "Testosterone Support – 60 caps", sku: "AH-TESTO-60" } }),
    prisma.product.create({ data: { name: "KSM-66 Ashwagandha – 500mg", sku: "AH-KSM-90" } }),
    prisma.product.create({ data: { name: "Sleep & Recovery Formula", sku: "AH-SLEEP-30" } }),
    prisma.product.create({ data: { name: "Omega-3 Fish Oil – 90 softgels", sku: "AH-OMEGA-90" } }),
    prisma.product.create({ data: { name: "Daily Wellness Stack", sku: "AH-STACK-30" } }),
  ]);

  await prisma.stockLevel.createMany({
    data: [
      { productId: testo.id, warehouseId: delhi.id,     totalUnits: 120 },
      { productId: testo.id, warehouseId: mumbai.id,    totalUnits: 4  },
      { productId: testo.id, warehouseId: bengaluru.id, totalUnits: 58 },

      { productId: ashwa.id, warehouseId: delhi.id,     totalUnits: 200 },
      { productId: ashwa.id, warehouseId: mumbai.id,    totalUnits: 85  },
      { productId: ashwa.id, warehouseId: bengaluru.id, totalUnits: 0   },

      { productId: sleep.id, warehouseId: delhi.id,     totalUnits: 3  },
      { productId: sleep.id, warehouseId: mumbai.id,    totalUnits: 40 },
      { productId: sleep.id, warehouseId: bengaluru.id, totalUnits: 22 },

      { productId: omega.id, warehouseId: delhi.id,     totalUnits: 150 },
      { productId: omega.id, warehouseId: mumbai.id,    totalUnits: 98  },
      { productId: omega.id, warehouseId: bengaluru.id, totalUnits: 12  },

      { productId: stack.id, warehouseId: delhi.id,     totalUnits: 0  },
      { productId: stack.id, warehouseId: mumbai.id,    totalUnits: 2  },
      { productId: stack.id, warehouseId: bengaluru.id, totalUnits: 35 },
    ],
  });

  console.log("seeded 5 products across 3 warehouses");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
