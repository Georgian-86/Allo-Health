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

function stockLabel(n: number) {
  if (n === 0) return { label: "Out of stock", cls: "bg-slate-100 text-slate-500" };
  if (n <= 5)  return { label: `${n} left`,     cls: "bg-red-50 text-red-700" };
  if (n <= 20) return { label: `${n} units`,    cls: "bg-amber-50 text-amber-700" };
  return               { label: `${n} units`,   cls: "bg-emerald-50 text-emerald-700" };
}

function ProductCard({ product }: { product: Product }) {
  const totalAvailable = product.stock.reduce((s, w) => s + w.availableUnits, 0);
  const canReserve = totalAvailable > 0;

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col">
      <div className="p-5 flex-1">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="font-semibold text-slate-900 leading-snug">{product.name}</h2>
            <p className="text-xs text-slate-400 font-mono mt-0.5">{product.sku}</p>
          </div>
          {!canReserve && (
            <span className="shrink-0 text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">
              Sold out
            </span>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Warehouse stock</p>
          {product.stock.map((s) => {
            const badge = stockLabel(s.availableUnits);
            return (
              <div key={s.warehouseId} className="flex items-center justify-between text-sm">
                <span className="text-slate-600">{s.warehouseName}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.cls}`}>
                  {badge.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="px-5 pb-5">
        {canReserve ? (
          <Link
            href={`/checkout?productId=${product.id}`}
            className="block w-full text-center bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
          >
            Reserve
          </Link>
        ) : (
          <button
            disabled
            className="block w-full text-center bg-slate-100 text-slate-400 text-sm font-medium py-2.5 rounded-lg cursor-not-allowed"
          >
            Unavailable
          </button>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/products")
      .then((r) => {
        if (!r.ok) throw new Error("fetch failed");
        return r.json();
      })
      .then(setProducts)
      .catch(() => setError("Couldn't load products. Is the database connected?"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400 text-sm">
        Loading inventory…
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-8">
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">Products</h1>
        <p className="text-slate-500 text-sm mt-1">
          {products.length} {products.length === 1 ? "product" : "products"} · live stock across all warehouses
        </p>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm">
          No products found. Run <code className="font-mono bg-slate-100 px-1 rounded">npm run prisma:seed</code> to add inventory.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {products.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </div>
  );
}
