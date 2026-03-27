/**
 * TechLens - Chat Overlay (多轮对话浮窗)
 */

(function () {

  const OVERLAY_ID = 'techlens-overlay';

  // 当前会话状态
  let currentFrameData = null;  // 当前截帧 base64
  let messageHistory  = [];     // 对话历史 [{role, content}]
  let isWaiting       = false;  // 防止重复发送

  // ─── 入口：打开对话浮窗 ───────────────────────────────────

  window.openChatOverlay = function (frameData) {
    currentFrameData = frameData;
    messageHistory   = [];
    isWaiting        = false;

    document.getElementById(OVERLAY_ID)?.remove();

    const overlay = buildOverlay();
    document.body.appendChild(overlay);
    makeDraggable(overlay);

    // 自动聚焦输入框
    setTimeout(() => overlay.querySelector('.tl-input')?.focus(), 100);
  };

  // ─── 构建浮窗 DOM ─────────────────────────────────────────

  function buildOverlay() {
    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;

    overlay.innerHTML = `
      <!-- 头部 -->
      <div class="tl-header">
        <div class="tl-title">
          <span class="tl-icon">🔍</span>
          <span>TechLens 对话</span>
        </div>
        <div class="tl-header-actions">
          <button class="tl-new-btn" title="截取新画面重新对话">🔄 新画面</button>
          <button class="tl-close-btn" title="关闭">✕</button>
        </div>
      </div>

      <!-- 缩略图 -->
      <div class="tl-thumb-bar">
        <img class="tl-thumb" src="" alt="当前帧" />
        <span class="tl-thumb-hint">基于此帧提问 · 可多轮追问</span>
      </div>

      <!-- 消息列表 -->
      <div class="tl-messages" id="tl-messages">
        <div class="tl-welcome">
          💬 问我关于这个画面的任何问题<br>
          <span class="tl-examples">例：这个人是谁？ · 跳的什么舞？ · 这里用了什么技术？</span>
        </div>
      </div>

      <!-- 输入区 -->
      <div class="tl-input-bar">
        <textarea
          class="tl-input"
          placeholder="输入问题，Enter 发送，Shift+Enter 换行"
          rows="2"
        ></textarea>
        <button class="tl-send-btn" title="发送">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M22 2L11 13" stroke="white" stroke-width="2" stroke-linecap="round"/>
            <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="white" stroke-width="2" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    `;

    // 设置缩略图
    overlay.querySelector('.tl-thumb').src = currentFrameData;

    // 绑定事件
    overlay.querySelector('.tl-close-btn').addEventListener('click', () => {
      overlay.remove();
    });

    overlay.querySelector('.tl-new-btn').addEventListener('click', () => {
      overlay.remove();
      // 重新截帧打开对话
      setTimeout(() => {
        const video = document.querySelector('video');
        if (!video) return;
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, 1280 / video.videoWidth);
        canvas.width  = Math.floor(video.videoWidth  * scale);
        canvas.height = Math.floor(video.videoHeight * scale);
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
        window.openChatOverlay(canvas.toDataURL('image/jpeg', 0.75));
      }, 100);
    });

    const textarea = overlay.querySelector('.tl-input');
    const sendBtn  = overlay.querySelector('.tl-send-btn');

    // Enter 发送，Shift+Enter 换行
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(overlay);
      }
    });

    sendBtn.addEventListener('click', () => sendMessage(overlay));

    // ESC 关闭
    document.addEventListener('keydown', function escHandler(e) {
      if (e.key === 'Escape') {
        overlay.remove();
        document.removeEventListener('keydown', escHandler);
      }
    });

    return overlay;
  }

  // ─── 发送消息 ─────────────────────────────────────────────

  async function sendMessage(overlay) {
    if (isWaiting) return;

    const textarea = overlay.querySelector('.tl-input');
    const text = textarea.value.trim();
    if (!text) return;

    textarea.value = '';
    textarea.style.height = 'auto';

    // 加入历史
    messageHistory.push({ role: 'user', content: text });

    // 渲染用户消息
    appendMessage(overlay, 'user', text);

    // 显示 AI 思考中
    const thinkingEl = appendThinking(overlay);

    isWaiting = true;
    setSendState(overlay, true);

    try {
      // 第一轮带图片，后续不带
      const isFirstRound = messageHistory.length === 1;

      const res = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            type: 'CHAT',
            imageData: isFirstRound ? currentFrameData : null,
            messages: messageHistory
          },
          (r) => {
            if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
            else resolve(r);
          }
        );
      });

      thinkingEl.remove();

      if (res.success) {
        messageHistory.push({ role: 'assistant', content: res.answer });
        appendMessage(overlay, 'assistant', res.answer);
      } else {
        appendError(overlay, res.error);
      }

    } catch (err) {
      thinkingEl.remove();
      appendError(overlay, err.message);
    } finally {
      isWaiting = false;
      setSendState(overlay, false);
      overlay.querySelector('.tl-input')?.focus();
    }
  }

  // ─── 消息渲染函数 ─────────────────────────────────────────

  function appendMessage(overlay, role, text) {
    const list = overlay.querySelector('.tl-messages');

    // 移除欢迎语
    list.querySelector('.tl-welcome')?.remove();

    const el = document.createElement('div');
    el.className = `tl-msg tl-msg-${role}`;

    // 简单 markdown：换行、加粗、代码块
    const html = formatText(text);
    el.innerHTML = `
      <div class="tl-msg-bubble">${html}</div>
    `;

    list.appendChild(el);
    list.scrollTop = list.scrollHeight;
  }

  function appendThinking(overlay) {
    const list = overlay.querySelector('.tl-messages');
    const el = document.createElement('div');
    el.className = 'tl-msg tl-msg-assistant tl-thinking';
    el.innerHTML = `
      <div class="tl-msg-bubble">
        <span class="tl-dot"></span>
        <span class="tl-dot"></span>
        <span class="tl-dot"></span>
      </div>
    `;
    list.appendChild(el);
    list.scrollTop = list.scrollHeight;
    return el;
  }

  function appendError(overlay, msg) {
    const list = overlay.querySelector('.tl-messages');
    const el = document.createElement('div');
    el.className = 'tl-msg tl-msg-error';
    el.innerHTML = `<div class="tl-msg-bubble">⚠️ ${escHtml(msg)}</div>`;
    list.appendChild(el);
    list.scrollTop = list.scrollHeight;
  }

  function setSendState(overlay, disabled) {
    const btn  = overlay.querySelector('.tl-send-btn');
    const inp  = overlay.querySelector('.tl-input');
    btn.disabled = disabled;
    inp.disabled = disabled;
    btn.style.opacity = disabled ? '0.4' : '1';
  }

  // ─── 文本格式化（简易 markdown）─────────────────────────────

  function formatText(text) {
    return escHtml(text)
      // 代码块 ```...```
      .replace(/```([\s\S]*?)```/g, '<pre class="tl-inline-code">$1</pre>')
      // 行内代码 `...`
      .replace(/`([^`]+)`/g, '<code class="tl-code">$1</code>')
      // 加粗 **...**
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      // 换行
      .replace(/\n/g, '<br>');
  }

  // ─── 拖动 ─────────────────────────────────────────────────

  function makeDraggable(el) {
    const header = el.querySelector('.tl-header');
    let dragging = false, sx, sy, il, it;

    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('button')) return;
      dragging = true;
      sx = e.clientX; sy = e.clientY;
      const r = el.getBoundingClientRect();
      il = r.left; it = r.top;
      el.style.transition = 'none';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      el.style.left  = `${il + e.clientX - sx}px`;
      el.style.top   = `${it + e.clientY - sy}px`;
      el.style.right = 'auto';
    });

    document.addEventListener('mouseup', () => {
      dragging = false;
      el.style.transition = '';
    });
  }

  // ─── 工具 ─────────────────────────────────────────────────

  function escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

})();
