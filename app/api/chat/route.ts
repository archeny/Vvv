// by Stenly
import { NextRequest, NextResponse } from 'next/server';
import { pool, syncDb } from '@/lib/db';
import { DeepSeekThinkingStream, uuid } from '@/lib/notegpt';

export async function POST(req: NextRequest) {
  try {
    await syncDb(); // Ensure DB schemas are fully ready

    const body = await req.json();
    const { deviceId, chatId, prompt, history = [] } = body;

    if (!deviceId) return NextResponse.json({ error: 'Missing deviceId' }, { status: 400 });
    if (!prompt) return NextResponse.json({ error: 'Missing prompt' }, { status: 400 });
    
    // Validate DB user
    let finalChatId = chatId;
    let userId: string;

    const [users]: any = await pool.execute('SELECT id FROM users WHERE device_id = ?', [deviceId]);
    if (users.length === 0) {
      userId = uuid();
      await pool.execute('INSERT INTO users (id, device_id) VALUES (?, ?)', [userId, deviceId]);
    } else {
      userId = users[0].id;
    }

    if (!finalChatId) {
      finalChatId = uuid();
      const title = prompt.slice(0, 50);
      await pool.execute('INSERT INTO chats (id, user_id, title) VALUES (?, ?, ?)', [finalChatId, userId, title]);
    }

    const userMessageId = uuid();
    await pool.execute('INSERT INTO messages (id, chat_id, role, content) VALUES (?, ?, ?, ?)', [
      userMessageId, finalChatId, 'user', prompt
    ]);

    const formattedHistory = history.map((item: any) => ({
      user: item.role === 'user' ? item.content : '',
      assistant: item.role === 'assistant' ? item.content : ''
    })).filter((_: any, i: number) => i % 2 !== 0).map((a: any, i: number) => ({
       user: history[i*2] ? history[i*2].content : '',
       assistant: a.assistant
    }));
    
    // Fallback format if needed
    const finalHistory = formattedHistory.length > 0 ? formattedHistory : history.reduce((acc: any[], { role, content }: any) => {
      if (role === 'user') {
        acc.push({ user: content, assistant: '' });
      } else if (acc.length > 0) {
        acc[acc.length - 1].assistant = content;
      }
      return acc;
    }, []);

    const conversationId = uuid();
    const stream = await DeepSeekThinkingStream(prompt, finalHistory, conversationId, async (answer, reasoning) => {
        if (answer || reasoning) {
          const assistantMessageId = uuid();
          await pool.execute(
            'INSERT INTO messages (id, chat_id, role, content, reasoning) VALUES (?, ?, ?, ?, ?)',
            [assistantMessageId, finalChatId, 'assistant', answer, reasoning]
          ).catch((err) => console.error("Final insert error:", err));
        }
    });

    const encoder = new TextEncoder();
    const finalStream = stream.pipeThrough(new TransformStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chatId: finalChatId })}\n\n`));
      }
    }));

    return new Response(finalStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: any) {
    console.error("Route Catch:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
