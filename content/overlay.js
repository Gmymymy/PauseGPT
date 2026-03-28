/**
 * PauseGPT - Chat Overlay（流式输出版）
 */

(function () {

  const OVERLAY_ID = 'techlens-overlay';

  let currentFrameData = null;
  let messageHistory   = [];
  let isWaiting        = false;
  let streamingEl      = null;  // 当前正在流式写入的气泡元素
  let streamingText    = '';    // 累积的完整回答

  // ─── 监听 Service Worker 推来的流式消息 ──────────────────

  chrome.runtime.onMessage.addListener((msg) => {
    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) return;

    if (msg.type === 'STREAM_CHUNK') {
      // 逐字追加
      if (streamingEl) {
        streamingText += msg.chunk;
        streamingEl.querySelector('.tl-stream-content').innerHTML = formatText(streamingText);
        const list = overlay.querySelector('.tl-messages');
        list.scrollTop = list.scrollHeight;
      }
    }

    if (msg.type === 'STREAM_DONE') {
      // 流结束，解析 SEARCH: 关键词，加搜索按钮
      if (streamingEl) {
        // 提取 SEARCH: 关键词
        const searchMatch = streamingText.match(/SEARCH:(.*)$/m);
        const searchKeyword = searchMatch ? searchMatch[1].trim() : '';
        // 从显示文本中移除 SEARCH: 行
        const displayText = streamingText.replace(/\nSEARCH:.*$/m, '').trim();

        // 更新气泡内容（去掉 SEARCH 行）
        streamingEl.querySelector('.tl-stream-content').innerHTML = formatText(displayText);
        // 移除光标
        streamingEl.querySelector('.tl-cursor')?.remove();

        // 加搜索按钮（只有有关键词才显示）
        if (searchKeyword) {
          const searchUrl = `https://www.baidu.com/s?wd=${encodeURIComponent(searchKeyword)}`;
          const searchBar = document.createElement('div');
          searchBar.className = 'tl-search-bar';
          searchBar.innerHTML = `<a class="tl-search-btn" href="${searchUrl}" target="_blank" rel="noopener">🔍 搜索「${searchKeyword}」</a>`;
          streamingEl.querySelector('.tl-msg-bubble').appendChild(searchBar);
        }

        // 存入历史时用清理后的文本
        messageHistory.push({ role: 'assistant', content: displayText });
        streamingEl  = null;
        streamingText = '';
      }
      isWaiting = false;
      setSendState(overlay, false);
      overlay.querySelector('.tl-input')?.focus();
    }

    if (msg.type === 'STREAM_ERROR') {
      if (streamingEl) {
        streamingEl.remove();
        streamingEl  = null;
        streamingText = '';
      }
      appendError(overlay, msg.error);
      isWaiting = false;
      setSendState(overlay, false);
      overlay.querySelector('.tl-input')?.focus();
    }
  });

  // ─── 入口 ─────────────────────────────────────────────────

  window.openChatOverlay = function (frameData) {
    currentFrameData = frameData;
    messageHistory   = [];
    isWaiting        = false;
    streamingEl      = null;
    streamingText    = '';

    document.getElementById(OVERLAY_ID)?.remove();
    const overlay = buildOverlay();
    document.body.appendChild(overlay);
    makeDraggable(overlay);
    setTimeout(() => overlay.querySelector('.tl-input')?.focus(), 100);
  };

  // ─── 构建浮窗 DOM ─────────────────────────────────────────

  function buildOverlay() {
    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;

    overlay.innerHTML = `
      <div class="tl-header">
        <div class="tl-title"><span class="tl-icon">⏸</span><span>PauseGPT</span></div>
        <div class="tl-header-actions">
          <button class="tl-new-btn" title="截取新画面">🔄 新画面</button>
          <button class="tl-close-btn" title="关闭">✕</button>
        </div>
      </div>
      <div class="tl-thumb-bar">
        <img class="tl-thumb" src="" alt="当前帧" />
        <span class="tl-thumb-hint">基于此帧提问 · 可多轮追问</span>
      </div>
      <div class="tl-messages" id="tl-messages">
        <div class="tl-welcome">
          💬 问我关于这个画面的任何问题<br>
          <span class="tl-examples">例：这个人是谁？ · 跳的什么舞？ · 这里用了什么技术？</span>
        </div>
      </div>
      <div class="tl-input-bar">
        <textarea class="tl-input" placeholder="输入问题，Enter 发送，Shift+Enter 换行" rows="2"></textarea>
        <button class="tl-send-btn" title="发送">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M22 2L11 13" stroke="white" stroke-width="2" stroke-linecap="round"/>
            <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="white" stroke-width="2" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    `;

    overlay.querySelector('.tl-thumb').src = currentFrameData;

    overlay.querySelector('.tl-close-btn').addEventListener('click', () => overlay.remove());

    overlay.querySelector('.tl-new-btn').addEventListener('click', () => {
      overlay.remove();
      setTimeout(() => {
        const video = document.querySelector('video');
        if (!video) return;
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, 1920 / video.videoWidth);
        canvas.width  = Math.floor(video.videoWidth  * scale);
        canvas.height = Math.floor(video.videoHeight * scale);
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
        window.openChatOverlay(canvas.toDataURL('image/jpeg', 0.92));
      }, 100);
    });

    const textarea = overlay.querySelector('.tl-input');
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(overlay); }
    });
    overlay.querySelector('.tl-send-btn').addEventListener('click', () => sendMessage(overlay));

    document.addEventListener('keydown', function escHandler(e) {
      if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', escHandler); }
    });

    return overlay;
  }

  // ─── 发送消息（流式版）────────────────────────────────────

  function sendMessage(overlay) {
    if (isWaiting) return;

    const textarea = overlay.querySelector('.tl-input');
    const text = textarea.value.trim();
    if (!text) return;

    textarea.value = '';
    overlay.querySelector('.tl-messages').querySelector('.tl-welcome')?.remove();

    messageHistory.push({ role: 'user', content: text });
    appendMessage(overlay, 'user', text);

    // 创建空的 AI 气泡，准备流式填充
    streamingText = '';
    streamingEl = appendStreamingBubble(overlay);

    isWaiting = true;
    setSendState(overlay, true);

    // 每轮都带图片，让模型始终能看见画面
    chrome.runtime.sendMessage({
      type: 'CHAT_STREAM',
      imageData: currentFrameData,
      messages: [...messageHistory]
    });
  }

  // ─── 消息渲染 ─────────────────────────────────────────────

  function appendMessage(overlay, role, text) {
    const list = overlay.querySelector('.tl-messages');
    const el = document.createElement('div');
    el.className = `tl-msg tl-msg-${role}`;
    el.innerHTML = `<div class="tl-msg-bubble">${formatText(text)}</div>`;
    list.appendChild(el);
    list.scrollTop = list.scrollHeight;
  }

  function appendStreamingBubble(overlay) {
    const list = overlay.querySelector('.tl-messages');
    const el = document.createElement('div');
    el.className = 'tl-msg tl-msg-assistant';
    el.innerHTML = `
      <div class="tl-msg-bubble">
        <span class="tl-stream-content"></span>
        <span class="tl-cursor">▋</span>
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
    const btn = overlay.querySelector('.tl-send-btn');
    const inp = overlay.querySelector('.tl-input');
    btn.disabled = disabled;
    inp.disabled = disabled;
    btn.style.opacity = disabled ? '0.4' : '1';
    // 流式时隐藏光标
    const cursor = overlay.querySelector('.tl-cursor');
    if (cursor) cursor.style.display = disabled ? 'inline' : 'none';
  }

  // ─── 文本格式化 ───────────────────────────────────────────

  function formatText(text) {
    return escHtml(text)
      .replace(/```([\s\S]*?)```/g, '<pre class="tl-inline-code">$1</pre>')
      .replace(/`([^`]+)`/g, '<code class="tl-code">$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }

  // ─── 拖动 ─────────────────────────────────────────────────

  function makeDraggable(el) {
    const header = el.querySelector('.tl-header');
    let dragging = false, sx, sy, il, it;
    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('button')) return;
      dragging = true; sx = e.clientX; sy = e.clientY;
      const r = el.getBoundingClientRect(); il = r.left; it = r.top;
      el.style.transition = 'none'; e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      el.style.left = `${il + e.clientX - sx}px`;
      el.style.top  = `${it + e.clientY - sy}px`;
      el.style.right = 'auto';
    });
    document.addEventListener('mouseup', () => { dragging = false; el.style.transition = ''; });
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
