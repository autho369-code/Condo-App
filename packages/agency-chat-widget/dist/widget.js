(function () {
"use strict";const script = document.currentScript;
const API_URL = script?.getAttribute("data-api") || "/api/chat";
const PRIMARY_COLOR = script?.getAttribute("data-color") || "#2563eb";
const TITLE = script?.getAttribute("data-title") || "Chat with us";
const SUBTITLE = script?.getAttribute("data-subtitle") || "We reply instantly";
const PLACEHOLDER = script?.getAttribute("data-placeholder") || "Type your message...";
let isOpen = false;
let messages = [];
let isTyping = false;
const css = `
.aw-bubble{position:fixed;bottom:24px;right:24px;z-index:9999;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
.aw-btn{width:56px;height:56px;border-radius:50%;border:none;background:${PRIMARY_COLOR};color:#fff;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,0.15);display:flex;align-items:center;justify-content:center;font-size:24px;transition:transform 0.2s}
.aw-btn:hover{transform:scale(1.05)}
.aw-panel{display:none;position:fixed;bottom:96px;right:24px;width:380px;max-width:calc(100vw-48px);height:520px;max-height:calc(100vh-140px);background:#fff;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,0.12);flex-direction:column;overflow:hidden;border:1px solid #e5e7eb}
.aw-panel.open{display:flex}
.aw-header{padding:16px 20px;background:${PRIMARY_COLOR};color:#fff}
.aw-header h3{margin:0;font-size:16px;font-weight:600}
.aw-header p{margin:2px 0 0;font-size:12px;opacity:0.85}
.aw-body{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:8px}
.aw-msg{max-width:85%;padding:10px 14px;border-radius:14px;font-size:14px;line-height:1.5;animation:aw-slide 0.2s ease}
.aw-msg.bot{background:#f3f4f6;align-self:flex-start;border-bottom-left-radius:4px;color:#1f2937}
.aw-msg.user{background:${PRIMARY_COLOR};color:#fff;align-self:flex-end;border-bottom-right-radius:4px}
.aw-typing{display:none;align-self:flex-start;padding:10px 14px;background:#f3f4f6;border-radius:14px;border-bottom-left-radius:4px}
.aw-typing.show{display:flex;gap:4px}
.aw-typing span{width:6px;height:6px;border-radius:50%;background:#9ca3af;animation:aw-bounce 1.4s infinite}
.aw-typing span:nth-child(2){animation-delay:0.2s}
.aw-typing span:nth-child(3){animation-delay:0.4s}
.aw-footer{padding:12px 16px;border-top:1px solid #e5e7eb;display:flex;gap:8px}
.aw-footer input{flex:1;padding:10px 14px;border:1px solid #e5e7eb;border-radius:24px;font-size:14px;outline:none}
.aw-footer input:focus{border-color:${PRIMARY_COLOR}}
.aw-footer button{width:40px;height:40px;border-radius:50%;border:none;background:${PRIMARY_COLOR};color:#fff;cursor:pointer;font-size:18px;flex-shrink:0;transition:opacity 0.2s}
.aw-footer button:disabled{opacity:0.5}
@keyframes aw-slide{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes aw-bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-6px)}}
`;const styleEl = document.createElement("style");
styleEl.textContent = css;
document.head.appendChild(styleEl);const root = document.createElement("div");
root.className = "aw-bubble";
root.innerHTML = `
<div class="aw-panel" id="aw-panel">
<div class="aw-header"><h3>${TITLE}</h3><p>${SUBTITLE}</p></div>
<div class="aw-body" id="aw-body">
<div class="aw-msg bot">👋 Hi! How can I help you today?</div>
</div>
<div class="aw-typing" id="aw-typing"><span></span><span></span><span></span></div>
<div class="aw-footer">
<input id="aw-input" type="text" placeholder="${PLACEHOLDER}" autocomplete="off" />
<button id="aw-send" disabled>➤</button>
</div>
</div>
<button class="aw-btn" id="aw-btn">💬</button>
`;
document.body.appendChild(root);const panel = document.getElementById("aw-panel");
const body = document.getElementById("aw-body");
const input = document.getElementById("aw-input");
const sendBtn = document.getElementById("aw-send");
const typingEl = document.getElementById("aw-typing");
const toggleBtn = document.getElementById("aw-btn");
function toggle() {
isOpen = !isOpen;
panel?.classList.toggle("open", isOpen);
toggleBtn.textContent = isOpen ? "✕" : "💬";
if (isOpen) input?.focus();
}function addMessage(text, role) {
const div = document.createElement("div");
div.className = `aw-msg ${role}`;
div.textContent = text;
body?.appendChild(div);
body.scrollTop = body.scrollHeight;
messages.push({ text, role });
}function showTyping(show) {
isTyping = show;
typingEl?.classList.toggle("show", show);
if (body) body.scrollTop = body.scrollHeight;
}async function send() {
const text = input?.value.trim();
if (!text || isTyping) return;addMessage(text, "user");
if (input) input.value = "";
if (sendBtn) sendBtn.disabled = true;
showTyping(true);try {
const res = await fetch(API_URL, {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ message: text, history: messages.slice(-10) }),
});
const data = await res.json();
showTyping(false);
addMessage(data.reply || "Sorry, I couldn't process that. Please try again.", "bot");
} catch {
showTyping(false);
addMessage("Connection error. Please try again.", "bot");
} finally {
if (sendBtn) sendBtn.disabled = false;
input?.focus();
}
}
toggleBtn?.addEventListener("click", toggle);
sendBtn?.addEventListener("click", send);
input?.addEventListener("keydown", (e) => {
if (e.key === "Enter") send();
});
input?.addEventListener("input", () => {
if (sendBtn) sendBtn.disabled = !input.value.trim();
});
if (!sessionStorage.getItem("aw-seen")) {
setTimeout(() => { if (!isOpen) toggle(); }, 5000);
sessionStorage.setItem("aw-seen", "1");
}
})();