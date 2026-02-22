module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  var body = req.body || {};
  var title = body.title;
  var content = body.content;
  var accessCode = body.accessCode;
  var messages = body.messages;
  if (!title || !content) {
    return res.status(400).json({ error: 'タイトルと内容が必要です' });
  }
  var serverAccessCode = process.env.ACCESS_CODE;
  var apiKey = process.env.OPENAI_API_KEY;
  if (!serverAccessCode || !apiKey) {
    return res.status(500).json({ error: 'サーバー設定が完了していません' });
  }
  if (accessCode !== serverAccessCode) {
    return res.status(403).json({ error: 'アクセスコードが正しくありません' });
  }
  var systemPrompt = 'あなたは温かく寄り添う相談相手です。ユーザーの悩みに、納得するまで丁寧に付き合ってください。まず気持ちを受け止め、押しつけがましくならず、具体的で実践的なアドバイスをしてください。';
  var chatMessages = Array.isArray(messages) && messages.length > 0
    ? messages
    : [{ role: 'user', content: '【悩み】\nタイトル: ' + title + '\n内容: ' + content }];
  try {
    var response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt }
        ].concat(chatMessages),
        max_tokens: 600
      })
    });
    var data = await response.json();
    if (data.error) {
      return res.status(502).json({ error: data.error.message || 'AIの応答に失敗しました' });
    }
    var text = data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : '応答を取得できませんでした';
    return res.status(200).json({ content: text });
  } catch (err) {
    return res.status(500).json({ error: '接続エラーが発生しました' });
  }
};
