export default async function handler(req, res) {
  // Allow CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { fromCity, toCity, persona, name } = req.body;

  if (!fromCity || !toCity || !persona || !name) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const personaLabel = persona === 'family' ? 'Families'
    : persona === 'single' ? 'Singles & Young Professionals'
    : 'Retirees';

  const prompt = `You are an expert NC relocation advisor. Someone named ${name} is moving from ${fromCity} to ${toCity}, NC. They identify as: ${personaLabel}.

Generate a comprehensive magazine-style relocation guide as a JSON object. Return ONLY valid JSON with no markdown, no backticks, no preamble.

{
  "headline": "short punchy headline about this specific move",
  "tagline": "one compelling sentence about why this move makes sense",
  "pills": ["4 short highlight tags about this move"],
  "stats": [
    {"label": "Population", "value": "XXX,XXX"},
    {"label": "Median Home", "value": "$XXX,XXX"},
    {"label": "Cost of Living", "value": "XX% below US avg"},
    {"label": "Avg Commute", "value": "XX min"},
    {"label": "School Rating", "value": "X/10"},
    {"label": "Unemployment", "value": "X.X%"}
  ],
  "city_overview": "3-4 vivid sentences about the NC destination character and vibe. Be specific.",
  "coming_from": "2-3 sentences specifically about transitioning from their origin city. Mention real differences in cost, pace, culture.",
  "neighborhoods": {
    "intro": "1-2 sentences",
    "list": [
      {"name": "Name", "vibe": "1 sentence — price range, who it is best for"},
      {"name": "Name", "vibe": "..."},
      {"name": "Name", "vibe": "..."},
      {"name": "Name", "vibe": "..."}
    ]
  },
  "schools": {
    "intro": "1-2 sentences about the overall school district quality",
    "public": ["School Name - grades served, brief note", "School Name - ...", "School Name - ..."],
    "private": ["School Name - brief note", "School Name - ..."],
    "higher_ed": ["Institution - brief note"]
  },
  "hospitals": {
    "intro": "1-2 sentences",
    "list": [
      {"name": "Hospital Name", "ranking": "US News ranking or specialty", "note": "brief note"},
      {"name": "Hospital Name", "ranking": "...", "note": "..."}
    ]
  },
  "worship": {
    "intro": "1 sentence",
    "list": ["Name - denomination/type", "Name - ...", "Name - ...", "Name - ...", "Name - ..."]
  },
  "restaurants": {
    "intro": "1-2 sentences about the food scene",
    "categories": [
      {"category": "Local Favorites", "picks": ["Name - cuisine, neighborhood", "Name - ...", "Name - ..."]},
      {"category": "Fine Dining", "picks": ["Name - ...", "Name - ..."]},
      {"category": "Casual and Family", "picks": ["Name - ...", "Name - ...", "Name - ..."]},
      {"category": "Brunch and Coffee", "picks": ["Name - ...", "Name - ..."]}
    ]
  },
  "family_activities": ["Activity or venue - brief note", "...", "...", "...", "...", "..."],
  "nightlife": ["Venue or district - brief note", "...", "...", "...", "..."],
  "outdoor_recreation": ["Park or activity - brief note", "...", "...", "...", "..."],
  "shopping": ["Mall or district - brief note", "...", "...", "..."],
  "persona_insights": {
    "families": "3-4 sentences about family life in this NC city - schools, safety, neighborhoods, activities",
    "singles": "3-4 sentences about young professional life - career, social scene, housing, lifestyle",
    "retirees": "3-4 sentences about retirement quality - healthcare, community, cost, activities"
  },
  "denniss_take": "2-3 sentences written warmly as Dennis Fields, a 20-year NC mortgage expert. Personal and expert. Mention something specific he loves about this city and a quick mortgage tip for someone coming from their origin city.",
  "adjustment_tips": ["One honest adjustment tip specific to this city", "...", "...", "..."],
  "mortgage_insight": "2-3 sentences about the mortgage market in this specific NC city - price range, best loan types (FHA, USDA, VA, conventional, DPA), down payment assistance, and what buyers from their origin city should know."
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Anthropic API error:', err);
      return res.status(500).json({ error: 'API request failed' });
    }

    const data = await response.json();
    const raw = data.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    return res.status(200).json(parsed);

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Failed to generate guide. Please try again.' });
  }
}
