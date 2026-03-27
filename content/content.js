/**
 * TechLens - Content Script (多轮对话版)
 */

(function () {
  if (window.__techlens_injected) return;
  window.__techlens_injected = true;

  console.log('[TechLens] 已注入 B 站视频页面');

  // ─── 截帧 ────────────────────────────────────────────────────

  function getVideoElement() {
    let video = document.querySelector('video');
    if (video) return video;
    for (const iframe of document.querySelectorAll('iframe')) {
      try {
        video = iframe.contentDocument?.querySelector('video');
        if (video) return video;
      } catch (e) {}
    }
    return null;
  }

  function captureVideoFrame() {
    const video = getVideoElement();
    if (!video) { showToast('❌ 未找到视频元素'); return null; }
    if (video.readyState < 2) { showToast('❌ 视频尚未加载完成'); return null; }

    const canvas = document.createElement('canvas');
    const scale  = Math.min(1, 1280 / video.videoWidth);
    canvas.width  = Math.floor(video.videoWidth  * scale);
    canvas.height = Math.floor(video.videoHeight * scale);
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.75);
  }

  // ─── 触发入口 ─────────────────────────────────────────────────

  function triggerChat() {
    // 如果对话框已打开，直接聚焦输入框
    const existing = document.getElementById('techlens-overlay');
    if (existing) {
      existing.querySelector('.tl-input')?.focus();
      return;
    }

    const frameData = captureVideoFrame();
    if (!frameData) return;

    // 打开对话浮窗，传入截帧数据
    window.openChatOverlay(frameData);
  }

  // ─── 快捷键 Alt+T ─────────────────────────────────────────────

  document.addEventListener('keydown', (e) => {
    if (e.altKey && e.key === 't') {
      e.preventDefault();
      e.stopPropagation();
      triggerChat();
    }
  });

  // ─── 悬浮按钮 ─────────────────────────────────────────────────

  function injectFloatButton() {
    if (document.getElementById('techlens-btn')) return;
    const btn = document.createElement('div');
    btn.id = 'techlens-btn';
    btn.title = '和 AI 聊聊这个画面 (Alt+T)';
    btn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="11" cy="11" r="7" stroke="white" stroke-width="2"/>
        <path d="m16.5 16.5 3.5 3.5" stroke="white" stroke-width="2" stroke-linecap="round"/>
        <circle cx="11" cy="11" r="3" fill="white"/>
      </svg>
    `;
    btn.addEventListener('click', triggerChat);
    document.body.appendChild(btn);
  }

  // ─── Toast ────────────────────────────────────────────────────

  function showToast(message) {
    document.getElementById('techlens-toast')?.remove();
    const toast = document.createElement('div');
    toast.id = 'techlens-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  // ─── 等待播放器 ───────────────────────────────────────────────

  function waitForPlayer() {
    const observer = new MutationObserver(() => {
      if (getVideoElement()) { injectFloatButton(); observer.disconnect(); }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    if (getVideoElement()) { injectFloatButton(); observer.disconnect(); }
  }

  // B 站 SPA 路由变化重新注入
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(() => {
        document.getElementById('techlens-btn')?.remove();
        document.getElementById('techlens-overlay')?.remove();
        waitForPlayer();
      }, 2000);
    }
  }).observe(document, { subtree: true, childList: true });

  waitForPlayer();

})();
