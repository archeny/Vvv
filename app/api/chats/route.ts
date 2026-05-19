// by Stenly
import { NextRequest, NextResponse } from 'next/server';
import { pool, syncDb } from '@/lib/db';
import crypto from 'node:crypto';

export async function GET(req: NextRequest) {
  const deviceId = req.nextUrl.searchParams.get('deviceId');
  if (!deviceId) return NextResponse.json({ error: 'Missing deviceId' }, { status: 400 });

  try {
    await syncDb();
    const [users]: any = await pool.execute('SELECT id FROM users WHERE device_id = ?', [deviceId]);
    if (users.length === 0) {
      return NextResponse.json({ chats: [] });
    }

    const userId = users[0].id;
    const [chats]: any = await pool.execute('SELECT * FROM chats WHERE user_id = ? ORDER BY updated_at DESC', [userId]);

    return NextResponse.json({ chats });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
