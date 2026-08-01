// Vercel Serverless Function — Groq vision food scan proxy
// POST /api/scan-food
// Body: { imageBase64: string, mimeType: string }
// Returns: { name, calories, protein, carbs, fats, fiber, servingSize, confidence, notes }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { imageBase64, mimeType = 'image/jpeg' } = req.body || {};
  if (!imageBase64) { res.status(400).json({ error: 'imageBase64 is required' }); return; }

  const apiKey = process.env.GROK_API_KEY || process.env.GROQ_API_KEY || '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';
  if (!apiKey) { res.status(500).json({ error: 'API key not configured' }); return; }

  const prompt = `You are a precise nutrition analyst. Analyze this food image and return ONLY a valid JSON object with these exact fields:
{"name":"food name (be specific)","calories":<kcal>,"protein":<g>,"carbs":<g>,"fats":<g>,"fiber":<g or null>,"servingSize":"<estimated portion>","confidence":"<high|medium|low>","notes":"<brief note>"}
Return ONLY the JSON, no markdown, no explanation.
Analyze the food image and estimate macronutrients for a standard single serving (~200g-250g for burgers). Calculate total calories strictly using the formula: Calories = (Protein * 4) + (Carbs * 4) + (Fat * 9).
Keep your thinking process (<think> block) extremely short (under 15 words) to optimize tokens. Do not write a long analysis.`;

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'qwen/qwen3.6-27b',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } }
          ]
        }],
        temperature: 0.1,
        max_tokens: 2048
      })
    });

    console.log('[scan-food] Groq response status:', groqRes.status);

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error('[scan-food] Groq error:', errText);
      res.status(502).json({ error: 'Groq API error', detail: errText });
      return;
    }

    const groqData = await groqRes.json();
    const rawText = groqData?.choices?.[0]?.message?.content || '';
    console.log('[scan-food] Groq Raw Text:', rawText);
    
    // Strip reasoning <think>...</think> tags
    let cleaned = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    cleaned = cleaned.replace(/```json|```/g, '').trim();

    // Extract JSON block
    const jsonStart = cleaned.indexOf('{');
    const jsonEnd = cleaned.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
    }
    console.log('[scan-food] Cleaned Text:', cleaned);

    let nutrition;
    try {
      nutrition = JSON.parse(cleaned);
    } catch (e) {
      console.error('[scan-food] JSON Parse Error. Raw:', rawText, 'Cleaned:', cleaned, 'Error:', e);
      res.status(502).json({ error: 'Could not parse response', raw: rawText, cleaned });
      return;
    }

    res.status(200).json(nutrition);
  } catch (err) {
    console.error('[scan-food] Unexpected error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
