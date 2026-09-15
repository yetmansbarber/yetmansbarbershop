"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface GalleryItem {
  id: number;
  title: string | null;
  image_url: string;
  created_at: string;
}

const isVideoUrl = (url: string) => {
  if (!url) return false;
  const cleanUrl = url.split('?')[0].toLowerCase();
  return cleanUrl.endsWith('.mp4') || cleanUrl.endsWith('.webm') || cleanUrl.endsWith('.mov') || cleanUrl.endsWith('.ogg');
};

export default function AdminGaleriPage() {
  const supabase = createClient();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Form State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Auth kontrolü
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push("/login");
    });
  }, []);

  const fetchGallery = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/gallery", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch (err) {
      console.error("Galeri çekme hatası:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGallery();
  }, [fetchGallery]);

  // Dosya seçilince önizleme oluştur
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      setMsg({ type: "error", text: "Seçilen dosya 50MB sınırından büyük olamaz." });
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setMsg(null);
  };

  const resetForm = () => {
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setTitle("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setMsg({ type: "error", text: "Lütfen yüklenecek bir fotoğraf veya video seçin." });
      return;
    }

    setUploading(true);
    setMsg(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      if (title.trim()) formData.append("title", title.trim());

      const res = await fetch("/api/admin/gallery", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setMsg({ type: "success", text: "Medya başarıyla yüklendi!" });
        resetForm();
        fetchGallery();
      } else {
        setMsg({ type: "error", text: data.error || "Yükleme başarısız oldu." });
      }
    } catch (err) {
      setMsg({ type: "error", text: "Bağlantı hatası oluştu." });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number, itemTitle: string | null) => {
    const confirmDelete = confirm(
      `Bu ${itemTitle ? `"${itemTitle}" başlıklı` : ""} medyayı silmek istediğinizden emin misiniz?`
    );
    if (!confirmDelete) return;

    try {
      const res = await fetch(`/api/admin/gallery?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setItems((prev) => prev.filter((item) => item.id !== id));
      } else {
        const d = await res.json();
        alert(d.error || "Silinirken bir hata oluştu.");
      }
    } catch (err) {
      alert("Silme işlemi sırasında sunucu hatası oluştu.");
    }
  };

  const isSelectedFileVideo = selectedFile?.type.startsWith("video/") || false;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-gray-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white uppercase tracking-wider">
            🖼️ Galeri Yönetimi
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Müşterilerin gördüğü saç kesim fotoğraflarını ve tanıtım videolarını yönetin.
          </p>
        </div>
        <Link
          href="/admin"
          className="mt-4 md:mt-0 text-sm px-4 py-2 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 rounded-sm transition-colors"
        >
          ← Yönetici Paneli
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sol Kolon: Yükleme Formu */}
        <div className="lg:col-span-1">
          <div className="bg-[#0a0a0a] border border-gray-800 rounded-sm p-6 sticky top-6">
            <h2 className="text-sm font-bold text-yellow-500 uppercase tracking-widest mb-4">
              Yeni Fotoğraf / Video Yükle
            </h2>

            <form onSubmit={handleUpload} className="space-y-4">
              {/* Dosya Seçici */}
              <div>
                <label className="block text-xs uppercase tracking-wide text-gray-400 mb-2">
                  Dosya Seç (Fotoğraf veya Video)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/mp4,video/webm,video/mov"
                  onChange={handleFileChange}
                  className="w-full text-xs text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-sm file:border-0 file:text-xs file:font-semibold file:bg-yellow-500 file:text-black hover:file:bg-yellow-400 file:cursor-pointer bg-[#111] p-2 rounded-sm border border-gray-700 focus:outline-none"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  JPG, PNG, WEBP veya MP4 video (Maks. 50 MB)
                </p>
              </div>

              {/* Canlı Önizleme */}
              {previewUrl && (
                <div className="relative rounded-sm overflow-hidden border border-yellow-500/40 bg-black max-h-56 flex items-center justify-center">
                  {isSelectedFileVideo ? (
                    <video
                      src={previewUrl}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="w-full h-auto max-h-56 object-contain"
                    />
                  ) : (
                    <img
                      src={previewUrl}
                      alt="Önizleme"
                      className="w-full h-auto max-h-56 object-cover"
                    />
                  )}
                  <button
                    type="button"
                    onClick={resetForm}
                    className="absolute top-2 right-2 bg-red-600/80 hover:bg-red-600 text-white rounded-full p-1 text-xs transition-colors"
                    title="Vazgeç"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Başlık / Açıklama */}
              <div>
                <label className="block text-xs uppercase tracking-wide text-gray-400 mb-2">
                  Başlık (Opsiyonel)
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Örn: Amerikan Tıraşı, Klasik Sakal"
                  className="w-full bg-[#111] border border-gray-700 text-white p-3 rounded-sm focus:border-yellow-500 focus:outline-none text-sm"
                />
              </div>

              {/* Durum Mesajı */}
              {msg && (
                <div
                  className={`text-xs p-3 rounded-sm border ${
                    msg.type === "success"
                      ? "bg-green-950/30 border-green-500/40 text-green-400"
                      : "bg-red-950/30 border-red-500/40 text-red-400"
                  }`}
                >
                  {msg.type === "success" ? "✓ " : "⚠ "}
                  {msg.text}
                </div>
              )}

              <button
                type="submit"
                disabled={uploading || !selectedFile}
                className="w-full py-3 bg-yellow-500 text-black font-bold uppercase tracking-widest text-xs hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-sm transition-colors flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    Yükleniyor...
                  </>
                ) : (
                  "Galeriye Yükle"
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Sağ Kolon: Mevcut Galeri Listesi */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest">
              Yayındaki Medyalar ({items.length})
            </h2>
            <Link
              href="/galeri"
              target="_blank"
              className="text-xs text-yellow-500 hover:underline inline-flex items-center gap-1"
            >
              Müşteri Galerisini Gör ↗
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-48 bg-gray-900 rounded-sm animate-pulse" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="border border-gray-800 rounded-sm p-12 text-center text-gray-500 text-sm bg-[#0a0a0a]">
              Galeride henüz fotoğraf veya video bulunmuyor. Soldaki formu kullanarak ilk medyanızı ekleyebilirsiniz.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {items.map((item) => {
                const isVideo = isVideoUrl(item.image_url);

                return (
                  <div
                    key={item.id}
                    className="bg-[#0a0a0a] border border-gray-800 rounded-sm overflow-hidden group hover:border-yellow-500/40 transition-all flex flex-col justify-between"
                  >
                    {/* Medya Önizleme Alanı */}
                    <div className="relative h-48 bg-black overflow-hidden flex items-center justify-center">
                      {isVideo ? (
                        <video
                          src={item.image_url}
                          autoPlay
                          loop
                          muted
                          playsInline
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <img
                          src={item.image_url}
                          alt={item.title || "Galeri"}
                          className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                        />
                      )}

                      {/* Tür Rozeti */}
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-black/70 text-yellow-400 border border-yellow-500/30">
                        {isVideo ? "🎬 Video" : "📷 Fotoğraf"}
                      </span>

                      {/* Silme Butonu */}
                      <button
                        onClick={() => handleDelete(item.id, item.title)}
                        className="absolute top-2 right-2 bg-red-600/80 hover:bg-red-600 text-white p-2 rounded-sm text-xs transition-colors flex items-center gap-1 shadow-lg cursor-pointer"
                        title="Galeriden Sil"
                      >
                        🗑️ Sil
                      </button>
                    </div>

                    {/* Bilgi Barı */}
                    <div className="p-3 border-t border-gray-800 bg-[#0f0f0f]">
                      <p className="text-white text-sm font-semibold truncate">
                        {item.title || "Başlıksız Medya"}
                      </p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {new Date(item.created_at).toLocaleDateString("tr-TR", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    </div>
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
