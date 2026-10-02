"use client";

import { useState, useEffect } from "react";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "BH68QWxcqgZ7dAL81TxjLJjWi8SPgogrc6Xg9FA8QU7MRiUxjGOPAN60NCGDeGCajAkKt0B9VNZGMURxvDr8be4";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function PushNotificationManager() {
  const [isSupported, setIsSupported] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      setIsSupported(supported);

      const ua = window.navigator.userAgent;
      const iOSDevice = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      setIsIOS(iOSDevice);

      const standaloneMode =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true;
      setIsStandalone(standaloneMode);

      if ("Notification" in window) {
        setPermission(Notification.permission);
      }

      // Mevcut abonelik kontrolü
      if (supported && "serviceWorker" in navigator) {
        navigator.serviceWorker.ready
          .then((reg) => reg.pushManager.getSubscription())
          .then((sub) => {
            setIsSubscribed(!!sub);
          })
          .catch(() => {});
      }
    }
  }, []);

  const subscribeUser = async () => {
    setLoading(true);
    setMsg(null);

    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        throw new Error("Tarayıcınız bildirim özelliğini desteklemiyor.");
      }

      // Service Worker kaydı
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      // İzin iste
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== "granted") {
        setMsg({
          type: "error",
          text: "Bildirim izni verilmedi. Ayarlardan bildirimlere izin vermelisiniz.",
        });
        setLoading(false);
        return;
      }

      // Push aboneliği oluştur
      const convertedKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey,
      });

      // Sunucuya kaydet
      const res = await fetch("/api/admin/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: sub.toJSON(),
          userAgent: window.navigator.userAgent,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Abonelik sunucuya kaydedilemedi.");
      }

      setIsSubscribed(true);
      setMsg({
        type: "success",
        text: "Bildirimler başarıyla açıldı! Yeni randevular telefonunuza gelecek.",
      });
    } catch (err: any) {
      console.error("Abonelik hatası:", err);
      setMsg({ type: "error", text: err.message || "Bildirim açılırken bir hata oluştu." });
    } finally {
      setLoading(false);
    }
  };

  const unsubscribeUser = async () => {
    setLoading(true);
    setMsg(null);

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();

      if (sub) {
        await sub.unsubscribe();
        await fetch("/api/admin/push", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
      }

      setIsSubscribed(false);
      setMsg({ type: "info", text: "Bu cihazda bildirimler kapatıldı." });
    } catch (err: any) {
      setMsg({ type: "error", text: "Bildirim kapatılırken hata oluştu." });
    } finally {
      setLoading(false);
    }
  };

  const sendTestNotification = async () => {
    setTesting(true);
    setMsg(null);

    try {
      const res = await fetch("/api/admin/push/test", { method: "POST" });
      const data = await res.json();

      if (res.ok) {
        setMsg({
          type: "success",
          text: `Test bildirimi gönderildi (${data.sent} cihaza ulaştı)! Telefon kilit ekranınızı kontrol edin.`,
        });
      } else {
        setMsg({ type: "error", text: data.error || "Test bildirimi gönderilemedi." });
      }
    } catch {
      setMsg({ type: "error", text: "Sunucu hatası oluştu." });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="bg-[#0f0f0f] border border-gray-800 rounded-sm p-5 mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg">🔔</span>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Randevu Kilit Ekranı Bildirimleri
            </h3>
            {isSubscribed ? (
              <span className="px-2 py-0.5 text-[10px] font-bold bg-green-950/60 border border-green-500/40 text-green-400 rounded-sm uppercase tracking-wider">
                Aktif
              </span>
            ) : (
              <span className="px-2 py-0.5 text-[10px] font-bold bg-yellow-950/60 border border-yellow-500/40 text-yellow-400 rounded-sm uppercase tracking-wider">
                Kapalı
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Biri randevu aldığında telefonunuz kilitliyken bile anında bildirim alın.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isSubscribed ? (
            <>
              <button
                type="button"
                onClick={sendTestNotification}
                disabled={testing}
                className="text-xs px-3 py-2 bg-yellow-500 text-black font-bold uppercase tracking-wider rounded-sm hover:bg-yellow-400 transition-colors disabled:opacity-50"
              >
                {testing ? "Gönderiliyor..." : "Test Bildirimi Gönder"}
              </button>
              <button
                type="button"
                onClick={unsubscribeUser}
                disabled={loading}
                className="text-xs px-3 py-2 border border-gray-700 text-gray-400 hover:text-red-400 hover:border-red-500/50 rounded-sm transition-colors"
              >
                Bildirimleri Kapat
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={subscribeUser}
              disabled={loading}
              className="text-xs px-4 py-2.5 bg-yellow-500 text-black font-bold uppercase tracking-wider rounded-sm hover:bg-yellow-400 transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-lg shadow-yellow-500/10"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  İzin İsteniyor...
                </>
              ) : (
                "Bu Cihazda Bildirimleri Aç"
              )}
            </button>
          )}
        </div>
      </div>

      {/* iPhone Safari Uyarısı (Ana Ekrana Ekleme Rehberi) */}
      {isIOS && !isStandalone && !isSubscribed && (
        <div className="mt-4 p-3 bg-blue-950/30 border border-blue-500/30 rounded-sm text-xs text-blue-300">
          <p className="font-bold text-blue-400 mb-1 flex items-center gap-1">
            <span>📱</span> iPhone İçin Önemli Adım:
          </p>
          <p className="text-gray-300">
            Apple kuralları gereği kilit ekranı bildirimi alabilmek için bu sayfayı önce ana ekranınıza eklemelisiniz:
          </p>
          <ol className="list-decimal list-inside mt-1.5 space-y-1 text-gray-400">
            <li>Safari&apos;nin altındaki <strong className="text-white">Paylaş</strong> (kare içinden yukarı ok çıkan) butonuna basın.</li>
            <li>Listeden <strong className="text-white">&apos;Ana Ekrana Ekle&apos;</strong> seçeneğine dokunun.</li>
            <li>Ana ekranınıza gelen Yetman&apos;s uygulamasına tıklayıp bu butona oradan basın.</li>
          </ol>
        </div>
      )}

      {/* Durum Bildirim Mesajı */}
      {msg && (
        <div
          className={`mt-3 text-xs p-2.5 rounded-sm border ${
            msg.type === "success"
              ? "bg-green-950/40 border-green-500/40 text-green-300"
              : msg.type === "error"
              ? "bg-red-950/40 border-red-500/40 text-red-300"
              : "bg-gray-900 border-gray-700 text-gray-300"
          }`}
        >
          {msg.type === "success" ? "✓ " : msg.type === "error" ? "⚠ " : "ℹ "}
          {msg.text}
        </div>
      )}
    </div>
  );
}
