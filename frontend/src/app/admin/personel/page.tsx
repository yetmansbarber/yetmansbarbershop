"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface StaffMember {
  id: number;
  name: string;
  role: "master" | "apprentice" | "barber";
  is_active: boolean;
  auth_user_id: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  master: "Ana Berber",
  apprentice: "Çırak",
  barber: "Berber",
};

const ROLE_COLORS: Record<string, string> = {
  master: "text-yellow-400 border-yellow-500/50 bg-yellow-500/10",
  apprentice: "text-blue-400 border-blue-500/50 bg-blue-500/10",
  barber: "text-green-400 border-green-500/50 bg-green-500/10",
};

export default function PersonelPage() {
  const supabase = createClient();
  const router = useRouter();

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<"master" | "apprentice" | "barber">("barber");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [createLogin, setCreateLogin] = useState(true); // Varsayılan: giriş hesabı oluştur
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push("/login");
    });
  }, []);

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/staff", { cache: "no-store" });
      if (res.ok) setStaff(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) { setError("İsim boş bırakılamaz."); return; }
    if (createLogin && !newEmail.trim()) { setError("Giriş hesabı için e-posta zorunludur."); return; }
    if (createLogin && newPassword.length < 6) { setError("Şifre en az 6 karakter olmalıdır."); return; }

    setError("");
    setSuccessMsg("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          role: newRole,
          ...(createLogin ? { email: newEmail.trim(), password: newPassword } : {}),
        }),
      });

      if (res.ok) {
        setSuccessMsg(
          createLogin
            ? `✅ ${newName} sisteme eklendi. Giriş bilgileri: ${newEmail} / şifre belirlendi.`
            : `✅ ${newName} sisteme eklendi (giriş hesabı yok).`
        );
        setNewName("");
        setNewEmail("");
        setNewPassword("");
        setNewRole("barber");
        setCreateLogin(true);
        fetchStaff();
      } else {
        const d = await res.json();
        setError(d.error || "Bir hata oluştu.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (id: number, name: string) => {
    if (
      !confirm(
        `"${name}" adlı personeli sistemden çıkarmak istediğinize emin misiniz?\n\n` +
        `• Mevcut randevuları etkilenmez\n` +
        `• Giriş hesabı varsa devre dışı bırakılır\n` +
        `• Randevu listesinden kaybolur`
      )
    ) return;

    const res = await fetch(`/api/staff?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      setSuccessMsg(`${name} sistemden çıkarıldı.`);
      fetchStaff();
    } else {
      const d = await res.json();
      setError(d.error || "Silme işlemi başarısız.");
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-gray-800 pb-4">
        <div className="mb-4 md:mb-0">
          <h1 className="text-2xl font-bold text-white uppercase tracking-wider">
            👥 Personel Yönetimi
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Berber ve çırak hesaplarını buradan yönetin.
          </p>
        </div>
        <Link
          href="/admin"
          className="text-sm px-4 py-2 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 rounded-sm transition-colors"
        >
          ← Yönetici Paneli
        </Link>
      </div>

      {/* Nasıl Çalışır Bilgi Kutusu */}
      <div className="bg-blue-950/20 border border-blue-500/20 rounded-sm p-4 mb-8 text-sm text-blue-300 space-y-1">
        <p className="font-bold text-blue-400 uppercase tracking-wider mb-2">Giriş Sistemi Nasıl Çalışır?</p>
        <p>1. Personel için e-posta + şifre belirliyorsunuz</p>
        <p>2. Personel <strong className="text-white">/login</strong> sayfasından bu bilgilerle giriş yapıyor</p>
        <p>3. Sistem rolünü otomatik tanıyıp <strong className="text-white">/panel</strong> sayfasına yönlendiriyor</p>
        <p>4. Çırak yalnızca <strong className="text-white">kendi randevularını</strong> görüyor</p>
      </div>

      {/* Mevcut Personel */}
      <div className="mb-10">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">
          Aktif Personel
        </h2>
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 bg-gray-900 rounded-sm animate-pulse" />
            ))}
          </div>
        ) : staff.length === 0 ? (
          <div className="border border-gray-800 rounded-sm p-8 text-center text-gray-500">
            Henüz personel eklenmemiş.
          </div>
        ) : (
          <div className="border border-gray-800 rounded-sm overflow-hidden">
            {staff.map((member, idx) => (
              <div
                key={member.id}
                className={`flex items-center justify-between px-6 py-4 hover:bg-gray-900/50 transition-colors ${
                  idx < staff.length - 1 ? "border-b border-gray-800/60" : ""
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-xl font-bold text-gray-300 uppercase">
                    {member.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-white text-base">{member.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className={`text-[10px] px-2 py-0.5 border rounded-full uppercase font-bold tracking-wider ${
                          ROLE_COLORS[member.role] ?? "text-gray-400 border-gray-600"
                        }`}
                      >
                        {ROLE_LABELS[member.role] ?? member.role}
                      </span>
                      {/* Giriş durumu */}
                      {member.auth_user_id ? (
                        <span className="text-[10px] px-2 py-0.5 border border-green-500/30 bg-green-500/10 text-green-400 rounded-full uppercase font-bold tracking-wider">
                          🔑 Girişi Var
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 border border-gray-700 text-gray-600 rounded-full uppercase tracking-wider">
                          Giriş Yok
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {member.id !== 1 ? (
                  <button
                    onClick={() => handleDeactivate(member.id, member.name)}
                    className="text-xs px-3 py-1.5 border border-red-500/40 text-red-500 hover:bg-red-600 hover:text-white hover:border-red-600 rounded-sm transition-colors uppercase font-bold tracking-wider"
                  >
                    Çıkar
                  </button>
                ) : (
                  <span className="text-xs text-gray-600 uppercase tracking-wider">Varsayılan</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Yeni Personel Ekle */}
      <div>
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">
          Yeni Personel Ekle
        </h2>
        <form
          onSubmit={handleAdd}
          className="bg-[#0a0a0a] border border-gray-800 rounded-sm p-6 space-y-5"
        >
          {/* İsim + Unvan */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-400 mb-2 text-xs uppercase tracking-wide">
                Ad Soyad
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Örn: Ahmet Yılmaz"
                className="w-full bg-[#111] border border-gray-700 text-white p-3 rounded-sm focus:border-yellow-500 focus:outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-gray-400 mb-2 text-xs uppercase tracking-wide">
                Unvan
              </label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as any)}
                className="w-full bg-[#111] border border-gray-700 text-white p-3 rounded-sm focus:border-yellow-500 focus:outline-none text-sm"
              >
                <option value="barber">Berber</option>
                <option value="master">Ana Berber</option>
                <option value="apprentice">Çırak</option>
              </select>
            </div>
          </div>

          {/* Giriş Hesabı Toggle */}
          <div className="border border-gray-700 rounded-sm overflow-hidden">
            <div
              className="flex items-center justify-between p-4 bg-[#111] cursor-pointer"
              onClick={() => setCreateLogin(!createLogin)}
            >
              <div>
                <p className="text-white font-medium text-sm">Panel Girişi Oluştur</p>
                <p className="text-gray-500 text-xs mt-0.5">
                  Personel /login sayfasından kendi hesabıyla giriş yapabilsin
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setCreateLogin(!createLogin); }}
                aria-pressed={createLogin}
                className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none overflow-hidden flex-shrink-0 ${
                  createLogin ? "bg-yellow-500" : "bg-gray-700"
                }`}
              >
                <span
                  className={`absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
                    createLogin ? "translate-x-7" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* Email + Şifre alanları */}
            {createLogin && (
              <div className="p-4 border-t border-gray-800 space-y-3 bg-[#0d0d0d]">
                <p className="text-xs text-yellow-600 mb-3">
                  ⚡ Bu bilgileri personele bildirmeyi unutmayın — sistem şifreyi size göstermez.
                </p>
                <div>
                  <label className="block text-gray-400 mb-1.5 text-xs uppercase tracking-wide">
                    E-Posta Adresi
                  </label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="cirak@yetmans.com"
                    className="w-full bg-[#111] border border-gray-700 text-white p-3 rounded-sm focus:border-yellow-500 focus:outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 mb-1.5 text-xs uppercase tracking-wide">
                    Şifre (en az 6 karakter)
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-[#111] border border-gray-700 text-white p-3 pr-12 rounded-sm focus:border-yellow-500 focus:outline-none text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors text-xs uppercase"
                    >
                      {showPassword ? "Gizle" : "Göster"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Mesajlar */}
          {error && (
            <p className="text-red-400 text-sm bg-red-900/20 border border-red-500/30 rounded-sm px-4 py-2">
              ⚠️ {error}
            </p>
          )}
          {successMsg && (
            <p className="text-green-400 text-sm bg-green-900/20 border border-green-500/30 rounded-sm px-4 py-2">
              {successMsg}
            </p>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-yellow-500 text-black font-bold uppercase tracking-widest text-sm hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-sm transition-colors"
            >
              {submitting ? "Ekleniyor..." : "+ Personel Ekle"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
