"use client";
import { useState, useEffect, useCallback } from "react";

interface PendingAppointment {
  id: number;
  first_name: string;
  last_name: string;
  phone: string;
  date: string;
  time: string;
  service?: { name: string; price: number };
  staff?: { name: string };
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onStatusChanged: (id: number, newStatus: "confirmed" | "rejected") => void;
}

export default function PendingModal({ isOpen, onClose, onStatusChanged }: Props) {
  const [items, setItems] = useState<PendingAppointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState<number | null>(null);

  const fetchPending = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/pending", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } finally {
      setLoading(false);
    }
  }, [isOpen]);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  // ESC tuşu ile kapat
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Body scroll kilitle
  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const handleAction = async (id: number, status: "confirmed" | "rejected") => {
    setProcessing(id);
    try {
      const res = await fetch("/api/admin/pending", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });

      if (res.ok) {
        const data = await res.json();
        // State'den kaldır (anlık güncelleme)
        setItems((prev) => prev.filter((a) => a.id !== id));
        // Üst componente bildir (panel takvimi güncellensin)
        onStatusChanged(id, status);
        // WhatsApp'ı tetikle
        if (data.whatsapp_trigger) {
          window.open(data.whatsapp_trigger, "_blank");
        }
      } else {
        const err = await res.json();
        alert("Hata: " + (err.error || "Bilinmeyen hata"));
      }
    } finally {
      setProcessing(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("tr-TR", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col bg-[#0a0a0a] border border-yellow-500/30 rounded-sm shadow-2xl shadow-yellow-500/5 z-10">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-white uppercase tracking-widest">
              ⏳ Bekleyen İstekler
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {items.length} adet onay bekleyen randevu
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-white hover:bg-gray-800 rounded-sm transition-colors"
          >
            ✕
          </button>
        </div>

        {/* İçerik */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-yellow-500/50 border-t-yellow-500 rounded-full animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-4xl mb-3">✅</div>
              <p className="text-gray-400 font-medium">Tüm randevular işlendi!</p>
              <p className="text-gray-600 text-sm mt-1">Bekleyen istek bulunmuyor.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800/80">
              {items.map((appt) => (
                <div
                  key={appt.id}
                  className="px-6 py-4 hover:bg-gray-900/40 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {/* Sol: Bilgiler */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="font-bold text-white capitalize text-base">
                          {appt.first_name} {appt.last_name}
                        </span>
                        <span className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 text-[10px] px-2 py-0.5 uppercase font-bold tracking-wider rounded-full">
                          Bekliyor
                        </span>
                      </div>
                      <div className="text-sm text-gray-400 space-y-0.5">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="flex items-center gap-1">
                            📅 {formatDate(appt.date)}
                          </span>
                          <span className="flex items-center gap-1">
                            🕐 {appt.time.substring(0, 5)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap mt-1">
                          {appt.service && (
                            <span className="flex items-center gap-1">
                              ✂️ {appt.service.name}
                              {appt.service.price && (
                                <span className="text-yellow-600 font-medium ml-1">
                                  ₺{appt.service.price}
                                </span>
                              )}
                            </span>
                          )}
                          {appt.staff && (
                            <span className="flex items-center gap-1 text-gray-500">
                              👤 {appt.staff.name}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          <span>📞</span>
                          <a
                            href={`tel:${appt.phone}`}
                            className="hover:text-white transition-colors"
                          >
                            {appt.phone}
                          </a>
                        </div>
                      </div>
                    </div>

                    {/* Sağ: Butonlar */}
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleAction(appt.id, "confirmed")}
                        disabled={processing === appt.id}
                        className="px-4 py-2 bg-green-600/10 text-green-400 border border-green-600/60 hover:bg-green-600 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all uppercase font-bold text-[11px] tracking-wider rounded-sm flex items-center gap-1.5 min-w-[80px] justify-center"
                      >
                        {processing === appt.id ? (
                          <span className="w-3 h-3 border border-white/50 border-t-white rounded-full animate-spin" />
                        ) : (
                          "✓ Onayla"
                        )}
                      </button>
                      <button
                        onClick={() => handleAction(appt.id, "rejected")}
                        disabled={processing === appt.id}
                        className="px-4 py-2 bg-red-600/10 text-red-400 border border-red-600/60 hover:bg-red-600 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all uppercase font-bold text-[11px] tracking-wider rounded-sm flex items-center gap-1.5 min-w-[80px] justify-center"
                      >
                        {processing === appt.id ? (
                          <span className="w-3 h-3 border border-white/50 border-t-white rounded-full animate-spin" />
                        ) : (
                          "✕ Reddet"
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-800 flex justify-between items-center">
          <span className="text-xs text-gray-600">
            Onay/Red sonrası WhatsApp otomatik açılır
          </span>
          <button
            onClick={onClose}
            className="text-sm text-gray-400 hover:text-white transition-colors uppercase tracking-wider"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}
