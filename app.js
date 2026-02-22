/**
 * 心の相談室 - 自分だけの相談ノート
 * すべてのデータはこのデバイス内にのみ保存され、外部へ送信・公開されません
 */

const STORAGE_KEY = 'omayami-posts';
const AI_SETTINGS_KEY = 'omayami-ai-settings';

// 購入版：ホストされているURLか（file://でない）
const IS_HOSTED = typeof location !== 'undefined' && location.protocol.startsWith('http');

// カテゴリの日本語ラベル
const CATEGORY_LABELS = {
  work: '仕事・キャリア',
  relationship: '人間関係',
  love: '恋愛',
  family: '家族',
  health: '心と身体の健康',
  money: 'お金',
  future: '将来・進路',
  other: 'その他'
};

// ローカルストレージからデータ取得
function getPosts() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('データの読み込みに失敗しました:', e);
    return [];
  }
}

// ローカルストレージにデータ保存
function savePosts(posts) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
  } catch (e) {
    console.error('データの保存に失敗しました:', e);
  }
}

// ユニークID生成
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// DOM要素
const postTrigger = document.getElementById('postTrigger');
const postModal = document.getElementById('postModal');
const modalClose = document.getElementById('modalClose');
const postForm = document.getElementById('postForm');
const postsList = document.getElementById('postsList');
const emptyState = document.getElementById('emptyState');
const filterCategory = document.getElementById('filterCategory');
const detailModal = document.getElementById('detailModal');
const detailModalClose = document.getElementById('detailModalClose');
const detailContent = document.getElementById('detailContent');
const replyForm = document.getElementById('replyForm');
const replyToId = document.getElementById('replyToId');
const replyContent = document.getElementById('replyContent');

// AI設定
function getAISettings() {
  try {
    const data = localStorage.getItem(AI_SETTINGS_KEY);
    const defaultProvider = IS_HOSTED ? 'hosted' : 'openai';
    return data ? JSON.parse(data) : { provider: defaultProvider, apiKey: '', accessCode: '' };
  } catch (e) {
    return { provider: IS_HOSTED ? 'hosted' : 'openai', apiKey: '', accessCode: '' };
  }
}

function saveAISettings(settings) {
  localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(settings));
}

function hasValidAIConfig() {
  const s = getAISettings();
  if (s.provider === 'hosted') return !!s.accessCode?.trim();
  if (s.provider === 'openai') return !!s.apiKey?.trim();
  if (s.provider === 'ollama') return true;
  return false;
}

