let chatLog = [];
let waiting = false;

function addMsg(text, who) {
  const box = document.getElementById('chat-box');
  const div = document.createElement('div');
  div.className = 'msg ' + who;
  div.textContent = text;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
  return div;
}

async function sendChat() {
  const input = document.getElementById('chat-input');
  const q = input.value.trim();
  if (!q || waiting) return;

  addMsg(q, 'user');
  chatLog.push({ role: 'user', text: q });
  input.value = '';

  waiting = true;
  const thinking = addMsg('Thinking...', 'bot');

  // only send the last few messages so the request stays small
  const data = await callFn('ai-chat', { messages: chatLog.slice(-10) });

  const reply = data && data.reply ? data.reply : "Sorry, I couldn't answer that right now.";
  thinking.textContent = reply;
  chatLog.push({ role: 'assistant', text: reply });
  waiting = false;
}
