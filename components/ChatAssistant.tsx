import React, { useState, useRef, useEffect, useContext } from 'react';
import { MessageSquare, X, Send, Bot, User, ChevronDown, ChevronRight, Sparkles } from 'lucide-react';
import { PlotData } from '../types';
import { chatWithAssistant } from '../services/geminiService';
import { LanguageContext } from '../App';

interface ChatAssistantProps {
  plotData: PlotData;
  analysisResult: string | null;
}

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
}

const ChatAssistant: React.FC<ChatAssistantProps> = ({ plotData, analysisResult }) => {
  const { language } = useContext(LanguageContext);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'model',
      text: language === 'ar' 
        ? "مرحباً! أنا مساعد كود سكاوت. كيف يمكنني مساعدتك في تحليل أرضك اليوم؟" 
        : "Hello! I'm CodeScout Assistant. How can I help you analyze your plot today?"
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: inputValue };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    try {
      const apiHistory = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      const responseText = await chatWithAssistant(apiHistory, userMsg.text, {
        plot: plotData,
        analysisResult,
        language
      });

      const botMsg: Message = { 
        id: (Date.now() + 1).toString(), 
        role: 'model', 
        text: responseText 
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (error) {
      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        role: 'model', 
        text: "Sorry, I encountered an error. Please try again." 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleDetails = (msgId: string) => {
    setExpandedDetails(prev => ({
        ...prev,
        [msgId]: !prev[msgId]
    }));
  };

  const parseMessage = (text: string) => {
    const parts = text.split('__DETAILS_START__');
    const content = parts[0].trim();
    let details = '';
    
    if (parts.length > 1) {
       const endSplit = parts[1].split('__DETAILS_END__');
       details = endSplit[0].trim();
       if (endSplit.length > 1) content.concat(endSplit[1]); 
    }
    
    return { content, details };
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-8 right-8 z-50 bg-gradient-to-br from-slate-900 to-slate-800 text-white p-4 rounded-2xl shadow-2xl hover:scale-105 transition-all duration-300 border border-slate-700/50 group print:hidden backdrop-blur-md overflow-hidden"
        title="Chat with AI Assistant"
      >
        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-20 transition-opacity"></div>
        <MessageSquare className="w-6 h-6 group-hover:text-brand-200 transition-colors relative z-10" strokeWidth={1.5} />
        
        {/* Ping Animation */}
        <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-brand-500 rounded-full border-2 border-slate-800 shadow-sm z-20">
            <span className="absolute inset-0 rounded-full bg-brand-400 animate-ping opacity-75"></span>
        </span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-8 right-8 z-50 w-full max-w-[380px] h-[600px] flex flex-col glass-card rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 duration-300 print:hidden border border-sand-200 bg-white/95">
      {/* Header */}
      <div className="bg-white/90 text-slate-900 p-4 flex justify-between items-center shrink-0 border-b border-sand-200 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-50 to-white border border-brand-100 flex items-center justify-center shadow-sm">
             <Bot className="w-5 h-5 text-brand-600" strokeWidth={1.5} />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900">CodeScout AI</h3>
            <p className="text-[10px] text-brand-600 flex items-center gap-1.5 mt-0.5 font-medium uppercase tracking-wide">
              <span className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-pulse shadow-[0_0_8px_#0ea5e9]"></span>
              Online
            </p>
          </div>
        </div>
        <button 
          onClick={() => setIsOpen(false)}
          className="text-slate-400 hover:text-slate-800 transition bg-sand-50 hover:bg-sand-100 p-2 rounded-xl"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-sand-50/30 custom-scrollbar">
        {messages.map((msg) => {
          const { content, details } = parseMessage(msg.text);
          const isExpanded = expandedDetails[msg.id];

          return (
            <div
                key={msg.id}
                className={`flex items-end gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
                {/* Modern Avatar */}
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm border ${
                    msg.role === 'user' 
                    ? 'bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 text-white' 
                    : 'bg-gradient-to-br from-white to-brand-50 border-brand-100 text-brand-600'
                }`}>
                    {msg.role === 'user' ? <User className="w-4 h-4" strokeWidth={1.5} /> : <Sparkles className="w-4 h-4" strokeWidth={1.5} />}
                </div>

                {/* Bubble */}
                <div 
                className={`max-w-[85%] p-4 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed shadow-sm flex flex-col gap-2 ${
                    msg.role === 'user' 
                    ? 'bg-slate-900 text-white rounded-br-none' 
                    : 'bg-white text-slate-800 rounded-bl-none border border-sand-200'
                }`}
                dir="auto"
                >
                    <span>{content}</span>
                    
                    {details && msg.role === 'model' && (
                        <div className="border-t border-sand-100 pt-2 mt-1">
                             <button 
                                onClick={() => toggleDetails(msg.id)}
                                className="flex items-center gap-1 text-[10px] text-brand-600 hover:text-brand-800 font-bold uppercase tracking-wider transition-colors w-full"
                             >
                                {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                Technical Data
                             </button>
                             {isExpanded && (
                                 <div className="mt-2 text-[10px] bg-sand-50 p-2.5 rounded-lg text-slate-600 border border-sand-200 font-mono">
                                    {details}
                                 </div>
                             )}
                        </div>
                    )}
                </div>
            </div>
          );
        })}
        {isLoading && (
          <div className="flex items-end gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-white to-brand-50 border border-brand-100 text-brand-600 flex items-center justify-center shrink-0">
               <Sparkles className="w-4 h-4" strokeWidth={1.5} />
            </div>
            <div className="bg-white border border-sand-200 p-4 rounded-2xl rounded-bl-none shadow-sm flex gap-1">
              <span className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
              <span className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
              <span className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-bounce"></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-white/80 border-t border-sand-200 flex gap-2 shrink-0 items-center backdrop-blur-md">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder={language === 'ar' ? 'اسأل عن النظام...' : 'Ask about regulations...'}
          className="flex-1 bg-sand-50 border border-sand-200 focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 rounded-xl text-sm px-4 outline-none transition h-12 text-slate-900 placeholder:text-slate-400"
          dir="auto"
        />
        <button
          onClick={handleSend}
          disabled={!inputValue.trim() || isLoading}
          className="bg-slate-900 text-white w-12 h-12 flex items-center justify-center rounded-xl hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-md active:scale-95 group"
        >
          <Send className="w-5 h-5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
};

export default ChatAssistant;