"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Service {
  id: number;
  name: string;
  price: number;
  duration_minutes: number;
}

const EMPTY_FORM = { name: "", price: "" };

export default function HizmetlerPage() {
  const supabase = createClient();
  const router = useRouter();

  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formMsg, setFormMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push("/login");
    });
  }, []);

  const fetchServices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/services", { cache: "no-store" });
      if (res.ok) setServices(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormMsg(null);
  };

  const handleEdit = (svc: Service) => {
    setEditingId(svc.id);
    setForm({ name: svc.name, price: String(svc.price) });
    setFormMsg(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormMsg(null);

    const payload = {
      ...(editingId ? { id: editingId } : {}),
      name: form.name.trim(),
      price: Number(form.price),
      duration_minutes: 30,
    };

    const method = editingId ? "PATCH" : "POST";
    try {
      const res = await fetch("/api/admin/services", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.ok) {
        setFormMsg({
          type: "success",
          text: editingId
            ? `"${data.name}" guncellendi.`
            : `"${data.name}" hizmeti eklendi.`,
        });
        resetForm();
        fetchServices();
      } else {
        setFormMsg({ type: "error", text: data.error || "Bir hata olustu." });
      }
    } catch {
      setFormMsg({ type: "error", text: "Sunucu hatasi." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (svc: Service) => {
    if (svc.price === 0) {
      // Zaten pasif, tekrar aktife al (fiyat sorulsun)
      const newPrice = prompt(
        `"${svc.name}" hizmetini yeniden aktive etmek icin fiyat girin (TL):`,
        ""
      );
      if (newPrice === null) return;
      const price = Number(newPrice);
      if (isNaN(price) || price <= 0) {
        alert("Gecerli bir fiyat girin.");
        return;
      }
      const res = await fetch("/api/admin/services", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: svc.id, name: svc.name, price }),
      });
      if (res.ok) fetchServices();
      return;
    }

    if (
      !confirm(
        `"${svc.name}" hizmetini pasife almak istiyor musunuz?\n\nHizmet ana sayfada gizlenir ancak mevcut randevular korunur.`
      )
    )
      return;

    const res = await fetch(`/api/admin/services?id=${svc.id}&mode=deactivate`, {
      method: "DELETE",
    });
    if (res.ok) fetchServices();
  };

  const handleDelete = async (svc: Service) => {
    const confirmed = confirm(
      `KALICI SILME UYARISI\n\n"${svc.name}" hizmetini kalici olarak silmek uzeresiniz.\n\n` +
        `ONEMLI: Bu islemi geri alamazsiniz. Bu hizmete bagli TUM RANDEVULAR (gecmis ve gelecek) da veritabanindan silinecektir.\n\n` +
        `Devam etmek istiyor musunuz?`
    );
    if (!confirmed) return;

    // Ikinci onay
    const double = confirm(
      `SON UYARI\n\n"${svc.name}" icin bagli randevular dahil her sey silinecek.\n\nKESINLIKLE DEVAM ETMEK ISTIYOR MUSUNUZ?`
    );
    if (!double) return;

    const res = await fetch(`/api/admin/services?id=${svc.id}&mode=delete`, {
      method: "DELETE",
    });
    if (res.ok) {
      fetchServices();
      if (editingId === svc.id) resetForm();
    }
  };

  const activeServices = services.filter((s) => s.price > 0);
  const passiveServices = services.filter((s) => s.price === 0);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-gray-800 pb-4">
        <div className="mb-4 md:mb-0">
          <h1 className="text-2xl font-bold text-white uppercase tracking-wider">
            ✂️ Hizmet Yönetimi
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Hizmet isimlerini ve fiyatlarini duzenleyin, yeni hizmet ekleyin veya kaldirim.
          </p>
        </div>
        <Link
          href="/admin"
          className="text-sm px-4 py-2 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 rounded-sm transition-colors"
        >
          ← Yönetici Paneli
        </Link>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Form */}
        <div>
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">
            {editingId ? "Hizmeti Düzenle" : "Yeni Hizmet Ekle"}
          </h2>

          <form
            onSubmit={handleSubmit}
            className="bg-[#0a0a0a] border border-gray-800 rounded-sm p-6 space-y-5"
          >
            {editingId && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-sm px-3 py-2 text-xs text-yellow-400">
                ✏️ Düzenleme modu — #{editingId}{" "}
                <button
                  type="button"
                  onClick={resetForm}
                  className="ml-2 underline hover:no-underline"
                >
                  İptal
                </button>
              </div>
            )}

            {/* İsim */}
            <div>
              <label className="block text-gray-400 mb-2 text-xs uppercase tracking-wide">
                Hizmet Adı
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Örn: Saç Kesimi + Yıkama"
                required
                className="w-full bg-[#111] border border-gray-700 text-white p-3 rounded-sm focus:border-yellow-500 focus:outline-none text-sm"
              />
            </div>

            {/* Fiyat */}
            <div>
              <label className="block text-gray-400 mb-2 text-xs uppercase tracking-wide">
                Fiyat (₺)
              </label>
              <input
                type="number"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                placeholder="Örn: 600"
                min="0"
                step="1"
                required
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
              {submitting
                ? "Kaydediliyor..."
                : editingId
                ? "Güncelle"
                : "Hizmet Ekle"}
            </button>
          </form>
        </div>

        {/* Liste */}
        <div>
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">
            Mevcut Hizmetler ({activeServices.length} aktif
            {passiveServices.length > 0 ? `, ${passiveServices.length} pasif` : ""})
          </h2>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-gray-900 rounded-sm animate-pulse" />
              ))}
            </div>
          ) : services.length === 0 ? (
            <div className="border border-gray-800 rounded-sm p-8 text-center text-gray-500 text-sm">
              Henüz hizmet tanımlanmamış.
            </div>
          ) : (
            <div className="border border-gray-800 rounded-sm overflow-hidden">
              {services.map((svc, idx) => {
                const isPassive = svc.price === 0;
                const isEditing = editingId === svc.id;
                return (
                  <div
                    key={svc.id}
                    className={`px-4 py-3 transition-colors ${
                      idx < services.length - 1 ? "border-b border-gray-800/60" : ""
                    } ${isPassive ? "opacity-50" : ""} ${
                      isEditing ? "bg-yellow-500/5 border-l-2 border-l-yellow-500" : "hover:bg-gray-900/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      {/* Bilgi */}
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-bold text-sm truncate">
                          {svc.name}
                          {isPassive && (
                            <span className="ml-2 text-[10px] uppercase text-red-400 border border-red-500/40 rounded px-1 py-0.5">
                              Pasif
                            </span>
                          )}
                        </p>
                        <p className="text-yellow-500 text-sm font-semibold mt-0.5">
                          {isPassive ? "—" : `₺${svc.price.toLocaleString("tr-TR")}`}
                        </p>
                      </div>

                      {/* Butonlar */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {/* Düzenle */}
                        <button
                          onClick={() => handleEdit(svc)}
                          title="Düzenle"
                          className="text-xs px-2 py-1 border border-gray-700 text-gray-400 hover:text-yellow-400 hover:border-yellow-500/50 rounded-sm transition-colors"
                        >
                          ✏️
                        </button>

                        {/* Pasife Al / Aktive Et */}
                        <button
                          onClick={() => handleDeactivate(svc)}
                          title={isPassive ? "Aktive Et" : "Pasife Al"}
                          className={`text-xs px-2 py-1 border rounded-sm transition-colors ${
                            isPassive
                              ? "border-green-700 text-green-500 hover:border-green-400"
                              : "border-gray-700 text-gray-400 hover:text-orange-400 hover:border-orange-500/50"
                          }`}
                        >
                          {isPassive ? "▶️" : "⏸️"}
                        </button>

                        {/* Kalıcı Sil */}
                        <button
                          onClick={() => handleDelete(svc)}
                          title="Kalıcı Sil"
                          className="text-xs px-2 py-1 border border-gray-700 text-gray-400 hover:text-red-400 hover:border-red-500/50 rounded-sm transition-colors"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Bilgi notu */}
          <div className="mt-4 bg-blue-950/20 border border-blue-500/20 rounded-sm p-3 text-xs text-blue-300 space-y-1">
            <p>
              <span className="text-blue-400 font-bold">⏸️ Pasife Al:</span>{" "}
              Hizmeti ana sayfadan gizler, randevular korunur.
            </p>
            <p>
              <span className="text-red-400 font-bold">🗑️ Kalıcı Sil:</span>{" "}
              Hizmet ve bağlı TÜM randevular silinir. Geri alınamaz.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
