// Vercel Serverless Function — Groq text proxy for recalculating meal macros
// POST /api/recalc-meal
// Body: { items: ["300g Chicken Breast", "1 cup Rice", ...] }
// Returns: { items: [...], calories, protein, carbs, fats }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { items } = req.body || {};
  if (!items || !Array.isArray(items) || !items.length) {
    res.status(400).json({ error: 'items array is required' });
    return;
  }

  const apiKey = process.env.GROQ_API_KEY || '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';
  if (!apiKey) { res.status(500).json({ error: 'API key not configured' }); return; }

  const prompt = `You are a precise nutrition analyst. Here is a list of food items with quantities for ONE meal, as edited by a user:
${items.map(i => `- ${i}`).join('\n')}

Calculate realistic total nutrition for this meal (sum across all items).
Return ONLY valid JSON, compact, no markdown fences, no explanation, matching exactly this shape:
{"items":["cleaned item 1 with quantity","cleaned item 2 with quantity"],"calories":0,"protein":0,"carbs":0,"fats":0}

Rules:
- Keep the items list essentially as given (just clean up wording/typos). Do not invent new items and do not remove items the user wrote, unless a line is empty or nonsense.
- calories/protein/carbs/fats are numbers (protein/carbs/fats in grams) for the WHOLE meal combined.`;

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 1024,
        response_format: { type: "json_object" }
      })
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error('[recalc-meal] Groq error:', errText);
      res.status(502).json({ error: 'Groq API error', detail: errText });
      return;
    }

    const groqData = await groqRes.json();
    const rawText = groqData?.choices?.[0]?.message?.content || '';
    const cleaned = rawText.replace(/```json|```/g, '').trim();

    let result;
    try {
      result = JSON.parse(cleaned);
    } catch {
      res.status(502).json({ error: 'Could not parse response', raw: rawText });
      return;
    }

    res.status(200).json(result);
  } catch (err) {
    console.error('[recalc-meal] Unexpected error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}