"use client";

import { useEffect, useState, useSearchParams } from "react";
import { useRouter } from "next/navigation";
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

interface Reservation {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  status: string;
  expiresAt: string;
}

export default function Checkout() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const productId = searchParams.get("productId");
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Fetch product on mount
  useEffect(() => {
    if (!productId) {
      setError("No product selected");
      setLoading(false);
      return;
    }

    const fetchProduct = async () => {
      try {
        const res = await fetch("/api/products");
        if (!res.ok) throw new Error("Failed to fetch products");
        const data = await res.json();
        const found = data.find((p: Product) => p.id === productId);
        if (!found) throw new Error("Product not found");
        setProduct(found);
        if (found.stock.length > 0) {
          setSelectedWarehouse(found.stock[0].warehouseId);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [productId]);

  // Countdown timer
  useEffect(() => {
    if (!reservation) return;

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const expires = new Date(reservation.expiresAt).getTime();
      const remaining = Math.max(0, expires - now);
      setTimeLeft(remaining);

      if (remaining === 0) {
        setReservation(null);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [reservation]);

  const handleReserve = async () => {
    if (!product || !selectedWarehouse) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          warehouseId: selectedWarehouse,
          quantity,
        }),
      });

      if (res.status === 409) {
        setError("Not enough stock available. Please try a different warehouse or quantity.");
        setSubmitting(false);
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create reservation");
      }

      const data = await res.json();
      setReservation(data);
      setTimeLeft(10 * 60 * 1000); // 10 minutes
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirm = async () => {
    if (!reservation) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/reservations/${reservation.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm" }),
      });

      if (res.status === 410) {
        setError("Reservation has expired. Please create a new one.");
        setReservation(null);
        setSubmitting(false);
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to confirm reservation");
      }

      setReservation(null);
      alert("Purchase confirmed!");
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!reservation) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/reservations/${reservation.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "release" }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to cancel reservation");
      }

      setReservation(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (ms: number) => {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / 1000 / 60) % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <main className="max-w-2xl mx-auto py-8 px-4">
        <h1 className="text-2xl font-bold mb-8">Checkout</h1>
        <p className="text-gray-600">Loading product...</p>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="max-w-2xl mx-auto py-8 px-4">
        <h1 className="text-2xl font-bold mb-8">Checkout</h1>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          Error: {error || "Product not found"}
        </div>
        <Link href="/" className="text-blue-600 hover:underline">
          Back to products
        </Link>
      </main>
    );
  }

  if (reservation) {
    return (
      <main className="max-w-2xl mx-auto py-8 px-4">
        <h1 className="text-2xl font-bold mb-8">Reservation Confirmed</h1>

        <div className="bg-white border rounded-lg p-6 mb-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-2">{product.name}</h2>
            <p className="text-gray-600 mb-4">SKU: {product.sku}</p>

            <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded">
              <div>
                <p className="text-sm text-gray-600">Warehouse</p>
                <p className="font-semibold">
                  {product.stock.find((s) => s.warehouseId === reservation.warehouseId)?.warehouseName}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Quantity</p>
                <p className="font-semibold">{reservation.quantity}</p>
              </div>
            </div>
          </div>

          <div className="mb-6 text-center">
            <p className="text-sm text-gray-600 mb-2">Time remaining</p>
            <p className="text-4xl font-bold text-blue-600">{formatTime(timeLeft)}</p>
            <p className="text-xs text-gray-500 mt-2">Complete your purchase before reservation expires</p>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
              {error}
            </div>
          )}

          <div className="flex gap-4">
            <button
              onClick={handleConfirm}
              disabled={submitting}
              className="flex-1 bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 disabled:bg-gray-400 transition"
            >
              {submitting ? "Processing..." : "Confirm Purchase"}
            </button>
            <button
              onClick={handleCancel}
              disabled={submitting}
              className="flex-1 bg-gray-400 text-white py-2 px-4 rounded hover:bg-gray-500 disabled:bg-gray-300 transition"
            >
              {submitting ? "Processing..." : "Cancel"}
            </button>
          </div>
        </div>

        <Link href="/" className="text-blue-600 hover:underline">
          Back to products
        </Link>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-8">Checkout</h1>

      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-6">{product.name}</h2>
        <p className="text-gray-600 mb-6">SKU: {product.sku}</p>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-semibold mb-2">Warehouse</label>
            <select
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              {product.stock.map((stock) => (
                <option key={stock.warehouseId} value={stock.warehouseId}>
                  {stock.warehouseName} ({stock.availableUnits} available)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Quantity</label>
            <select
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value))}
              className="w-full border rounded px-3 py-2"
            >
              {Array.from({ length: 10 }, (_, i) => i + 1).map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={handleReserve}
          disabled={submitting}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:bg-gray-400 transition font-semibold"
        >
          {submitting ? "Creating reservation..." : "Create Reservation"}
        </button>
      </div>

      <Link href="/" className="text-blue-600 hover:underline mt-6 block">
        Back to products
      </Link>
    </main>
  );
}
