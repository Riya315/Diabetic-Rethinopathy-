import React, { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Minimize2, Maximize2, Sparkles, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getAIResponse, SUGGESTED_QUESTIONS } from '../services/aiAssistantKB';

// Render markdown-like text: **bold**, bullet lists, tables
function MessageContent({ text }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-1.5 text-xs leading-relaxed">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />;

        // Table row
        if (line.startsWith('|')) {
          const cells = line.split('|').filter(c => c.trim() && !c.trim().match(/^-+$/));
          if (cells.length === 0) return null;
          return (
            <div key={i} className="flex gap-2 text-[10px] font-mono border-b border-border-soft/40 pb-0.5">
              {cells.map((c, j) => (
                <span key={j} className={`flex-1 ${j === 0 ? 'font-bold text-espresso' : 'text-dark-brown/80'}`}>
                  {c.trim()}
                </span>
              ))}
            </div>
          );
        }

        // Heading (##)
        if (line.startsWith('## ') || line.startsWith('**') && line.endsWith('**')) {
          const clean = line.replace(/^\*\*|\*\*$/g, '').replace(/^## /, '');
          return <p key={i} className="font-bold text-espresso text-[11px] uppercase tracking-wider mt-1">{clean}</p>;
        }

        // Bullet
        if (line.startsWith('- ') || line.startsWith('• ')) {
          const content = line.replace(/^[-•] /, '');
          return (
            <div key={i} className="flex gap-1.5">
              <span className="text-forest mt-0.5 flex-shrink-0">•</span>
              <span dangerouslySetInnerHTML={{ __html: formatInline(content) }} />
            </div>
          );
        }

        // Numbered list
        const numMatch = line.match(/^(\d+)\. (.+)/);
        if (numMatch) {
          return (
            <div key={i} className="flex gap-1.5">
              <span className="font-bold text-forest flex-shrink-0">{numMatch[1]}.</span>
              <span dangerouslySetInnerHTML={{ __html: formatInline(numMatch[2]) }} />
            </div>
          );
        }

        return (
          <p key={i} dangerouslySetInnerHTML={{ __html: formatInline(line) }} />
        );
      })}
    </div>
  );
}

function formatInline(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-espresso">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="bg-sand/60 px-1 rounded font-mono text-[10px]">$1</code>');
}

