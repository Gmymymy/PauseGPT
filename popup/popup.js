/**
 * TechLens - Popup Script
 * 管理 API Key 的保存和读取
 */

const apiKeyInput  = document.getElementById('api-key-input');
const toggleBtn    = document.getElementById('toggle-btn');
const saveBtn      = document.getElementById('save-btn');
const saveFeedback = document.getElementById('save-feedback');
const statusBar    = document.getElementById('status-bar');
const statusText   = document.getElementById('status-text');

// ─── 初始化：读取已保存的 API Key ─────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get(['apiKey'], (data) => {
    if (data.apiKey) {
      apiKeyInput.value = data.apiKey;
      setStatus('ok', 'API Key 已配置，可以使用');
    } else {
      setStatus('warn', '请配置 API Key 后使用');
    }
  });
});

// ─── 显示/隐藏 API Key ────────────────────────────────────

toggleBtn.addEventListener('click', () => {
  const isPassword = apiKeyInput.type === 'password';
  apiKeyInput.type = isPassword ? 'text' : 'password';
  toggleBtn.textContent = isPassword ? '🙈' : '👁';
});

// ─── 保存 API Key ─────────────────────────────────────────

saveBtn.addEventListener('click', () => {
  const key = apiKeyInput.value.trim();

  if (!key) {
    showFeedback('❌ 请输入 API Key', 'error');
    return;
  }

  if (!key.startsWith('sk-')) {
    showFeedback('⚠️ API Key 格式不正确，应以 sk- 开头', 'warn');
    return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = '保存中...';

  chrome.storage.sync.set({ apiKey: key }, () => {
    if (chrome.runtime.lastError) {
      showFeedback('❌ 保存失败，请重试', 'error');
    } else {
      showFeedback('✅ 保存成功', 'success');
      setStatus('ok', 'API Key 已配置，可以使用');
    }

    saveBtn.disabled = false;
    saveBtn.textContent = '保存设置';
  });
});

// ─── 回车键保存 ───────────────────────────────────────────

apiKeyInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') saveBtn.click();
});

// ─── 工具函数 ─────────────────────────────────────────────

function setStatus(type, text) {
  statusBar.className = `status-bar status-${type}`;
  statusText.textContent = text;
}

function showFeedback(message, type) {
  const colors = { success: '#81c784', error: '#e57373', warn: '#ffd54f' };
  saveFeedback.textContent = message;
  saveFeedback.style.color = colors[type] || '#e0e0e0';
  setTimeout(() => { saveFeedback.textContent = ''; }, 3000);
}
