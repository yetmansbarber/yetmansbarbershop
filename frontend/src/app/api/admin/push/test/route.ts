import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { sendPushToAdmins } from '@/utils/webPush';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const supabaseServer = await createClient();
    const { data: { user } } = await supabaseServer.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
    }

    const result = await sendPushToAdmins({
      title: '💈 Yetman\'s Barbershop',
      body: 'Harika! Test bildirimi başarıyla ulaştı. Yeni randevular bu şekilde telefonunuza gelecek.',
      url: '/admin',
    });

    return NextResponse.json({
      success: true,
      message: 'Test bildirimi gönderildi',
      sent: result.sent,
      total: result.count,
    });
  } catch (err: any) {
    console.error('Test bildirim hatası:', err);
    return NextResponse.json({ error: err.message || 'Sunucu hatası' }, { status: 500 });
  }
}
