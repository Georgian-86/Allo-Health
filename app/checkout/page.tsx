"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

interface StockInfo {
  warehouseId: string;
  warehouseName: string;
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
  warehouseId: string;
  quantity: number;
  status: string;
  expiresAt: string;
}

function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

function Banner({ type, children }: { type: "error" | "warn"; children: React.ReactNode }) {
  const cls =
    type === "error"
      ? "bg-red-50 border-red-200 text-red-700"
      : "bg-amber-50 border-amber-200 text-amber-700";
  return (
    <div className={`border text-sm px-4 py-3 rounded-lg ${cls}`}>{children}</div>
  );
}

function CheckoutInner() {
  const searchParams = useSearchParams();
  const productId = searchParams.get("productId");

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<"error" | "warn">("error");
  const [done, setDone] = useState(false);
  const idempotencyKey = useRef(crypto.randomUUID());

  useEffect(() => {
    if (!productId) { setLoading(false); return; }

    fetch("/api/products")
      .then((r) => r.json())
      .then((data: Product[]) => {
        const found = data.find((p) => p.id === productId);
        if (found) {
          setProduct(found);
          const first = found.stock.find((s) => s.availableUnits > 0);
          setSelectedWarehouse(first?.warehouseId ?? found.stock[0]?.warehouseId ?? "");
        }
      })
      .catch(() => setError("Couldn't load product."))
      .finally(() => setLoading(false));
  }, [productId]);

  useEffect(() => {
    if (!reservation) return;
    const tick = setInterval(() => {
      const remaining = Math.max(0, new Date(reservation.expiresAt).getTime() - Date.now());
      setTimeLeft(remaining);
      if (remaining === 0) setReservation(null);
    }, 500);
    return () => clearInterval(tick);
  }, [reservation]);

  const handleReserve = async () => {
    if (!product || !selectedWarehouse) return;
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/reservations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey.current,
      },
      body: JSON.stringify({ productId: product.id, warehouseId: selectedWarehouse, quantity }),
    });

    setSubmitting(false);

    if (res.status === 409) {
      setErrorType("error");
      setError("Not enough stock at this warehouse. Try a different location or lower the quantity.");
      return;
    }
    if (!res.ok) {
      setErrorType("error");
      setError("Something went wrong. Please try again.");
      return;
    }

    const data = await res.json();
    setReservation(data);
    setTimeLeft(new Date(data.expiresAt).getTime() - Date.now());
    idempotencyKey.current = crypto.randomUUID(); // reset for next
  };

  const handleConfirm = async () => {
    if (!reservation) return;
    setSubmitting(true);
    setError(null);

    const res = await fetch(`/api/reservations/${reservation.id}/confirm`, { method: "POST" });

    setSubmitting(false);

    if (res.status === 410) {
      setErrorType("warn");
      setError("Your reservation expired before we could confirm. Please start over.");
      setReservation(null);
      return;
    }
    if (!res.ok) {
      setErrorType("error");
      setError("Confirmation failed. Please try again.");
      return;
    }

    setDone(true);
    setReservation(null);
  };

  const handleCancel = async () => {
    if (!reservation) return;
    setSubmitting(true);
    setError(null);

    await fetch(`/api/reservations/${reservation.id}/release`, { method: "POST" });

    setSubmitting(false);
    setReservation(null);
  };

  if (loading) {
    return <div className="py-24 text-center text-slate-400 text-sm">Loading…</div>;
  }

  if (done) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-slate-900 mb-1">Order confirmed</h2>
        <p className="text-slate-500 text-sm mb-6">Your reservation has been confirmed and stock updated.</p>
        <Link
          href="/"
          className="inline-block bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
        >
          Back to products
        </Link>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-md mx-auto py-8">
        <Banner type="error">{error ?? "Product not found."}</Banner>
        <Link href="/" className="mt-4 inline-block text-sm text-teal-600 hover:underline">← Back to products</Link>
      </div>
    );
  }

  const selectedStock = product.stock.find((s) => s.warehouseId === selectedWarehouse);
  const timerRed = timeLeft < 60_000;
  const timerAmber = timeLeft < 3 * 60_000;

  return (
    <div className="max-w-lg mx-auto">
      <Link href="/" className="text-sm text-slate-500 hover:text-slate-700 inline-flex items-center gap-1 mb-6">
        <span>←</span> Products
      </Link>

      <h1 className="text-2xl font-semibold text-slate-900 mb-1">{product.name}</h1>
      <p className="text-xs text-slate-400 font-mono mb-6">{product.sku}</p>

      {error && <div className="mb-4"><Banner type={errorType}>{error}</Banner></div>}

      {reservation ? (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-6">
          {/* countdown */}
          <div className="text-center">
            <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-1">Time remaining</p>
            <p
              className={`text-5xl font-bold tabular-nums transition-colors ${
                timerRed ? "text-red-600" : timerAmber ? "text-amber-500" : "text-teal-600"
              }`}
            >
              {fmt(timeLeft)}
            </p>
            <p className="text-xs text-slate-400 mt-1">Complete your purchase before this expires</p>
          </div>

          {/* summary */}
          <div className="bg-slate-50 rounded-lg p-4 text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Warehouse</span>
              <span className="font-medium text-slate-800">
                {product.stock.find((s) => s.warehouseId === reservation.warehouseId)?.warehouseName}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Quantity</span>
              <span className="font-medium text-slate-800">{reservation.quantity}</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleConfirm}
              disabled={submitting}
              className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
            >
              {submitting ? "Processing…" : "Confirm purchase"}
            </button>
            <button
              onClick={handleCancel}
              disabled={submitting}
              className="flex-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-medium py-2.5 rounded-lg transition-colors text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Warehouse</label>
            <select
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              {product.stock.map((s) => (
                <option key={s.warehouseId} value={s.warehouseId} disabled={s.availableUnits === 0}>
                  {s.warehouseName} · {s.availableUnits > 0 ? `${s.availableUnits} available` : "out of stock"}
                </option>
              ))}
            </select>
            {selectedStock && selectedStock.availableUnits <= 5 && selectedStock.availableUnits > 0 && (
              <p className="text-xs text-amber-600 mt-1">Only {selectedStock.availableUnits} left at this warehouse.</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Quantity</label>
            <select
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              {Array.from({ length: Math.min(10, selectedStock?.availableUnits ?? 10) }, (_, i) => i + 1).map((q) => (
                <option key={q} value={q}>{q}</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleReserve}
            disabled={submitting || !selectedWarehouse || (selectedStock?.availableUnits ?? 0) === 0}
            className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
          >
            {submitting ? "Reserving…" : "Reserve – 10 min hold"}
          </button>
          <p className="text-xs text-slate-400 text-center -mt-2">
            Stock is held for 10 minutes while you complete checkout.
          </p>
        </div>
      )}
    </div>
  );
}

export default function Checkout() {
  return (
    <Suspense fallback={<div className="py-24 text-center text-slate-400 text-sm">Loading…</div>}>
      <CheckoutInner />
    </Suspense>
  );
}
