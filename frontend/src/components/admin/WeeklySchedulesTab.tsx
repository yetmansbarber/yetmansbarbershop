"use client";
import { useState, useEffect, useCallback } from "react";

interface WeeklySlot {
  id: number;
  day_of_week: number;
  slot_time: string;
}

const DAYS = [
  { id: 1, name: "Pazartesi" },
  { id: 2, name: "Salı" },
  { id: 3, name: "Çarşamba" },
  { id: 4, name: "Perşembe" },
  { id: 5, name: "Cuma" },
  { id: 6, name: "Cumartesi" },
  { id: 0, name: "Pazar" }, // Pazar 0
];

const ALL_SLOTS = [
  "10:00", "10:30", "11:00", "11:30", "12:00", "12:30",
  "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
  "16:00", "16:30", "17:00", "17:30", "18:00", "18:30",
  "19:00", "19:30", "20:00", "20:30"
];

export default function WeeklySchedulesTab() {
  const [closedSlots, setClosedSlots] = useState<WeeklySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [processingSlot, setProcessingSlot] = useState<string | null>(null);

  const fetchSlots = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/weekly-schedules");
      if (res.ok) setClosedSlots(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  const toggleSlot = async (time: string, isCurrentlyClosed: boolean) => {
    setProcessingSlot(time);
    try {
      if (isCurrentlyClosed) {
        // Aç (Sil)
        await fetch(`/api/admin/weekly-schedules?day_of_week=${selectedDay}&slot_time=${time}`, {
          method: "DELETE",
        });
        await fetchSlots();
      } else {
        // Kapat (Ekle)
        // 1. Çakışma kontrolü
        const checkRes = await fetch(`/api/admin/check-weekly-conflicts?day_of_week=${selectedDay}&slot_time=${time}`);
        if (checkRes.ok) {
          const checkData = await checkRes.json();
          if (checkData.conflict_count > 0) {
            const confirmMsg = `DİKKAT! Gelecek haftalarda bu güne ve saate denk gelen ${checkData.conflict_count} adet randevu var:\n\n` +
              checkData.conflicts.map((c: any) => `- ${c.date} ${c.time.substring(0, 5)}: ${c.name}`).join("\n") +
              `\n\nEğer bu saati kalıcı kapatırsanız, bu müşterileri arayıp randevuyu manuel iptal etmeniz gerekir. Yine de kapatmak istiyor musunuz?`;
              
            if (!window.confirm(confirmMsg)) {
              setProcessingSlot(null);
              return;
            }
          }
        }

        // 2. Ekle
        await fetch("/api/admin/weekly-schedules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ day_of_week: selectedDay, slot_time: time }),
        });
        await fetchSlots();
      }
    } finally {
      setProcessingSlot(null);
    }
  };

  const currentDaySlots = closedSlots.filter(s => s.day_of_week === selectedDay).map(s => s.slot_time.substring(0, 5));

  return (
    <div className="bg-[#0a0a0a] border border-gray-800 rounded-sm p-6">
      <div className="mb-6">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">
          Haftanın Günü
        </h2>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((day) => (
            <button
              key={day.id}
              onClick={() => setSelectedDay(day.id)}
              className={`px-4 py-2 text-sm rounded-sm transition-colors ${
                selectedDay === day.id
                  ? "bg-yellow-500 text-black font-bold"
                  : "bg-[#111] text-gray-400 border border-gray-700 hover:border-gray-500"
              }`}
            >
              {day.name}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-blue-950/20 border border-blue-500/20 rounded-sm p-4 mb-6 text-sm text-blue-300">
        <p>
          Seçilen gün için saatlerin üzerine tıklayarak kalıcı olarak açabilir veya kapatabilirsiniz. 
          Kırmızı olanlar kapalıdır ve müşteriler o saatleri seçemez.
        </p>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {ALL_SLOTS.map((time) => {
          const isClosed = currentDaySlots.includes(time);
          const isProcessing = processingSlot === time;

          return (
            <button
              key={time}
              disabled={isProcessing || loading}
              onClick={() => toggleSlot(time, isClosed)}
              className={`py-3 flex flex-col items-center justify-center rounded-sm transition-all border ${
                isClosed
                  ? "bg-red-900/20 border-red-500/50 text-red-400 hover:bg-red-900/40"
                  : "bg-green-900/20 border-green-500/50 text-green-400 hover:bg-green-900/40"
              } ${isProcessing ? "opacity-50 cursor-wait" : ""}`}
            >
              <span className="font-bold text-lg">{time}</span>
              <span className="text-[10px] uppercase tracking-widest mt-1">
                {isProcessing ? "..." : (isClosed ? "Kapalı" : "Açık")}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
