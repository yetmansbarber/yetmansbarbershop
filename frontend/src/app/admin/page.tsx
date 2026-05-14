"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PendingModal from "@/components/PendingModal";

interface Stats {
  totalRevenue: number;
  totalCount: number;
  pendingCount: number;
  periodStart: string | null;
  periodEnd: string | null;
  allTime?: boolean;
}

export default function AdminPage() {
  const supabase = createClient();
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [pendingModalOpen, setPendingModalOpen] = useState(false);
  const [allTime, setAllTime] = useState(false);

  // Auth kontrolü
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push("/login");
      else setUser(user);
    });
  }, []);

  const fetchStats = useCallback(async (isAllTime = false) => {
    setStatsLoading(true);
    try {
      const url = `/api/admin/stats?t=${Date.now()}${isAllTime ? '&allTime=true' : ''}`;
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      } else {
        const errBody = await res.json().catch(() => ({}));
        console.error('[Stats API Error]', res.status, errBody);
      }
    } catch (e) {
      console.error('[Stats Fetch Error]', e);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Stats: allTime değişince yeniden çek
  useEffect(() => {
    fetchStats(allTime);
  }, [fetchStats, allTime]);

  const handleStatusChanged = useCallback(
    (_id: number, _status: "confirmed" | "rejected") => {
      fetchStats(allTime);
    },
    [fetchStats, allTime]
  );

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const formatPeriod = (start: string, end: string) => {
    if (!start || !end) return "";
    const [sy, sm, sd] = start.split("-").map(Number);
    const [ey, em, ed] = end.split("-").map(Number);
    const s = new Date(sy, sm - 1, sd).toLocaleDateString("tr-TR", { day: "numeric", month: "long" });
    const e = new Date(ey, em - 1, ed).toLocaleDateString("tr-TR", { day: "numeric", month: "long" });
    return `${s} – ${e}`;
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-yellow-500/50 border-t-yellow-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 text-white">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-gray-800 pb-6">
        <div className="mb-4 md:mb-0">
          <h1 className="text-3xl font-bold uppercase tracking-widest text-yellow-500">
            Yönetici Paneli
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            İşletme istatistikleri ve genel yönetim ekranı.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{user.email}</span>
          <button
            onClick={handleLogout}
            className="text-xs uppercase tracking-widest px-4 py-2 border border-red-500/50 text-red-500 hover:bg-red-500 hover:text-white rounded-sm transition-colors"
          >
            Çıkış Yap
          </button>
        </div>
      </div>

      {/* İstatistikler */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
        <h2 className="text-xl font-bold text-white uppercase tracking-wider">
          İstatistikler
          {stats && !allTime && stats.periodStart && (
            <span className="text-xs font-normal text-gray-500 ml-3 lowercase tracking-normal">
              ({formatPeriod(stats.periodStart, stats.periodEnd!)})
            </span>
          )}
          {allTime && (
            <span className="text-xs font-normal text-green-600 ml-3 lowercase tracking-normal">
              (tüm zamanlar)
            </span>
          )}
        </h2>
        {/* Dönem Toggle */}
        <div className="flex bg-[#111] border border-gray-800 rounded-sm overflow-hidden text-xs font-bold uppercase tracking-wider">
          <button
            onClick={() => setAllTime(false)}
            className={`px-4 py-2 transition-colors ${
              !allTime ? 'bg-yellow-500 text-black' : 'text-gray-500 hover:text-white'
            }`}
          >
            Bu Ay
          </button>
          <button
            onClick={() => setAllTime(true)}
            className={`px-4 py-2 transition-colors ${
              allTime ? 'bg-yellow-500 text-black' : 'text-gray-500 hover:text-white'
            }`}
          >
            Tüm Zamanlar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        {/* Toplam Kazanç */}
        <div className="bg-[#0f0f0f] border border-yellow-500/30 p-6 rounded-sm shadow relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-16 h-16 bg-yellow-500/10 rounded-full group-hover:scale-150 transition-transform duration-500" />
          <p className="text-gray-400 text-sm uppercase tracking-wider mb-2">Toplam Kazanç</p>
          {statsLoading ? (
            <div className="h-9 w-28 bg-gray-800 rounded animate-pulse" />
          ) : (
            <h3 className="text-3xl font-bold text-yellow-500">
              ₺{stats?.totalRevenue.toLocaleString("tr-TR") ?? "0"}
            </h3>
          )}
          <p className="text-xs text-gray-500 mt-2">
            Onaylı randevular ({allTime ? 'tüm zamanlar' : 'bu ay, bugün dahil'})
          </p>
        </div>

        {/* Toplam Randevu */}
        <div className="bg-[#0f0f0f] border border-gray-800 p-6 rounded-sm shadow relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-16 h-16 bg-blue-500/10 rounded-full group-hover:scale-150 transition-transform duration-500" />
          <p className="text-gray-400 text-sm uppercase tracking-wider mb-2">Toplam Randevu</p>
          {statsLoading ? (
            <div className="h-9 w-16 bg-gray-800 rounded animate-pulse" />
          ) : (
            <h3 className="text-3xl font-bold text-white">{stats?.totalCount ?? 0}</h3>
          )}
          <p className="text-xs text-gray-500 mt-2">
            Onaylı ({allTime ? 'tüm zamanlar' : 'bu ay, bugün dahil'})
          </p>
        </div>

        {/* Bekleyen İstekler — Tıklanabilir */}
        <button
          onClick={() => setPendingModalOpen(true)}
          className="bg-[#0f0f0f] border border-yellow-600/40 p-6 rounded-sm shadow relative overflow-hidden group text-left hover:border-yellow-500/70 transition-colors cursor-pointer"
        >
          <div className="absolute -right-4 -top-4 w-16 h-16 bg-yellow-500/10 rounded-full group-hover:scale-150 transition-transform duration-500" />
          <p className="text-gray-400 text-sm uppercase tracking-wider mb-2">Bekleyen İstekler</p>
          {statsLoading ? (
            <div className="h-9 w-12 bg-gray-800 rounded animate-pulse" />
          ) : (
            <h3 className="text-3xl font-bold text-yellow-400">
              {stats?.pendingCount ?? 0}
            </h3>
          )}
          <p className="text-xs text-yellow-600/70 mt-2 group-hover:text-yellow-500 transition-colors">
            Onaylamak için tıklayın →
          </p>
          {/* Pulsing badge */}
          {(stats?.pendingCount ?? 0) > 0 && (
            <span className="absolute top-4 right-4 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500" />
            </span>
          )}
        </button>
      </div>

      {/* Hızlı İşlemler */}
      <h2 className="text-xl font-bold text-white mb-6 uppercase tracking-wider">
        Hızlı İşlemler
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link
          href="/panel"
          className="block p-6 bg-[#0a0a0a] border border-gray-800 hover:border-yellow-500/50 rounded-sm transition-all group"
        >
          <h3 className="text-lg font-bold text-white mb-2 group-hover:text-yellow-500 transition-colors">
            ✂️ Berber Paneli
          </h3>
          <p className="text-sm text-gray-500">
            Müşteri randevularını onaylamak, reddetmek ve yönetmek için berber paneline geçiş yapın.
          </p>
        </Link>

        <Link
          href="/admin/personel"
          className="block p-6 bg-[#0a0a0a] border border-gray-800 hover:border-yellow-500/50 rounded-sm transition-all group"
        >
          <h3 className="text-lg font-bold text-white mb-2 group-hover:text-yellow-500 transition-colors">
            👥 Personel Yönetimi
          </h3>
          <p className="text-sm text-gray-500">
            Çırak ve berber hesapları oluşturun, personel listesini yönetin.
          </p>
        </Link>

        <Link
          href="/admin/mesai"
          className="block p-6 bg-[#0a0a0a] border border-gray-800 hover:border-yellow-500/50 rounded-sm transition-all group"
        >
          <h3 className="text-lg font-bold text-white mb-2 group-hover:text-yellow-500 transition-colors">
            🗓️ Mesai & Takvim
          </h3>
          <p className="text-sm text-gray-500">
            Belirli günler için çalışma saatlerini özelleştirin, tatil günleri ekleyin.
          </p>
        </Link>
      </div>

      {/* Bekleyen İstekler Modal */}
      <PendingModal
        isOpen={pendingModalOpen}
        onClose={() => setPendingModalOpen(false)}
        onStatusChanged={handleStatusChanged}
      />
    </div>
  );
}
