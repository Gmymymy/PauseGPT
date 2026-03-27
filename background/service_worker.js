/**
 * TechLens v1 - Background Service Worker（纯插件版）
 * 直连阿里云 DashScope，无需启动后端服务
 */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'CHAT') {
    chat(msg.imageData, msg.messages)
      .then(sendResponse)
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (msg.type === 'GET_SETTINGS') {
    chrome.storage.sync.get(['apiKey'], (data) => sendResponse(data));
    return true;
  }
});

async function chat(imageData, messages) {
  const { apiKey } = await chrome.storage.sync.get('apiKey');

  if (!apiKey || !apiKey.trim()) {
    return {
      success: false,
      error: '请先点击插件图标，在设置中填入阿里云 DashScope API Key'
    };
  }

  const systemPrompt = `你是一个视频画面分析助手，具备以下能力：
1. 识别画面中的人物（明星、公众人物、历史人物等）
2. 识别技术工具、软件界面、编程框架、云平台等
3. 识别舞蹈风格、体育运动、艺术形式等
4. 识别地点、场景、建筑风格等
5. 提取画面中的文字、代码、数据等

回答要求：直接给出答案，简洁重点突出，支持多轮追问。`;

  const apiMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map((m, idx) => {
      if (m.role === 'user' && idx === 0 && imageData) {
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
          temperature: 0.3
        })
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      return {
        success: false,
        error: `API 请求失败 (${response.status})：${errText.slice(0, 150)}`
      };
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content;
    if (!answer) return { success: false, error: 'API 返回内容为空' };

    return { success: true, answer };

  } catch (err) {
    return { success: false, error: `请求失败：${err.message}` };
  }
}
