/**
 * PauseGPT - Background Service Worker
 * 支持流式输出：逐 token 推送给 content script
 */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'CHAT_STREAM') {
    // 流式对话：不用 sendResponse，直接往 tab 推消息
    chatStream(msg.imageData, msg.messages, sender.tab.id);
    sendResponse({ started: true });
    return true;
  }

  if (msg.type === 'GET_SETTINGS') {
    chrome.storage.sync.get(['apiKey'], (data) => sendResponse(data));
    return true;
  }
});

const SYSTEM_PROMPT = `你是一个视频画面分析助手，具备以下能力：
1. 识别画面中的人物（明星、公众人物、历史人物等）
2. 识别技术工具、软件界面、编程框架、云平台等
3. 识别舞蹈风格、体育运动、艺术形式等
4. 识别地点、场景、建筑风格等
5. 提取画面中的文字、代码、数据等

回答要求：
- 直接给出答案，简洁重点突出，支持多轮追问
- 如果对人物身份不确定，必须明确说明，例如「从外貌特征判断可能是XXX，但不确定，建议搜索确认」
- 如果完全无法识别，直接说「无法确认此人身份」，不要猜测
- 对场景、工具、技术类问题可以更自信地回答
- 绝对不要给出听起来确定但实际可能错误的人物姓名
- 在每次回答的最后一行，用以下固定格式输出搜索关键词（仅人名、工具名、地名等核心词，不超过10个字）：
  SEARCH:关键词
  例如：SEARCH:单依纯 歌手
  例如：SEARCH:VSCode 编辑器
  如果没有明确识别对象则输出：SEARCH:`;

async function chatStream(imageData, messages, tabId) {
  const { apiKey } = await chrome.storage.sync.get('apiKey');

  if (!apiKey || !apiKey.trim()) {
    chrome.tabs.sendMessage(tabId, {
      type: 'STREAM_ERROR',
      error: '请先点击插件图标，在设置中填入 API Key'
    });
    return;
  }

  const apiMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages.map((m, idx) => {
      if (m.role === 'user' && idx === 0 && imageData) {
        // 第一条用户消息带图片
        return {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageData } },
            { type: 'text', text: m.content }
          ]
        };
      }
      return { role: m.role, content: m.content };
    })
  ];

  try {
    const response = await fetch(
      'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'qwen-vl-max-2025-08-13',
          messages: apiMessages,
          max_tokens: 1500,
          temperature: 0.3,
          stream: true  // 开启流式
        })
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      chrome.tabs.sendMessage(tabId, {
        type: 'STREAM_ERROR',
        error: `API 请求失败 (${response.status})：${errText.slice(0, 150)}`
      });
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // 保留不完整的行

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (!trimmed.startsWith('data: ')) continue;

        try {
          const json = JSON.parse(trimmed.slice(6));
          const chunk = json.choices?.[0]?.delta?.content;
          if (chunk) {
            chrome.tabs.sendMessage(tabId, {
              type: 'STREAM_CHUNK',
              chunk
            });
          }
        } catch (e) {
          // 解析失败跳过
        }
      }
    }

    // 流结束
    chrome.tabs.sendMessage(tabId, { type: 'STREAM_DONE' });

  } catch (err) {
    chrome.tabs.sendMessage(tabId, {
      type: 'STREAM_ERROR',
      error: `请求失败：${err.message}`
    });
  }
}
