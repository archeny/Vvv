// by Stenly
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { pool, syncDb } from '@/lib/db';

const BASE = 'https://notegpt.io';

function uuid() {
  return crypto.randomUUID();
}

function randomNumber(length = 10) {
  let result = '';
  for (let i = 0; i < length; i++) result += Math.floor(Math.random() * 10);
  return result;
}

function makeSboxGuid() {
  const now = Math.floor(Date.now() / 1000);
  const raw = `${now}|762|${randomNumber(9)}`;
  return Buffer.from(raw).toString('base64');
}

function makeCookieHeader() {
  const now = Math.floor(Date.now() / 1000);
  const anonymousUserId = uuid();

  return [
    `_ga_PFX3BRW5RQ=GS2.1.s${now}$o1$g0$t${now}$j60$l0$h${randomNumber(9)}`,
    `_ga=GA1.2.${randomNumber(9)}.${now}`,
    `_gid=GA1.2.${randomNumber(9)}.${now}`,
    `_gat_gtag_UA_252982427_14=1`,
    `sbox-guid=${encodeURIComponent(makeSboxGuid())}`,
    `anonymous_user_id=${anonymousUserId}`,
  ].join('; ');
}

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

    const ua = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36";
    const conversationId = uuid();
    const cookieHeader = makeCookieHeader();

    const formattedHistory = history.map((item: any) => ({
      role: item.role,
      content: item.content
    })).slice(-5);

    const payload = {
      message: prompt,
      language: "auto",
      model: "deepseek-v4-flash",
      tone: "default",
      length: "long",
      conversation_id: conversationId,
      image_urls: [],
      history_messages: formattedHistory,
      chat_mode: "deep_think",
    };

    const encoder = new TextEncoder();

    // Removed Accept-Encoding so fetch handles decompression automatically
    const res = await fetch(`${BASE}/api/v2/chat/stream`, {
      method: "POST",
      headers: {
        "sec-ch-ua-platform": `"Android"`,
        "User-Agent": ua,
        "sec-ch-ua": `"Google Chrome";v="147", "Not.A/Brand";v="8", "Chromium";v="147"`,
        "Content-Type": "application/json",
        "sec-ch-ua-mobile": "?1",
        Accept: "*/*",
        Origin: BASE,
        "sec-fetch-site": "same-origin",
        "sec-fetch-mode": "cors",
        "sec-fetch-dest": "empty",
        Referer: `${BASE}/chat-deepseek`,
        Cookie: cookieHeader,
        priority: "u=1, i",
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json({ error: `Notegpt returned ${res.status}: ${errorText}` }, { status: 500 });
    }

    if (!res.body) {
      return NextResponse.json({ error: "No response body from notegpt" }, { status: 500 });
    }

    const externalReader = res.body.getReader();

    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chatId: finalChatId })}\n\n`));

        const decoder = new TextDecoder();
        let answer = '';
        let reasoning = '';
        let stringBuffer = '';

        try {
          while (true) {
            const { value, done } = await externalReader.read();
            if (done) break;

            const text = decoder.decode(value, { stream: true });
            controller.enqueue(encoder.encode(text)); // send raw text chunk to frontend instantly

            stringBuffer += text;
            const lines = stringBuffer.split(/\r?\n/);
            stringBuffer = lines.pop() || '';

            for (const line of lines) {
              const clean = line.trim();
              if (clean.startsWith('data:')) {
                const raw = clean.replace(/^data:\s*/, '').trim();
                if (raw === '[DONE]') continue;
                try {
                  const json = JSON.parse(raw);
                  if (json.reasoning) reasoning += json.reasoning;
                  if (json.text) answer += json.text;
                } catch (e) {}
              }
            }
          }

          if (stringBuffer) {
             const clean = stringBuffer.trim();
             if (clean.startsWith('data:')) {
               const raw = clean.replace(/^data:\s*/, '').trim();
               if (raw !== '[DONE]') {
                   try {
                     const json = JSON.parse(raw);
                     if (json.reasoning) reasoning += json.reasoning;
                     if (json.text) answer += json.text;
                   } catch(e) {}
               }
             }
          }

          if (answer || reasoning) {
            const assistantMessageId = uuid();
            await pool.execute(
              'INSERT INTO messages (id, chat_id, role, content, reasoning) VALUES (?, ?, ?, ?, ?)',
              [assistantMessageId, finalChatId, 'assistant', answer, reasoning]
            ).catch((err) => console.error("Final insert error:", err));
          }

          controller.close();
        } catch (err) {
          console.error("Stream bridging error:", err);
          controller.error(err);
        }
      }
    });

    return new Response(stream, {
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