export default function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: 'assistant',
      text: `👁️ **Hello! I'm DrishtiCare AI Assistant.**\n\nI can help you with DR grades, reading the Grad-CAM heatmap, referral slips, image quality issues, and clinical protocols.\n\nWhat do you need help with?`,
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isMinimized]);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen, isMinimized]);

  const sendMessage = (text) => {
    const userText = (text || input).trim();
    if (!userText) return;

    const userMsg = { id: Date.now(), role: 'user', text: userText, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);
    setShowSuggestions(false);

    // Simulate brief "thinking" delay
    setTimeout(() => {
      const response = getAIResponse(userText);
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        text: response,
        timestamp: new Date()
      }]);
      setIsTyping(false);
    }, 600 + Math.random() * 400);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Floating Trigger Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            id="ai-assistant-trigger"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-forest hover:bg-forest/90 text-cream rounded-full shadow-xl flex items-center justify-center transition-all hover:scale-110 group"
            title="DrishtiCare AI Assistant"
          >
            <Bot className="w-6 h-6" />
            {/* Pulse ring */}
            <span className="absolute w-full h-full rounded-full bg-forest/30 animate-ping" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="ai-assistant-panel"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className={`fixed bottom-6 right-6 z-50 w-[360px] bg-cream rounded-2xl shadow-2xl border border-border-soft flex flex-col overflow-hidden transition-all ${
              isMinimized ? 'h-[56px]' : 'h-[520px]'
            }`}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-forest text-cream flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-cream/20 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm flex items-center gap-1.5">
                  DrishtiCare Assistant
                  <span className="flex items-center gap-1 text-[10px] bg-sage/40 text-sage-light px-1.5 py-0.5 rounded-full font-semibold">
                    <Sparkles className="w-2.5 h-2.5" />
                    AI
                  </span>
                </div>
                <div className="text-[10px] text-cream/70 truncate">Clinical knowledge base · Always available</div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => setIsMinimized(m => !m)}
                  className="p-1.5 rounded-lg hover:bg-cream/20 transition-colors"
                  title={isMinimized ? 'Expand' : 'Minimize'}
                >
                  {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-cream/20 transition-colors"
                  title="Close"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Chat Body */}
            {!isMinimized && (
              <>
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-sand/10">
                  {messages.map(msg => (
                    <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                      {/* Avatar */}
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold ${
                        msg.role === 'assistant' ? 'bg-forest text-cream' : 'bg-terracotta/20 text-terracotta-dark'
                      }`}>
                        {msg.role === 'assistant' ? <Bot className="w-3.5 h-3.5" /> : 'U'}
                      </div>

                      {/* Bubble */}
                      <div className={`max-w-[80%] px-3 py-2 rounded-2xl shadow-sm ${
                        msg.role === 'user'
                          ? 'bg-forest text-cream rounded-tr-sm'
                          : 'bg-cream border border-border-soft text-charcoal rounded-tl-sm'
                      }`}>
                        {msg.role === 'user' ? (
                          <p className="text-xs leading-relaxed">{msg.text}</p>
                        ) : (
                          <MessageContent text={msg.text} />
                        )}
                        <div className={`text-[9px] mt-1 opacity-60 ${msg.role === 'user' ? 'text-right text-cream' : 'text-dark-brown'}`}>
                          {msg.timestamp.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Typing Indicator */}
                  {isTyping && (
                    <div className="flex gap-2">
                      <div className="w-7 h-7 rounded-full bg-forest text-cream flex items-center justify-center flex-shrink-0">
                        <Bot className="w-3.5 h-3.5" />
                      </div>
                      <div className="bg-cream border border-border-soft rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                        <div className="flex gap-1 items-center h-3">
                          <span className="w-1.5 h-1.5 bg-forest/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 bg-forest/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 bg-forest/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Suggested Questions */}
                <AnimatePresence>
                  {showSuggestions && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="px-3 py-2 border-t border-border-soft overflow-hidden bg-sand/20"
                    >
                      <div className="flex items-center gap-1 mb-1.5">
                        <Sparkles className="w-3 h-3 text-forest" />
                        <span className="text-[10px] font-bold text-dark-brown/70 uppercase tracking-wider">Quick questions</span>
                        <button onClick={() => setShowSuggestions(false)} className="ml-auto text-dark-brown/40 hover:text-dark-brown transition-colors">
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {SUGGESTED_QUESTIONS.map((q, i) => (
                          <button
                            key={i}
                            onClick={() => sendMessage(q)}
                            className="text-[10px] px-2.5 py-1 bg-cream border border-border-soft rounded-full text-dark-brown hover:border-forest hover:text-forest transition-all font-medium"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Input Box */}
                <div className="flex items-end gap-2 p-3 border-t border-border-soft bg-cream flex-shrink-0">
                  <textarea
                    ref={inputRef}
                    id="ai-assistant-input"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about DR grades, heatmap, referral..."
                    rows={1}
                    className="flex-1 resize-none text-xs bg-sand/30 border border-border-soft rounded-xl px-3 py-2 focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest/30 text-charcoal placeholder:text-dark-brown/40 max-h-24 overflow-y-auto"
                    style={{ minHeight: '36px' }}
                    onInput={e => {
                      e.target.style.height = 'auto';
                      e.target.style.height = Math.min(e.target.scrollHeight, 96) + 'px';
                    }}
                  />
                  <button
                    id="ai-assistant-send"
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || isTyping}
                    className="w-9 h-9 rounded-xl bg-forest text-cream flex items-center justify-center flex-shrink-0 hover:bg-forest/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:scale-105"
                    title="Send"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
