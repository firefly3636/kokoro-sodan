/**
 * 心の相談室 - AIチャットAPI
 * 納得するまでチャット形式で相談できる
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { title, content, accessCode, messages } = req.body || {};

  if (!title || !content) {
    return res.status(400).json({ error: 'タイトルと内容が必要です' });
  }

  const serverAccessCode = process.env.ACCESS_CODE;
  const apiKey = process.env.OPENAI_API_KEY;

  if (!serverAccessCode || !apiKey) {
    return res.status(500).json({ error: 'サーバー設定が完了していません' });
  }

  if (accessCode !== serverAccessCode) {
    return res.status(403).json({ error: 'アクセスコードが正しくありません' });
  }

  const systemPrompt = `あなたは温かく寄り添う相談相手です。ユーザーの悩みに、納得するまで丁寧に付き合ってください。
- まず気持ちを受け止める
- 押しつけがましくならない
- 具体的で実践的なアドバイスを
- ユーザーが「まだわからない」「もっと教えて」と言えば、何度でも詳しく答える
- 納得するまで会話を続けてよい`;

  const chatMessages = Array.isArray(messages) && messages.length > 0
    ? messages
    : [{ role: 'user', content: `【悩み】\nタイトル: ${title}\n内容: ${content}` }];

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...chatMessages
        ],
        max_tokens: 600
      })
    });

    const data = await response.json();

    if (data.error) {
      return res.status(502).json({ error: data.error.message || 'AIの応答に失敗しました' });
    }

    const text = data.choices?.[0]?.message?.content || '応答を取得できませんでした';
    return res.status(200).json({ content: text });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '接続エラーが発生しました' });
  }
}
