"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface StockInfo {
  warehouseId: string;
  warehouseName: string;
  totalUnits: number;
  reservedUnits: number;
  availableUnits: number;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  stock: StockInfo[];
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch("/api/products");
        if (!res.ok) throw new Error("Failed to fetch products");
        const data = await res.json();
        setProducts(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  if (loading) {
    return (
      <main className="max-w-6xl mx-auto py-8 px-4">
        <h1 className="text-3xl font-bold mb-8">Products</h1>
        <p className="text-gray-600">Loading products...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="max-w-6xl mx-auto py-8 px-4">
        <h1 className="text-3xl font-bold mb-8">Products</h1>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          Error: {error}
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">Products</h1>
      
      {products.length === 0 ? (
        <p className="text-gray-600">No products available.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <div key={product.id} className="border rounded-lg shadow-md overflow-hidden">
              <div className="bg-white p-6">
                <h2 className="text-xl font-semibold mb-2">{product.name}</h2>
                <p className="text-sm text-gray-500 mb-4">SKU: {product.sku}</p>

                <div className="mb-6">
                  <h3 className="font-semibold text-sm mb-3">Stock by Warehouse</h3>
                  <div className="space-y-3">
                    {product.stock.map((stock) => (
                      <div
                        key={stock.warehouseId}
                        className="text-sm bg-gray-50 p-3 rounded"
                      >
                        <p className="font-medium">{stock.warehouseName}</p>
                        <p className="text-gray-600">
                          Available: <span className="font-semibold">{stock.availableUnits}</span> / {stock.totalUnits}
                        </p>
                        <p className="text-xs text-gray-500">
                          {stock.reservedUnits > 0 && `${stock.reservedUnits} reserved`}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <Link
                  href={`/checkout?productId=${product.id}`}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition text-center block"
                >
                  Reserve
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
