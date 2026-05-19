// by Stenly
'use client';

import { useState, useEffect, useRef } from 'react';
import { Menu, PlusCircle, ChevronDown, ChevronUp, Globe, Sparkles, Mic, Send, X, MessageSquare, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
      if (!res.ok) return;
      const data = await res.json();
      if (data.chats) setChats(data.chats);
    } catch (err) {
      console.error(err);
    }
  };

  const loadMessages = async (chatId: string) => {
    try {
      const res = await fetch(`/api/chats/${chatId}/messages`);
      if (!res.ok) return;
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
    if (typeof window !== 'undefined') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
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
    
    setTimeout(scrollToBottom, 50);

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

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Server returned ${response.status}: ${errorData}`);
      }

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let finalReasoning = '';
      let finalAnswer = '';
      let buffer = '';

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() || '';
          
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

    } catch (err: any) {
      console.error('Fetch error:', err);
      // Fallback display
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Maaf, terjadi kesalahan:\n\`\`\`\n${err.message}\n\`\`\``, reasoning: '' },
      ]);
      setStreamReasoning('');
      setStreamAnswer('');
    } finally {
      setIsGenerating(false);
      setTimeout(scrollToBottom, 50);
    }
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
          <div className="flex flex-col items-center justify-center -mt-1 cursor-pointer">
            <div className="flex items-center gap-1.5 text-[15px] font-bold text-gray-950 tracking-tight">
              DeepSeek V4 Flash
              <ChevronDown size={14} className="text-gray-500" strokeWidth={2.5} />
            </div>
          </div>
          <button onClick={startNewChat} className="p-2 -mr-2 text-gray-700 active:bg-gray-100 transition-colors rounded-full">
             <PlusCircle size={24} strokeWidth={1.5} />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-5 scroll-smooth">
          
          {messages.length === 0 && !isGenerating && !streamReasoning && !streamAnswer && (
             <div className="flex-1 flex flex-col items-center justify-center text-center px-4 opacity-70">
                <Sparkles size={40} className="text-gray-300 mb-4" />
                <h2 className="text-lg font-bold text-gray-700">Apa yang bisa saya bantu?</h2>
                <p className="text-[13px] text-gray-500 mt-2 font-medium">Model: DeepSeek V4 Flash</p>
             </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} className={`flex flex-col max-w-full ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              {msg.role === 'user' ? (
                <div className="bg-[#f0f0f4] rounded-tl-[20px] rounded-bl-[20px] rounded-br-[20px] rounded-tr-[4px] px-4 py-2.5 text-[14px] text-gray-950 font-medium leading-relaxed max-w-[85%] break-words shadow-sm border border-gray-100/50">
                  {msg.content}
                </div>
              ) : (
                <div className="flex flex-col gap-1 max-w-full w-full">
                  {msg.reasoning && (
                    <div className="flex flex-col">
                      <button 
                        onClick={() => setIsThinkingExpanded(!isThinkingExpanded)}
                        className="flex items-center gap-2 text-[12px] text-gray-500 font-bold py-1 self-start rounded-lg hover:text-gray-800 transition-colors"
                      >
                        Tahap Berpikir Selesai
                        {isThinkingExpanded ? <ChevronUp size={14} strokeWidth={2.5} /> : <ChevronDown size={14} strokeWidth={2.5} />}
                      </button>
                      
                      {isThinkingExpanded && (
                        <div className="border-l-[3px] border-gray-200 ml-1 pl-3 py-0.5 mt-0.5 leading-relaxed max-vh-40 overflow-y-auto w-full break-words prose prose-sm prose-gray max-w-none text-gray-600 font-medium marker:text-gray-500">
                           <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {msg.reasoning || ''}
                           </ReactMarkdown>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="text-[14px] font-medium leading-relaxed text-gray-950 pt-1 break-words prose prose-sm prose-p:leading-relaxed prose-gray max-w-none prose-a:text-blue-600 hover:prose-a:text-blue-500 prose-table:border-collapse prose-th:border prose-th:border-gray-300 prose-th:p-2 prose-td:border prose-td:border-gray-300 prose-td:p-2">
                    <div>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                       {msg.content || ''}
                    </ReactMarkdown>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* STREAMING UI */}
          {(streamReasoning || streamAnswer || (isGenerating && !streamReasoning && !streamAnswer)) && (
            <div className="flex flex-col gap-1 max-w-full items-start w-full">
              {(!streamAnswer || streamReasoning) && (
                <div className="flex flex-col w-full">
                  <div className="flex items-center gap-1.5 text-[12px] text-gray-600 font-bold py-1 self-start rounded-lg">
                    <Loader2 size={12} className="animate-spin text-blue-600" /> Sedang berpikir...
                  </div>
                  
                  {streamReasoning && (
                    <div className="border-l-[3px] border-gray-200 ml-1 pl-3 py-0.5 mt-0.5 leading-relaxed w-full break-words prose prose-sm prose-gray max-w-none text-gray-600 font-medium marker:text-gray-500">
                       <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {streamReasoning || ''}
                       </ReactMarkdown>
                    </div>
                  )}
                </div>
              )}
              {streamAnswer && (
                 <div className="text-[14px] font-medium leading-relaxed text-gray-950 pt-1 break-words prose prose-sm prose-p:leading-relaxed prose-gray max-w-none prose-a:text-blue-600 hover:prose-a:text-blue-500 prose-table:border-collapse prose-th:border prose-th:border-gray-300 prose-th:p-2 prose-td:border prose-td:border-gray-300 prose-td:p-2">
                    <div>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                       {streamAnswer || ''}
                    </ReactMarkdown>
                    </div>
                 </div>
              )}
            </div>
          )}
          
          <div ref={messagesEndRef} className="h-4" />
        </main>

        <div className="px-3 pb-4 pt-1 bg-gradient-to-t from-white via-white to-transparent sticky bottom-0">
          <div className="border border-gray-300/80 rounded-[28px] p-1.5 flex flex-col gap-2 shadow-[0_2px_10px_rgba(0,0,0,0.06)] bg-white focus-within:border-blue-500 focus-within:shadow-[0_2px_12px_rgba(59,130,246,0.15)] transition-all">
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSend();
              }}
              disabled={isGenerating}
              placeholder="Tanya sesuatu..." 
              className="bg-transparent border-none outline-none text-[14px] font-medium px-3 pt-1.5 placeholder-gray-500 w-full disabled:opacity-50 text-gray-950"
            />
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5">
                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f0f4ff] text-[#2563eb] rounded-full text-[12px] font-bold border border-[#dbeafe] transition-colors">
                  <Sparkles size={12} className="fill-[#3b82f6]/20" /> Berpikir
                </button>
                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f5f8ff] text-[#3b82f6] rounded-full text-[12px] font-bold border border-[#e0e7ff] transition-colors hover:bg-[#ebf0fc]">
                  <Globe size={12} /> Cari
                </button>
              </div>
              <button 
                onClick={handleSend}
                disabled={!input.trim() || isGenerating}
                className="p-1.5 text-white bg-blue-600 rounded-full hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:bg-gray-400 disabled:text-white"
              >
                {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} className="ml-0.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

