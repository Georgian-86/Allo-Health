const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  // Clear existing data
  await prisma.reservation.deleteMany({});
  await prisma.stockLevel.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.warehouse.deleteMany({});

  // Create warehouses
  const warehouse1 = await prisma.warehouse.create({
    data: {
      name: "Warehouse East",
      location: "New York",
    },
  });

  const warehouse2 = await prisma.warehouse.create({
    data: {
      name: "Warehouse West",
      location: "Los Angeles",
    },
  });

  // Create products
  const product1 = await prisma.product.create({
    data: {
      name: "Wireless Headphones",
      sku: "WHP-001",
    },
  });

  const product2 = await prisma.product.create({
    data: {
      name: "USB-C Cable",
      sku: "USB-001",
    },
  });

  const product3 = await prisma.product.create({
    data: {
      name: "Phone Case",
      sku: "CASE-001",
    },
  });

  // Create stock levels
  await prisma.stockLevel.create({
    data: {
      productId: product1.id,
      warehouseId: warehouse1.id,
      totalUnits: 50,
    },
  });

  await prisma.stockLevel.create({
    data: {
      productId: product1.id,
      warehouseId: warehouse2.id,
      totalUnits: 30,
    },
  });

  await prisma.stockLevel.create({
    data: {
      productId: product2.id,
      warehouseId: warehouse1.id,
      totalUnits: 200,
    },
  });

  await prisma.stockLevel.create({
    data: {
      productId: product2.id,
      warehouseId: warehouse2.id,
      totalUnits: 150,
    },
  });

  await prisma.stockLevel.create({
    data: {
      productId: product3.id,
      warehouseId: warehouse1.id,
      totalUnits: 100,
    },
  });

  await prisma.stockLevel.create({
    data: {
      productId: product3.id,
      warehouseId: warehouse2.id,
      totalUnits: 80,
    },
  });

  console.log("Seed completed");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
