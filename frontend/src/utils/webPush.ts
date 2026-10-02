import webpush from 'web-push';
import { supabaseAdmin as supabase } from '@/utils/supabase-admin';

const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@yetmansbarbershop.com.tr';
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BH68QWxcqgZ7dAL81TxjLJjWi8SPgogrc6Xg9FA8QU7MRiUxjGOPAN60NCGDeGCajAkKt0B9VNZGMURxvDr8be4';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'BmuSuARwo_uPLkEk5m9ermR8PAQKx6o1q5UsUvisF6o';

try {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} catch (err) {
  console.error('VAPID ayarlanırken hata oluştu:', err);
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

export async function sendPushToAdmins(payload: PushPayload) {
  try {
    const { data: subs, error } = await supabase
      .from('admin_push_subscriptions')
      .select('id, endpoint, p256dh, auth');

    if (error || !subs || subs.length === 0) {
      return { count: 0, sent: 0 };
    }

    const jsonPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url || '/admin',
    });

    let sent = 0;

    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
              },
            },
            jsonPayload
          );
          sent++;
        } catch (pushErr: any) {
          // Eğer cihaz aboneliği iptal etmişse (404 veya 410), veritabanından temizle
          if (pushErr.statusCode === 404 || pushErr.statusCode === 410) {
            await supabase.from('admin_push_subscriptions').delete().eq('id', sub.id);
          } else {
            console.error('Push bildirim gönderme hatası:', pushErr.message || pushErr);
          }
        }
      })
    );

    return { count: subs.length, sent };
  } catch (err) {
    console.error('sendPushToAdmins genel hata:', err);
    return { count: 0, sent: 0, error: err };
  }
}
