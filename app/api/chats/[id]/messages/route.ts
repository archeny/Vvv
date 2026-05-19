// by Stenly
import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  
  if (!id) return NextResponse.json({ error: 'Missing chat id' }, { status: 400 });

  try {
    const [messages]: any = await pool.execute(
      'SELECT id, role, content, reasoning, created_at FROM messages WHERE chat_id = ? ORDER BY created_at ASC',
      [id]
    );

    return NextResponse.json({ messages });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
