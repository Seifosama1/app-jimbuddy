// Vercel Serverless Function — Groq vision food scan proxy
// POST /api/scan-food
// Body: { imageBase64: string, mimeType: string }
// Returns: { name, calories, protein, carbs, fats, fiber, servingSize, confidence, notes }

import { fetchWithGroqPool } from './groq-pool.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { imageBase64, mimeType = 'image/jpeg' } = req.body || {};
  if (!imageBase64) { res.status(400).json({ error: 'imageBase64 is required' }); return; }

  // Guard: reject oversized payloads (>10 MB base64 ≈ ~7.5 MB image)
  if (imageBase64.length > 10_000_000) {
    res.status(413).json({ error: 'Image is too large. Please use a photo under 7 MB.' });
    return;
  }

  // Guard: only allow safe image MIME types
  const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const safeMime = ALLOWED_MIMES.includes(mimeType) ? mimeType : 'image/jpeg';

  const prompt = `You are a precise nutrition analyst. Analyze this food image.
Identify the food and use a REALISTIC serving size appropriate for that specific food:
- Snack bags/chips/puffs: 30g (one small handful)
- Burgers/sandwiches: 1 whole item (~200g)
- Rice/pasta dishes: 1 cup cooked (~180g)
- Fruits: 1 piece (actual size)
- Drinks: 1 glass (~250ml)
Do NOT apply a burger serving size to snacks or other foods.

STEP 1: Estimate protein (g), carbs (g), fats (g), fiber (g) for that serving.
STEP 2: Calculate calories STRICTLY using this formula: calories = (protein * 4) + (carbs * 4) + (fats * 9). Do not guess calories — compute them from the macros.

Return ONLY a valid JSON object with these exact fields (no markdown, no explanation):
{"name":"food name","calories":<computed kcal>,"protein":<g>,"carbs":<g>,"fats":<g>,"fiber":<g or null>,"servingSize":"<e.g. 30g or 1 whole burger>","confidence":"<high|medium|low>","notes":"<one sentence>"}
Keep your <think> block under 10 words.`;

  try {
    const payload = {
      model: 'qwen/qwen3.8-27b',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:${safeMime};base64,${imageBase64}` } }
        ]
      }],
      temperature: 0.1,
      max_tokens: 2048
    };

    const groqRes = await fetchWithGroqPool(payload);

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error('[scan-food] Groq error:', errText);

      let userMessage = 'The AI service is temporarily unavailable. Please try again.';
      try {
        const errJson = JSON.parse(errText);
        const code = errJson?.error?.code || '';
        const msg  = errJson?.error?.message || '';
        if (groqRes.status === 429 || code === 'rate_limit_exceeded') {
          userMessage = 'Too many scans too quickly. Please wait a few seconds and try again.';
        } else if (groqRes.status === 401 || code === 'invalid_api_key') {
          userMessage = 'AI service authentication failed. Please contact support.';
        } else if (msg.toLowerCase().includes('image')) {
          userMessage = 'Could not read the image. Please try a clearer photo.';
        } else if (groqRes.status === 503 || groqRes.status === 504) {
          userMessage = 'The AI service is overloaded right now. Please try again in a moment.';
        }
      } catch (_) {}

      res.status(502).json({ error: userMessage });
      return;
    }

    const groqData = await groqRes.json();
    const rawText = groqData?.choices?.[0]?.message?.content || '';
    console.log('[scan-food] Groq Raw Text (first 200):', rawText.slice(0, 200));
    
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
      console.error('[scan-food] JSON Parse Error. Raw (first 200):', rawText.slice(0, 200), 'Error:', e.message);
      res.status(502).json({ error: 'The AI returned an unexpected response. Please try again.' });
      return;
    }

    res.status(200).json(nutrition);
  } catch (err) {
    console.error('[scan-food] Unexpected error:', err);
    res.status(500).json({ error: 'Something went wrong on our end. Please try again.' });
  }
}