// 投稿を描画
function renderPosts(filter = '') {
  let posts = getPosts();
  
  // 新しい順にソート
  posts = posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  // フィルタ適用
  if (filter) {
    posts = posts.filter(p => p.category === filter);
  }

  postsList.innerHTML = '';

  if (posts.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  posts.forEach(post => {
    const card = document.createElement('div');
    card.className = 'post-card';
    card.dataset.id = post.id;
    
    const preview = post.content.length > 80 
      ? post.content.substring(0, 80) + '...' 
      : post.content;

    card.innerHTML = `
      <div class="post-card-header">
        <span class="category-badge category-${post.category}">${CATEGORY_LABELS[post.category]}</span>
        <span class="post-date">${formatDate(post.createdAt)}</span>
      </div>
      <h3 class="post-title">${escapeHtml(post.title)}</h3>
      <p class="post-preview">${escapeHtml(preview)}</p>
      <div class="post-meta">
        <span>📝 ${post.replies?.length || 0} 件のメモ</span>
        ${(post.aiChat && post.aiChat.length > 0) || post.aiResponse ? '<span class="ai-badge">🤖 チャットあり</span>' : ''}
        <span class="feeling-badge ${post.feelingBetter ? 'active' : ''}">${post.feelingBetter ? '✓ 少し楽になった' : '—'}</span>
      </div>
    `;

    card.addEventListener('click', () => openDetailModal(post.id));
    postsList.appendChild(card);
  });
}

// HTMLエスケープ
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 日付フォーマット
function formatDate(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return 'たった今';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}時間前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}日前`;
  
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// 投稿モーダルを開く
postTrigger.addEventListener('click', () => {
  postModal.classList.add('active');
  postForm.reset();
});

// モーダルを閉じる
function closePostModal() {
  postModal.classList.remove('active');
}

function closeDetailModal() {
  detailModal.classList.remove('active');
}

modalClose.addEventListener('click', closePostModal);
detailModalClose.addEventListener('click', closeDetailModal);

// 設定モーダル
const settingsTrigger = document.getElementById('settingsTrigger');
const settingsModal = document.getElementById('settingsModal');
const settingsModalClose = document.getElementById('settingsModalClose');
const settingsForm = document.getElementById('settingsForm');
const aiProvider = document.getElementById('aiProvider');
const accessCodeGroup = document.getElementById('accessCodeGroup');
const openaiKeyGroup = document.getElementById('openaiKeyGroup');
const ollamaInfo = document.getElementById('ollamaInfo');

// アクセスコードモーダル（購入者向け）
const accessCodeModal = document.getElementById('accessCodeModal');
const accessCodeForm = document.getElementById('accessCodeForm');

function showAccessCodeModalIfNeeded() {
  if (!IS_HOSTED) return;
  const s = getAISettings();
  if (s.provider === 'hosted' && !s.accessCode?.trim()) {
    accessCodeModal?.classList.add('active');
    return true;
  }
  return false;
}

accessCodeForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  const code = document.getElementById('accessCode').value.trim();
  if (!code) return;
  saveAISettings({ ...getAISettings(), provider: 'hosted', accessCode: code });
  accessCodeModal?.classList.remove('active');
});

document.getElementById('accessCodeLater')?.addEventListener('click', () => {
  accessCodeModal?.classList.remove('active');
});

settingsTrigger?.addEventListener('click', () => {
  const s = getAISettings();
  aiProvider.value = s.provider || 'hosted';
  document.getElementById('openaiKey').value = s.apiKey || '';
  const codeInput = document.getElementById('accessCodeSetting');
  if (codeInput) codeInput.value = s.accessCode || '';
  toggleProviderFields(aiProvider.value);
  settingsModal.classList.add('active');
});

settingsModalClose?.addEventListener('click', () => settingsModal.classList.remove('active'));
settingsModal?.addEventListener('click', (e) => {
  if (e.target === settingsModal) settingsModal.classList.remove('active');
});

aiProvider?.addEventListener('change', () => toggleProviderFields(aiProvider.value));

function toggleProviderFields(provider) {
  accessCodeGroup?.classList.toggle('hidden', provider !== 'hosted');
  openaiKeyGroup?.classList.toggle('hidden', provider !== 'openai');
  ollamaInfo?.classList.toggle('hidden', provider !== 'ollama');
}

settingsForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  saveAISettings({
    provider: aiProvider.value,
    apiKey: document.getElementById('openaiKey').value.trim(),
    accessCode: document.getElementById('accessCodeSetting')?.value.trim() || ''
  });
  settingsModal.classList.remove('active');
  alert('設定を保存しました。');
});

// モーダル外クリックで閉じる
postModal.addEventListener('click', (e) => {
  if (e.target === postModal) closePostModal();
});

detailModal.addEventListener('click', (e) => {
  if (e.target === detailModal) closeDetailModal();
});

// 投稿フォーム送信
postForm.addEventListener('submit', (e) => {
  e.preventDefault();
  
  const category = document.getElementById('category').value;
  const title = document.getElementById('title').value.trim();
  const content = document.getElementById('content').value.trim();

  if (!category || !title || !content) return;

  const posts = getPosts();
  const newPost = {
    id: generateId(),
    category,
    title,
    content,
    createdAt: new Date().toISOString(),
    replies: [],
    feelingBetter: false  // 自分用：「少し楽になった」の記録
  };

  posts.unshift(newPost);
  savePosts(posts);
  renderPosts(filterCategory.value);
  closePostModal();
});

// フィルタ変更
filterCategory.addEventListener('change', () => {
  renderPosts(filterCategory.value);
});

const SYSTEM_PROMPT = `あなたは温かく寄り添う相談相手です。ユーザーの悩みに、納得するまで丁寧に付き合ってください。
- まず気持ちを受け止める
- 押しつけがましくならない
- 具体的で実践的なアドバイスを
- ユーザーが「まだわからない」「もっと教えて」と言えば、何度でも詳しく答える
- 納得するまで会話を続けてよい`;

// AIチャットメッセージを取得（会話形式・納得するまで続けられる）
async function fetchAIChatMessage(postId, userMessage = null) {
  const posts = getPosts();
  const post = posts.find(p => p.id === postId);
  if (!post) return;

  const settings = getAISettings();
  const container = document.getElementById('aiChatContainer');
  const inputArea = document.getElementById('aiChatInputArea');

  if (settings.provider === 'hosted' && !settings.accessCode?.trim()) {
    showAccessCodeModalIfNeeded();
    return;
  }
  if (settings.provider === 'openai' && !settings.apiKey?.trim()) {
    alert('設定でOpenAIのAPIキーを入力してください。');
    return;
  }

  post.aiChat = post.aiChat || [];
  if (post.aiResponse) {
    post.aiChat = [{ role: 'assistant', content: post.aiResponse.content, createdAt: post.aiResponse.createdAt }];
    post.aiResponse = null;
  }

  if (userMessage) {
    post.aiChat.push({ role: 'user', content: userMessage, createdAt: new Date().toISOString() });
    savePosts(posts);
  }

  if (inputArea) {
    const inp = inputArea.querySelector('textarea');
    const btn = inputArea.querySelector('button');
    if (inp) inp.disabled = true;
    if (btn) btn.disabled = true;
  }

  const loadingEl = document.createElement('div');
  loadingEl.className = 'chat-msg chat-msg-ai chat-loading';
  loadingEl.innerHTML = '<span>🤔 考えています...</span>';
  container?.appendChild(loadingEl);
  container?.scrollTo(0, container.scrollHeight);

  try {
    let responseText = '';
    const apiMessages = [
      { role: 'user', content: `【悩み】\nタイトル: ${post.title}\n内容: ${post.content}` },
      ...post.aiChat.map(m => ({ role: m.role, content: m.content }))
    ];

    if (settings.provider === 'hosted' && IS_HOSTED) {
      const res = await fetch('/api/advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: post.title,
          content: post.content,
          accessCode: settings.accessCode.trim(),
          messages: apiMessages
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '接続に失敗しました');
      responseText = data.content || '応答を取得できませんでした。';
    } else if (settings.provider === 'ollama') {
      const res = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3.2',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...apiMessages
          ],
          stream: false
        })
      });
      if (!res.ok) throw new Error('Ollamaに接続できません。');
      const data = await res.json();
      responseText = data.message?.content || '応答を取得できませんでした。';
    } else {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.apiKey.trim()}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...apiMessages
          ],
          max_tokens: 600
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || 'APIエラー');
      responseText = data.choices?.[0]?.message?.content || '応答を取得できませんでした。';
    }

    loadingEl.remove();
    post.aiChat.push({ role: 'assistant', content: responseText, createdAt: new Date().toISOString() });
    savePosts(posts);
    openDetailModal(postId);
  } catch (err) {
    console.error(err);
    loadingEl.remove();
    const errEl = document.createElement('div');
    errEl.className = 'chat-msg chat-msg-ai ai-error';
    errEl.innerHTML = `❌ ${escapeHtml(err.message)}`;
    container?.appendChild(errEl);
    if (inputArea) {
      const inp = inputArea.querySelector('textarea');
      const btn = inputArea.querySelector('button');
      if (inp) inp.disabled = false;
      if (btn) btn.disabled = false;
    }
  }
}

// 詳細モーダルを開く
function openDetailModal(postId) {
  const posts = getPosts();
  const post = posts.find(p => p.id === postId);
  if (!post) return;

  replyToId.value = postId;
  replyContent.value = '';

  const hasChat = post.aiChat && post.aiChat.length > 0;
  const chatMsgs = (post.aiChat || []).map(m => `
    <div class="chat-msg chat-msg-${m.role}">
      <div class="chat-msg-content">${escapeHtml(m.content)}</div>
      <div class="chat-msg-date">${m.createdAt ? formatDate(m.createdAt) : ''}</div>
    </div>
  `).join('');

  detailContent.innerHTML = `
    <div class="detail-post">
      <div class="post-card-header">
        <span class="category-badge category-${post.category}">${CATEGORY_LABELS[post.category]}</span>
        <span class="post-date">${formatDate(post.createdAt)}</span>
      </div>
      <h3 class="post-title">${escapeHtml(post.title)}</h3>
      <div class="detail-content">${escapeHtml(post.content)}</div>
      <button class="feeling-btn ${post.feelingBetter ? 'active' : ''}" data-id="${post.id}" type="button">
        ${post.feelingBetter ? '✓ 少し楽になった' : '💚 少し楽になったらここを押す'}
      </button>
      <div class="ai-section ai-chat-section">
        <h4 class="ai-section-title">🤖 AIとチャット（納得するまで相談できます）</h4>
        <div id="aiChatContainer" class="chat-container">
          ${chatMsgs}
        </div>
        <div id="aiChatInputArea" class="chat-input-area">
          ${hasChat ? `
            <textarea id="aiChatInput" placeholder="続きを入力して送信...（納得するまで何度でもどうぞ）" rows="2"></textarea>
            <button type="button" id="aiChatSendBtn" class="btn-chat-send">送信</button>
          ` : `
            <button type="button" id="aiChatStartBtn" class="btn-ai-start">💬 AIとチャットを始める</button>
          `}
        </div>
      </div>
      <div class="reply-list" id="replyList">
        ${(post.replies || []).map(reply => `
          <div class="reply-item">
            <div class="reply-content">${escapeHtml(reply.content)}</div>
            <div class="reply-date">${formatDate(reply.createdAt)}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  const feelingBtn = detailContent.querySelector('.feeling-btn');
  feelingBtn.addEventListener('click', () => {
    const posts = getPosts();
    const targetPost = posts.find(p => p.id === postId);
    if (!targetPost) return;
    targetPost.feelingBetter = !targetPost.feelingBetter;
    savePosts(posts);
    openDetailModal(postId);
  });

  const startBtn = detailContent.querySelector('#aiChatStartBtn');
  if (startBtn) {
    startBtn.addEventListener('click', () => fetchAIChatMessage(postId));
  }

  const sendBtn = detailContent.querySelector('#aiChatSendBtn');
  const chatInput = detailContent.querySelector('#aiChatInput');
  if (sendBtn && chatInput) {
    const doSend = () => {
      const text = chatInput.value.trim();
      if (!text) return;
      chatInput.value = '';
      fetchAIChatMessage(postId, text);
    };
    sendBtn.addEventListener('click', doSend);
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        doSend();
      }
    });
  }

  detailModal.classList.add('active');
}

// 返信フォーム送信
replyForm.addEventListener('submit', (e) => {
  e.preventDefault();
  
  const postId = replyToId.value;
  const content = replyContent.value.trim();

  if (!postId || !content) return;

  const posts = getPosts();
  const post = posts.find(p => p.id === postId);
  if (!post) return;

  post.replies = post.replies || [];
  post.replies.push({
    id: generateId(),
    content,
    createdAt: new Date().toISOString()
  });

  savePosts(posts);
  openDetailModal(postId);  // 再描画
  replyContent.value = '';
});

// 初期表示
document.addEventListener('DOMContentLoaded', () => {
  const s = getAISettings();
  if (typeof toggleProviderFields === 'function') toggleProviderFields(s.provider);
  // 購入者（デプロイ済みURLから訪問）：初回だけアクセスコード入力を表示
  if (IS_HOSTED && s.provider === 'hosted' && !s.accessCode?.trim()) {
    accessCodeModal?.classList.add('active');
  }
  // ローカル利用者：APIキー未設定ならヒントを表示
  if (!IS_HOSTED && !s.apiKey?.trim() && !document.getElementById('localHint')) {
    const hint = document.createElement('div');
    hint.id = 'localHint';
    hint.className = 'local-hint';
    hint.innerHTML = '🤖 AIを使うには：右上の<span class="hint-icon">⚙️</span>をクリック → 「OpenAI」を選択 → APIキーを入力<br><small><a href="https://platform.openai.com/signup" target="_blank" rel="noopener">APIキーを無料で取得（$5分のクレジット付き）</a></small>';
    document.querySelector('.main-content')?.insertBefore(hint, document.querySelector('.post-section'));
  }
});
renderPosts();
