// Vercel Serverless Function — Groq text proxy for AI diet plan generation
// POST /api/generate-diet
// Body: { targetCal, targetP, targetC, targetF, days }
// Returns: { days: [ { day, meals: { breakfast, lunch, dinner, snack1, snack2 } }, ... ] }

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
    days = 7
  } = req.body || {};

  const apiKey = process.env.GROQ_API_KEY || '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';
  if (!apiKey) { res.status(500).json({ error: 'API key not configured' }); return; }

     const prompt = `Create a 7-day healthy meal plan for someone eating exactly ${targetCal} kcal per day.

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
- Every single day must total **close to ${targetCal} kcal** (minimum ${targetCal-200}, ideally ${targetCal}).
- Use **generous, realistic portions** of rice, chicken, oats, pasta, potatoes, etc. to reach the target.
- Do not make small/light meals. Make breakfast, lunch, and dinner filling.

FOOD SELECTION RULES (strict):
- Build the plan almost entirely around plain, everyday staple foods that ordinary people eat daily like these foods : chicken breasts or panne or chicken thighs and all chicken variations, eggs and its variations like ommlete and scrambled, oats and granola , white/basmati rice, bread (toast ,fino , tortilla , etc), potatoes and mashed potatoes and sweet potatos, pasta or macaroni variations, milk, yogurt or greek yoghurt, cheese variations, common fruit (banana, apple, orange, avocado like 1 - 2 times a week), common vegetables (broccoli, spinach, bamya, cucumber, salad), peanut butter, beans(only beans no green beans), nuts and cashew variations.
- Chicken breast should be the DEFAULT protein for most lunches/dinners. Fish (salmon, tuna, etc.) may appear in AT MOST 1 meal across the entire plan.
- Red meat may appear occasionally (max 1-2 times across the whole plan).
- Do NOT use rare, festive, restaurant-style, or heavy/greasy dishes.
- Each day has 3-5 meals: breakfast, lunch, dinner, snack1 (3-5 times a week), snack2 (optional, max 2 times a week).
- Fully generate all 7 days with complete meals.

**VERY STRICT FORMATTING RULES - NO MULTIPLIERS EVER:**

- Rice, pasta, chicken, potatoes, broccoli, spinach → **always in grams** ("140 grams cooked white rice", "300 grams grilled chicken breast")
- Milk → **always in cups** ("1 cup milk (2%)", "2 cups milk")
- Honey, peanut butter, butter → **always in spoons** ("2 spoons natural peanut butter")
- Bread → "2 slices fino bread"
- Eggs → "2 medium eggs" or "4 medium eggs"
- Banana, apple → "1 large banana", "2 medium apples"

**Never** use "1x", "1.6x" or any multiplier.

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
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 4096,
        response_format: { type: "json_object" }
      })
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error('[generate-diet] Groq error:', errText);
      res.status(502).json({ error: 'Groq API error', detail: errText });
      return;
    }

    const groqData = await groqRes.json();
    const rawText = groqData?.choices?.[0]?.message?.content || '';
    const cleaned = rawText.replace(/```json|```/g, '').trim();

    let plan;
    try {
      plan = JSON.parse(cleaned);
    } catch {
      res.status(502).json({ error: 'Could not parse response', raw: rawText });
      return;
    }

    if (!plan.days || !Array.isArray(plan.days)) {
      res.status(502).json({ error: 'Invalid plan shape returned by model', raw: rawText });
      return;
    }

    res.status(200).json(plan);
  } catch (err) {
    console.error('[generate-diet] Unexpected error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}