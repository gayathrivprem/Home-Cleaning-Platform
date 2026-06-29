import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';

const ChatWidget = () => {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');
  const name = localStorage.getItem('name');
  
  const user = token ? { role, name, email: localStorage.getItem('email') } : null;

  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [pendingBooking, setPendingBooking] = useState({});
  const messagesEndRef = useRef(null);

  const isMobile = window.innerWidth < 640;

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, isTyping]);

  // Greeting on open
  useEffect(() => {
    if (isOpen && history.length === 0) {
      const greeting = !user
        ? "Hi! I'm CleanPro's assistant. Log in to book or manage appointments!"
        : user.role === "admin"
        ? "Hi Admin! Ask me about bookings, stats, or operations."
        : `Hi ${user.name.split(" ")[0]}! How can I help with your cleaning today?`;
      setHistory([{ role: "assistant", content: greeting }]);
    }
  }, [isOpen, user]);

  const sendMessage = async () => {
    if (!input.trim() || isTyping) return;
    const userMsg = input.trim();
    setInput("");
    setHistory(h => [...h, { role: "user", content: userMsg }]);
    setIsTyping(true);

    try {
      const res = await api.post("/chat", {
        message: userMsg,
        history: history.slice(-10),
        pending_booking: pendingBooking
      });

      const { reply, action_taken, appointment, pending_booking } = res.data;
      setHistory(h => [...h, { role: "assistant", content: reply }]);
      setPendingBooking(pending_booking || {});

      // Handle successful actions
      if (action_taken === "booked") {
        toast.success("Appointment booked via chat!");
        window.dispatchEvent(new CustomEvent("appointments-updated"));
      }
      if (action_taken === "cancelled") {
        toast.success("Appointment cancelled via chat");
        window.dispatchEvent(new CustomEvent("appointments-updated"));
      }
    } catch {
      setHistory(h => [...h,
        { role: "assistant", content: "Something went wrong. Please try again." }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Pending booking chips mapping
  const pendingChips = Object.entries(pendingBooking)
    .filter(([, v]) => v)
    .map(([k, v]) => ({
      date: `📅 ${v}`, time_slot: `🕐 ${v}`,
      cleaning_type: `🧹 ${v}`, address: `📍 ${v}`,
      num_rooms: `🚪 ${v} room${v > 1 ? "s" : ""}`
    }[k] || null))
    .filter(Boolean);

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(o => !o)}
        className={`fixed bottom-5 right-5 z-50 w-14 h-14 bg-sky-500
                   rounded-full shadow-lg flex items-center justify-center
                   text-white text-2xl hover:bg-sky-600 transition-all
                   hover:scale-110 active:scale-95 ${!isOpen ? 'animate-bounce' : ''}`}>
        {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div className={`fixed z-50 bg-white flex flex-col overflow-hidden
          ${isMobile
            ? "inset-0 rounded-none"
            : "bottom-24 right-5 w-80 h-[500px] rounded-2xl shadow-2xl border border-slate-200"
          } animate-in slide-in-from-bottom-4 duration-200`}>

          {/* Header */}
          <div className="bg-sky-500 px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-full flex
                              items-center justify-center text-white">
                🧹
              </div>
              <div>
                <p className="text-white font-semibold text-sm">CleanPro AI</p>
                <p className="text-sky-100 text-xs">
                  {isTyping ? "Typing..." : "Online"}
                </p>
              </div>
            </div>
            {isMobile && (
              <button
                onClick={() => setIsOpen(false)}
                className="text-white hover:text-sky-100 text-sm font-semibold px-2 py-1">
                Close
              </button>
            )}
          </div>

          {/* Pending booking chips */}
          {pendingChips.length > 0 && (
            <div className="px-3 py-2 bg-sky-50 border-b border-sky-100
                            flex flex-wrap gap-1">
              {pendingChips.map((chip, i) => (
                <span key={i}
                      className="text-xs bg-sky-100 text-sky-700 px-2 py-0.5
                                 rounded-full">
                  {chip}
                </span>
              ))}
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50/55">
            {history.map((msg, i) => (
              <div key={i}
                   className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm
                                 leading-relaxed ${
                  msg.role === "user"
                    ? "bg-sky-500 text-white rounded-tr-sm"
                    : "bg-slate-100 text-slate-800 rounded-tl-sm"
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-slate-100 px-4 py-3 rounded-2xl rounded-tl-sm">
                  <div className="flex gap-1 items-center">
                    <span className="w-2 h-2 bg-slate-400 rounded-full
                                     animate-bounce [animation-delay:0ms]" />
                    <span className="w-2 h-2 bg-slate-400 rounded-full
                                     animate-bounce [animation-delay:150ms]" />
                    <span className="w-2 h-2 bg-slate-400 rounded-full
                                     animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-slate-100 bg-white">
            <div className="flex gap-2 items-end">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Type a message..."
                rows={1}
                className="flex-1 border border-slate-200 rounded-xl px-3 py-2
                           text-sm outline-none focus:border-sky-400 resize-none
                           max-h-24 overflow-y-auto"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isTyping}
                className="w-9 h-9 bg-sky-500 rounded-xl flex items-center
                           justify-center text-white hover:bg-sky-600
                           disabled:opacity-40 disabled:cursor-not-allowed
                           transition-colors flex-shrink-0">
                ➤
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-1 text-center">
              Enter to send · Shift+Enter for newline
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatWidget;
