// Vercel Serverless Function — Groq text proxy for AI diet plan generation
// POST /api/generate-diet
// Body: { targetCal, targetP, targetC, targetF, days }
// Returns: { days: [ { day, meals: { breakfast, lunch, dinner, snack1, snack2 } }, ... ] }

import { fetchWithGroqPool } from './groq-pool.js';

// In-memory + persistent fallback bucket cache
// Key format: "cal_2000" (rounded to nearest 100 kcal) -> { plan, cachedAt }
const _dietCache = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const {
    targetCal = 2000,
    targetP = 150,
    targetC = 200,
    targetF = 55,
    days = 7,
    forceRefresh = false
  } = req.body || {};

  // Clamp inputs to safe realistic ranges to prevent prompt injection / abuse
  const safeCal  = Math.min(Math.max(Number(targetCal) || 2000, 500),  10000);
  const safeP    = Math.min(Math.max(Number(targetP)   || 150,  10),   500);
  const safeC    = Math.min(Math.max(Number(targetC)   || 200,  10),   1000);
  const safeF    = Math.min(Math.max(Number(targetF)   || 55,   5),    300);

  // ── Smart Calorie Bucket Caching ──────────────────────────────────────────
  // Round to nearest 100 kcal (e.g. 2160 -> 2200, 1980 -> 2000)
  const calorieBucket = Math.round(safeCal / 100) * 100;
  const cacheKey = `bucket_${calorieBucket}`;

  if (!forceRefresh) {
    const cached = _dietCache.get(cacheKey);
    if (cached && (Date.now() - cached.cachedAt < CACHE_TTL_MS)) {
      console.log(`[generate-diet] Cache HIT for bucket ${cacheKey} (0 tokens used)`);
      res.status(200).json({ ...cached.plan, _cached: true, _bucket: calorieBucket });
      return;
    }
  }

  const prompt = `Create a 7-day healthy meal plan for someone eating exactly ${calorieBucket} kcal per day.

FOOD SELECTION RULES :
- Build the plan almost entirely around plain, everyday staple foods that ordinary people eat daily like these foods : chicken breasts or panne or chicken thighs and all chicken variations, eggs and its variations like ommlete and scrambled, oats and granola , white/basmati rice, bread (toast ,fino , tortilla , etc), potatoes and mashed potatoes and sweet potatos, pasta or macaroni variations, milk, yogurt or greek yoghurt, cheese variations, common fruit (banana, apple, orange, avocado like 1 - 2 times a week), common vegetables (broccoli, spinach, bamya, cucumber, salad), peanut butter, beans(only beans no green beans), nuts and cashew variations.
- Chicken breast should be the DEFAULT protein for most lunches/dinners. Fish (salmon, tuna, etc.) may appear in AT MOST 1 meal across the entire plan - do not use fish repeatedly or as a frequent staple.
- Red meat (beef, lamb ,steak ,etc) may appear occasionally (max 1-2 times across the whole plan), not as a daily staple.
- Do NOT use rare, festive, restaurant-style, or heavy/greasy dishes (e.g.Om ali, quinao, koshary, shish taouk, feteer, mahshi, kunafa, fried foods, fast food, sugary desserts) - this is a clean everyday diet plan, not a treat/cheat plan.
- Favor whole, minimally processed foods over processed ones. Avoid excessive added sugar, deep-fried items, and overly complex recipes.
- Each day has 3-5 meals: breakfast, lunch, dinner, snack1 (3-5 times a week), snack2(optional (add it onlyyy 2 times a week)).but complete the kcal goal
- Do NOT leave any day or meal empty except snack 2 as we said. Fully generate all 7 days.
- Each meal should be represented by a short label and a list of food items with realistic quantities.
- feel free to add supplements especially at snack meals and add diet related products and make the quantities logical for each food and avoid foods like (mixed vegetables or steamed vegetable) be more direct and clear.
- feel free to add what you want to add (70% from the foods i suggested , 30% from foods you suggest).
- Avoid adding (quinao) and (hummus) to lunch and tomatoes and carrots to snack because nobody eats them replace them you can replace quinao with whey protien scoop and replace tomatoes with nuts and cashew as snack meal to get fats.
- Last thing make sure that friday ,saturday and sunday are complete because sometimes you generate them uncomplete

**HIGHEST PRIORITY: CALORIE TARGET**
- Every single day must total **close to ${calorieBucket} kcal** (minimum ${calorieBucket-200}, ideally ${calorieBucket}).
- Use **generous, realistic portions** of rice, chicken, oats, pasta, potatoes, etc. to reach the target.
- Do not make small/light meals. Make breakfast, lunch, and dinner filling.

**VERY STRICT FORMATTING RULES - NO MULTIPLIERS EVER:**

- Quantities must ALWAYS be direct, human, real-life food amounts ready to eat as 1 serving, for example:
  - "300gm white rice" or "200gm grilled chicken breast"
  - "2 cups greek yogurt" or "1 cup milk (2%)"
  - "3 bananas" or "2 medium apples"
  - "2 spoons natural peanut butter"
  - "4 boiled eggs" or "2 slices fino bread"
- Each item should already be the full intended amount for that meal so it is eaten as 1x meal portion.
- **NEVER** output multipliers like "1.5x", "2.2x", or decimal servings in item names.

Return **ONLY** valid compact JSON matching this shape:

{
  "days": [
    {
      "day": "Monday",
      "meals": {
        "breakfast": {
          "label": "Oatmeal Breakfast",
          "items": ["150 grams cooked oats", "1 large banana", "30 grams whey protein", "1 cup milk (2%)"]
        },
        ...
      }
    }
  ]
}

Make sure each day's total calories/macros roughly sum to the targets above at any cost even if the sunday will be  missing .`;

  try {
    const payload = {
      model: 'qwen/qwen3.8-27b',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 4096,
      response_format: { type: "json_object" }
    };

    const groqRes = await fetchWithGroqPool(payload);

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error('[generate-diet] Groq error:', errText);
      let userMessage = 'The AI service is temporarily unavailable. Please try again.';
      try {
        const errJson = JSON.parse(errText);
        const code = errJson?.error?.code || '';
        if (code === 'rate_limit_exceeded' || groqRes.status === 429)
          userMessage = 'Too many requests across all keys. Please wait a moment and try again.';
        else if (groqRes.status === 401 || groqRes.status === 403)
          userMessage = 'AI service authentication error. Please contact support.';
        else if (groqRes.status === 503 || groqRes.status === 504)
          userMessage = 'The AI service is overloaded. Please try again in a moment.';
      } catch (_) {}
      res.status(502).json({ error: userMessage });
      return;
    }

    const groqData = await groqRes.json();
    const rawText = groqData?.choices?.[0]?.message?.content || '';
    const cleaned = rawText.replace(/```json|```/g, '').trim();

    let plan;
    try {
      plan = JSON.parse(cleaned);
    } catch {
      res.status(502).json({ error: 'The AI returned an unexpected response. Please try again.' });
      return;
    }

    if (!plan.days || !Array.isArray(plan.days)) {
      res.status(502).json({ error: 'The AI returned an incomplete plan. Please try again.' });
      return;
    }

    // Save plan into bucket cache (saves 100% of future tokens for this calorie tier)
    _dietCache.set(cacheKey, { plan, cachedAt: Date.now() });
    console.log(`[generate-diet] Saved new plan to bucket ${cacheKey} in memory cache.`);

    res.status(200).json({ ...plan, _bucket: calorieBucket });
  } catch (err) {
    console.error('[generate-diet] Unexpected error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}