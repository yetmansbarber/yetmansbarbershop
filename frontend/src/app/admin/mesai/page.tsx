"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface CustomSchedule {
  id: number;
  date: string;
  is_closed: boolean;
  start_time: string | null;
  end_time: string | null;
  note: string | null;
}

const getLocalISODate = (date: Date) => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().split("T")[0];
};

const todayStr = getLocalISODate(new Date());

const formatDateTR = (dateStr: string) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("tr-TR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

export default function MesaiPage() {
  const supabase = createClient();
  const router = useRouter();

  const [schedules, setSchedules] = useState<CustomSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [isClosed, setIsClosed] = useState(false);
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("20:30");
  const [note, setNote] = useState("");
  const [formMsg, setFormMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push("/login");
    });
  }, []);

  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/schedules", { cache: "no-store" });
      if (res.ok) setSchedules(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  // Seçili tarihe ait mevcut ayar varsa formu doldur
  useEffect(() => {
    const existing = schedules.find((s) => s.date === selectedDate);
    if (existing) {
      setIsClosed(existing.is_closed);
      setStartTime(existing.start_time?.substring(0, 5) ?? "10:00");
      setEndTime(existing.end_time?.substring(0, 5) ?? "20:30");
      setNote(existing.note ?? "");
    } else {
      setIsClosed(false);
      setStartTime("10:00");
      setEndTime("20:30");
      setNote("");
    }
  }, [selectedDate, schedules]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormMsg(null);

    const payload = {
      date: selectedDate,
      is_closed: isClosed,
      start_time: isClosed ? null : startTime,
      end_time: isClosed ? null : endTime,
      note: note.trim() || null,
    };

    try {
      const res = await fetch("/api/admin/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setFormMsg({ type: "success", text: `${formatDateTR(selectedDate)} için mesai ayarlandı.` });
        fetchSchedules();
      } else {
        const d = await res.json();
        setFormMsg({ type: "error", text: d.error || "Hata oluştu." });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (date: string) => {
    if (!confirm(`${formatDateTR(date)} için özel ayar silinsin mi? (Standart mesaiye döner)`)) return;
    await fetch(`/api/admin/schedules?date=${date}`, { method: "DELETE" });
    fetchSchedules();
  };

  // Gece mesaisi bilgisi
  const isNightShift = !isClosed && endTime < startTime;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-gray-800 pb-4">
        <div className="mb-4 md:mb-0">
          <h1 className="text-2xl font-bold text-white uppercase tracking-wider">
            🗓️ Mesai & Takvim Yönetimi
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Belirli günler için standart çalışma saatlerini özelleştirin.
          </p>
        </div>
        <Link
          href="/admin"
          className="text-sm px-4 py-2 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 rounded-sm transition-colors"
        >
          ← Yönetici Paneli
        </Link>
      </div>

      {/* Standart Mesai Bilgisi */}
      <div className="bg-blue-950/20 border border-blue-500/20 rounded-sm p-4 mb-8 text-sm text-blue-300">
        <p className="font-bold uppercase tracking-wider text-blue-400 mb-1">Standart Mesai</p>
        <p>Pazartesi – Cumartesi: <strong className="text-white">10:00 – 20:30</strong></p>
        <p>Pazar: <strong className="text-red-400">Kapalı</strong> (özelleştirme yapılabilir)</p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Özelleştirme Formu */}
        <div>
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">
            Gün Ayarla
          </h2>
          <form
            onSubmit={handleSave}
            className="bg-[#0a0a0a] border border-gray-800 rounded-sm p-6 space-y-5"
          >
            {/* Tarih */}
            <div>
              <label className="block text-gray-400 mb-2 text-xs uppercase tracking-wide">
                Tarih
              </label>
              <input
                type="date"
                value={selectedDate}
                min={todayStr}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full bg-[#111] border border-gray-700 text-white p-3 rounded-sm focus:border-yellow-500 focus:outline-none text-sm"
              />
              <p className="text-xs text-gray-600 mt-1 capitalize">{formatDateTR(selectedDate)}</p>
            </div>

            {/* Tatil Günü Toggle */}
            <div className="flex items-center justify-between p-3 border border-gray-700 rounded-sm bg-[#111]">
              <div>
                <p className="text-white font-medium text-sm">Tüm Gün Kapalı</p>
                <p className="text-gray-500 text-xs">Bu günü tamamen tatil ilan eder</p>
              </div>
              <button
                type="button"
                onClick={() => setIsClosed(!isClosed)}
                aria-pressed={isClosed}
                className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none overflow-hidden flex-shrink-0 ${
                  isClosed ? "bg-red-600" : "bg-gray-700"
                }`}
              >
                <span
                  className={`absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
                    isClosed ? "translate-x-7" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* Saat Seçimi (kapalı değilse) */}
            {!isClosed && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 mb-2 text-xs uppercase tracking-wide">
                    Başlangıç
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    step="1800"
                    className="w-full bg-[#111] border border-gray-700 text-white p-3 rounded-sm focus:border-yellow-500 focus:outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 mb-2 text-xs uppercase tracking-wide">
                    Bitiş (son randevu)
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    step="1800"
                    className="w-full bg-[#111] border border-gray-700 text-white p-3 rounded-sm focus:border-yellow-500 focus:outline-none text-sm"
                  />
                </div>
              </div>
            )}

            {/* Gece mesaisi uyarısı */}
            {isNightShift && (
              <div className="bg-purple-950/30 border border-purple-500/30 rounded-sm p-3 text-sm text-purple-300">
                🌙 <strong>Gece Mesaisi:</strong> Bitiş saati ({endTime}) başlangıçtan ({startTime}) küçük — sistem, bu mesainin gece yarısını geçtiğini otomatik algılar.
              </div>
            )}

            {/* Not */}
            <div>
              <label className="block text-gray-400 mb-2 text-xs uppercase tracking-wide">
                Not (Opsiyonel)
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Örn: Arife günü, Bayram öncesi uzatma"
                className="w-full bg-[#111] border border-gray-700 text-white p-3 rounded-sm focus:border-yellow-500 focus:outline-none text-sm"
              />
            </div>

            {/* Mesaj */}
            {formMsg && (
              <p
                className={`text-sm rounded-sm px-4 py-2 border ${
                  formMsg.type === "success"
                    ? "text-green-400 bg-green-900/20 border-green-500/30"
                    : "text-red-400 bg-red-900/20 border-red-500/30"
                }`}
              >
                {formMsg.type === "success" ? "✅ " : "⚠️ "}
                {formMsg.text}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-yellow-500 text-black font-bold uppercase tracking-widest text-sm hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-sm transition-colors"
            >
              {submitting ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </form>
        </div>

        {/* Mevcut Özel Günler */}
        <div>
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">
            Özel Günler ({schedules.length})
          </h2>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-gray-900 rounded-sm animate-pulse" />
              ))}
            </div>
          ) : schedules.length === 0 ? (
            <div className="border border-gray-800 rounded-sm p-8 text-center text-gray-500 text-sm">
              Henüz özel gün tanımlanmamış.
              <br />
              <span className="text-gray-600">Sistem standart mesaiye göre çalışıyor.</span>
            </div>
          ) : (
            <div className="border border-gray-800 rounded-sm overflow-hidden max-h-[500px] overflow-y-auto">
              {schedules
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((sch, idx) => {
                  const isPast = sch.date < todayStr;
                  return (
                    <div
                      key={sch.id}
                      className={`flex items-start justify-between px-4 py-3 hover:bg-gray-900/50 transition-colors ${
                        idx < schedules.length - 1 ? "border-b border-gray-800/60" : ""
                      } ${isPast ? "opacity-50" : ""}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-white text-sm capitalize">
                          {formatDateTR(sch.date)}
                          {isPast && (
                            <span className="ml-2 text-[10px] text-gray-600 uppercase">Geçmiş</span>
                          )}
                        </p>
                        {sch.is_closed ? (
                          <span className="text-xs text-red-400 font-bold">🔴 Kapalı (Tatil)</span>
                        ) : (
                          <span className="text-xs text-green-400">
                            🕐 {sch.start_time?.substring(0, 5) ?? "10:00"} –{" "}
                            {sch.end_time?.substring(0, 5) ?? "20:30"}
                            {sch.end_time && sch.start_time && sch.end_time < sch.start_time && (
                              <span className="text-purple-400 ml-1">(Gece Mesaisi)</span>
                            )}
                          </span>
                        )}
                        {sch.note && (
                          <p className="text-xs text-gray-600 mt-0.5 truncate">{sch.note}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDelete(sch.date)}
                        className="ml-3 text-xs px-2 py-1 border border-gray-700 text-gray-500 hover:text-red-400 hover:border-red-500/50 rounded-sm transition-colors flex-shrink-0"
                        title="Sil (Standarda dön)"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
