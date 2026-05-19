// by Stenly
'use client';

import { useState, useEffect, useRef } from 'react';
import { Menu, PlusCircle, ChevronDown, ChevronUp, Globe, Sparkles, Mic, Send, X, MessageSquare, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Page() {
  const [deviceId, setDeviceId] = useState<string>('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chats, setChats] = useState<any[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // To track the current streaming reasoning & answer
  const [streamReasoning, setStreamReasoning] = useState('');
  const [streamAnswer, setStreamAnswer] = useState('');
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(true);

  useEffect(() => {
    let id = localStorage.getItem('device_id');
    if (!id) {
      id = 'dev-' + Math.random().toString(36).substring(2) + Date.now().toString();
      localStorage.setItem('device_id', id);
    }
    setDeviceId(id);
    loadChats(id);
  }, []);

  const loadChats = async (devId: string) => {
    try {
      const res = await fetch(`/api/chats?deviceId=${devId}`);
      const data = await res.json();
      if (data.chats) setChats(data.chats);
    } catch (err) {
      console.error(err);
    }
  };

  const loadMessages = async (chatId: string) => {
    try {
      const res = await fetch(`/api/chats/${chatId}/messages`);
      const data = await res.json();
      if (data.messages) {
        setMessages(data.messages);
      }
      setTimeout(scrollToBottom, 100);
    } catch (err) {
      console.error(err);
    }
  };

  const selectChat = (chatId: string) => {
    setCurrentChatId(chatId);
    setSidebarOpen(false);
    loadMessages(chatId);
  };

  const startNewChat = () => {
    setCurrentChatId(null);
    setMessages([]);
    setSidebarOpen(false);
    setStreamAnswer('');
    setStreamReasoning('');
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async () => {
    if (!input.trim() || isGenerating) return;

    const userText = input.trim();
    setInput('');
    setIsGenerating(true);
    setStreamReasoning('');
    setStreamAnswer('');
    setIsThinkingExpanded(true);

    // Save history formatting
    const newMessages = [...messages, { role: 'user', content: userText }];
    setMessages(newMessages);
    
    setTimeout(scrollToBottom, 100);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          chatId: currentChatId,
          prompt: userText,
          history: messages,
        }),
      });

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let finalReasoning = '';
      let finalAnswer = '';

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split(/\n\n/);
          for (const line of lines) {
            const clean = line.trim();
            if (clean.startsWith('data:')) {
              const raw = clean.replace(/^data:\s*/, '').trim();
              if (raw === '[DONE]') continue;
              try {
                const json = JSON.parse(raw);
                if (json.chatId && !currentChatId) {
                  setCurrentChatId(json.chatId);
                  loadChats(deviceId); // Reload chats to show new title
                }
                if (json.reasoning) {
                  finalReasoning += json.reasoning;
                  setStreamReasoning(finalReasoning);
                  scrollToBottom();
                }
                if (json.text) {
                  finalAnswer += json.text;
                  setStreamAnswer(finalAnswer);
                  scrollToBottom();
                }
              } catch (e) {
                // ignore split lines JSON error
              }
            }
          }
        }
      }

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: finalAnswer, reasoning: finalReasoning },
      ]);
      setStreamReasoning('');
      setStreamAnswer('');

    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
      setTimeout(scrollToBottom, 100);
    }
  };

  const formatText = (text: string) => {
    if (!text) return null;
    return text.split('\n').map((line, i) => (
      <span key={i}>
        {line}
        <br />
      </span>
    ));
  };

  return (
    <div className="flex h-[100dvh] w-full bg-white text-gray-900 font-sans overflow-hidden">
      
      {/* SIDEBAR */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="absolute inset-0 bg-black/50 z-40"
            />
            <motion.div 
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute top-0 left-0 h-full w-4/5 max-w-[300px] bg-white z-50 shadow-2xl flex flex-col"
            >
              <div className="p-4 flex items-center justify-between border-b border-gray-100">
                <span className="font-semibold text-lg">Riwayat Obrolan</span>
                <button onClick={() => setSidebarOpen(false)} className="p-2 -mr-2 text-gray-500 active:bg-gray-100 rounded-full">
                  <X size={20} />
                </button>
              </div>
              <div className="p-4">
                <button 
                  onClick={startNewChat}
                  className="w-full flex items-center gap-2 bg-blue-600 text-white rounded-xl px-4 py-3 font-medium active:bg-blue-700 transition"
                >
                  <PlusCircle size={18} />
                  Mulai Obrolan Baru
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-2 pb-4">
                {chats.length === 0 ? (
                  <div className="p-4 text-center text-sm text-gray-400">Belum ada riwayat</div>
                ) : (
                  chats.map(chat => (
                    <button
                      key={chat.id}
                      onClick={() => selectChat(chat.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition ${chat.id === currentChatId ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700'}`}
                    >
                      <MessageSquare size={16} className={chat.id === currentChatId ? 'text-blue-600' : 'text-gray-400'} />
                      <span className="truncate text-[14px] flex-1">{chat.title || 'Obrolan'}</span>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* MAIN CHAT AREA */}
      <div className="flex flex-col flex-1 w-full relative h-full">
        <header className="flex items-center justify-between px-4 py-3 bg-white/90 backdrop-blur-md sticky top-0 z-10 border-b border-gray-50/50">
          <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 text-gray-700 active:bg-gray-100 transition-colors rounded-full">
             <Menu size={24} strokeWidth={1.5} />
          </button>
          <div className="flex flex-col items-center justify-center -mt-1">
            <h1 className="text-[15px] font-semibold text-gray-900">Sapaan ramah dan tawaran bantuan</h1>
            <div className="flex items-center gap-1 text-[11px] text-blue-600 font-semibold tracking-wide uppercase mt-0.5">
              <Sparkles size={10} className="fill-blue-600/50" />
              Pakar
            </div>
          </div>
          <button onClick={startNewChat} className="p-2 -mr-2 text-gray-700 active:bg-gray-100 transition-colors rounded-full">
             <PlusCircle size={24} strokeWidth={1.5} />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-6 scroll-smooth">
          
          {messages.length === 0 && !isGenerating && !streamReasoning && !streamAnswer && (
             <div className="flex-1 flex flex-col items-center justify-center text-center px-4 opacity-50">
                <Sparkles size={40} className="text-gray-300 mb-4" />
                <h2 className="text-xl font-medium text-gray-500">Tanyakan sesuatu</h2>
                <p className="text-sm text-gray-400 mt-2">Diberdayakan oleh DeepSeek V4 Flash</p>
             </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} className={`flex flex-col max-w-full ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              {msg.role === 'user' ? (
                <div className="bg-blue-50/50 sm:bg-gray-100/70 bg-[#f2f2f5] rounded-3xl rounded-tr-[4px] px-4 py-3 text-[15px] text-gray-800 leading-relaxed max-w-[85%] whitespace-pre-wrap break-words">
                  {msg.content}
                </div>
              ) : (
                <div className="flex flex-col gap-3 max-w-full w-full">
                  {msg.reasoning && (
                    <div className="flex flex-col">
                      <button 
                        onClick={() => setIsThinkingExpanded(!isThinkingExpanded)}
                        className="flex items-center gap-2 text-[13px] text-gray-500 font-medium py-1.5 self-start rounded-lg hover:text-gray-700 transition-colors"
                      >
                        Tahap Berpikir Selesai
                        {isThinkingExpanded ? <ChevronUp size={16} strokeWidth={2} /> : <ChevronDown size={16} strokeWidth={2} />}
                      </button>
                      
                      {isThinkingExpanded && (
                        <div className="border-l-[3px] border-gray-200 ml-1.5 pl-4 py-1 mt-1 text-gray-500 text-[14px] leading-relaxed max-h-40 overflow-y-auto w-full break-words">
                          {formatText(msg.reasoning)}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="text-[15px] leading-relaxed text-gray-800 pt-2 break-words whitespace-pre-wrap">
                    {msg.content ? formatText(msg.content) : null}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* STREAMING UI */}
          {(streamReasoning || streamAnswer || (isGenerating && !streamReasoning && !streamAnswer)) && (
            <div className="flex flex-col gap-3 max-w-full items-start w-full">
              {(!streamAnswer || streamReasoning) && (
                <div className="flex flex-col w-full">
                  <div className="flex items-center gap-2 text-[13px] text-gray-500 font-medium py-1.5 self-start rounded-lg">
                    <Loader2 size={14} className="animate-spin text-blue-500" /> Sedang berpikir...
                  </div>
                  
                  {streamReasoning && (
                    <div className="border-l-[3px] border-gray-200 ml-1.5 pl-4 py-1 mt-1 text-gray-500 text-[14px] leading-relaxed w-full break-words">
                       {formatText(streamReasoning)}
                    </div>
                  )}
                </div>
              )}
              {streamAnswer && (
                 <div className="text-[15px] leading-relaxed text-gray-800 pt-2 break-words whitespace-pre-wrap">
                   {formatText(streamAnswer)}
                 </div>
              )}
            </div>
          )}
          
          <div ref={messagesEndRef} className="h-2" />
        </main>

        <div className="px-4 pb-5 pt-2 bg-gradient-to-t from-white via-white to-transparent sticky bottom-0">
          <div className="border border-gray-200/80 rounded-[32px] p-2 flex flex-col gap-2.5 shadow-[0_2px_10px_rgba(0,0,0,0.04)] bg-[#fdfdfd] focus-within:border-blue-400 focus-within:shadow-[0_2px_12px_rgba(59,130,246,0.1)] transition-all">
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSend();
              }}
              disabled={isGenerating}
              placeholder="Ketik pesan atau tanya sesuatu..." 
              className="bg-transparent border-none outline-none text-[15px] px-3 pt-2 placeholder-gray-400 w-full disabled:opacity-50"
            />
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f0f4ff] text-[#2563eb] rounded-full text-[13px] font-medium border border-[#dbeafe] transition-colors">
                  <Sparkles size={14} className="fill-[#3b82f6]/20" /> Berpikir
                </button>
                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f5f8ff] text-[#3b82f6] rounded-full text-[13px] font-medium border border-[#e0e7ff] transition-colors hover:bg-[#ebf0fc]">
                  <Globe size={14} /> Cari
                </button>
              </div>
              <button 
                onClick={handleSend}
                disabled={!input.trim() || isGenerating}
                className="p-2 text-white bg-blue-600 rounded-full mr-0.5 hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:bg-gray-300 disabled:text-white"
              >
                {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className="ml-0.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

