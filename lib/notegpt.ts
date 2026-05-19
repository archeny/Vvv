import axios from "axios";
import crypto from "node:crypto";

const BASE = "https://notegpt.io";
const ua =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36";

export function uuid() {
  return crypto.randomUUID();
}

function randomNumber(length = 10) {
  let result = "";
  for (let i = 0; i < length; i++) result += Math.floor(Math.random() * 10);
  return result;
}

function makeSboxGuid() {
  const now = Math.floor(Date.now() / 1000);
  const raw = `${now}|762|${randomNumber(9)}`;
  return Buffer.from(raw).toString("base64");
}

export function makeCookieHeader() {
  const now = Math.floor(Date.now() / 1000);
  const anonymousUserId = uuid();

  return [
    `_ga_PFX3BRW5RQ=GS2.1.s${now}$o1$g0$t${now}$j60$l0$h${randomNumber(9)}`,
    `_ga=GA1.2.${randomNumber(9)}.${now}`,
    `_gid=GA1.2.${randomNumber(9)}.${now}`,
    `_gat_gtag_UA_252982427_14=1`,
    `sbox-guid=${encodeURIComponent(makeSboxGuid())}`,
    `anonymous_user_id=${anonymousUserId}`,
  ].join("; ");
}

export function toHistoryMessages(history: any[]) {
  return history.slice(-5).flatMap((item) => [
    {
      role: "user",
      content: item.user,
    },
    {
      role: "assistant",
      content: item.assistant,
    },
  ]);
}

export async function DeepSeekThinkingStream(prompt: string, history: any[] = [], conversation_id: string, onSave: (answer: string, reasoning: string) => void) {
  const cookieHeader = makeCookieHeader();

  const payload = {
    message: prompt,
    language: "auto",
    model: "deepseek-v4-flash",
    tone: "default",
    length: "moderate",
    conversation_id,
    image_urls: [],
    history_messages: toHistoryMessages(history),
    chat_mode: "deep_think",
  };

  const res = await axios.post(
    `${BASE}/api/v2/chat/stream`,
    JSON.stringify(payload),
    {
      timeout: 60000,
      responseType: "stream",
      validateStatus: () => true,
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
        "Accept-Encoding": "gzip, deflate, br, zstd",
        "Accept-Language": "id-ID,id;q=0.9",
        Cookie: cookieHeader,
        priority: "u=1, i",
      },
    }
  );

  const encoder = new TextEncoder();
  
  return new ReadableStream({
    start(controller) {
      if (typeof res.data.setEncoding === 'function') {
        res.data.setEncoding('utf8');
      }
      
      let rawBody = '';

      res.data.on('data', (chunk: string | Buffer) => {
        const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
        rawBody += text;
        controller.enqueue(encoder.encode(text));
      });

      res.data.on('end', () => {
         let answer = "";
         let reasoning = "";

         for (const line of rawBody.split(/\r?\n/)) {
           const clean = line.trim();
           if (!clean.startsWith("data:")) continue;

           const raw = clean.replace(/^data:\s*/, "").trim();
           if (!raw || raw === "[DONE]") continue;

           try {
             const json = JSON.parse(raw);
             if (json.reasoning) reasoning += json.reasoning;
             if (json.text) answer += json.text;
           } catch (e) {}
         }
         
         onSave(answer, reasoning);
         controller.close();
      });

      res.data.on('error', (err: any) => {
         controller.error(err);
      });
    }
  });
}
