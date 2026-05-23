export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const { fromCity, toCity, persona, name } = req.body || {};
  if (!fromCity || !toCity || !persona || !name) {
    return res.status(400).json({ error: 'Missing fields: ' + JSON.stringify({ fromCity, toCity, persona, name }) });
  }

  const personaLabel = persona === 'family' ? 'Families'
    : persona === 'single' ? 'Singles & Young Professionals' : 'Retirees';

  const prompt = `You are an expert NC relocation advisor. Someone named ${name} is moving from ${fromCity} to ${toCity}, NC. They identify as: ${personaLabel}.

Generate a relocation guide as a JSON object. Return ONLY valid JSON, no markdown, no backticks.

{
  "headline": "short headline about this move",
  "tagline": "one sentence about why this move makes sense",
  "pills": ["highlight 1", "highlight 2", "highlight 3", "highlight 4"],
  "stats": [
    {"label": "Population", "value": "XXX,XXX"},
    {"label": "Median Home", "value": "$XXX,XXX"},
    {"label": "Cost of Living", "value": "XX% below US avg"},
    {"label": "Avg Commute", "value": "XX min"},
    {"label": "School Rating", "value": "X/10"},
    {"label": "Unemployment", "value": "X.X%"}
  ],
  "city_overview": "3-4 sentences about the NC destination.",
  "coming_from": "2-3 sentences about transitioning from their origin city.",
  "neighborhoods": {
    "intro": "1-2 sentences",
    "list": [
      {"name": "Neighborhood", "vibe": "description"},
      {"name": "Neighborhood", "vibe": "description"},
      {"name": "Neighborhood", "vibe": "description"},
      {"name": "Neighborhood", "vibe": "description"}
    ]
  },
  "schools": {
    "intro": "1-2 sentences",
    "public": ["School - note", "School - note", "School - note"],
    "private": ["School - note", "School - note"],
    "higher_ed": ["Institution - note"]
  },
  "hospitals": {
    "intro": "1-2 sentences",
    "list": [
      {"name": "Hospital", "ranking": "ranking", "note": "note"},
      {"name": "Hospital", "ranking": "ranking", "note": "note"}
    ]
  },
  "worship": {
    "intro": "1 sentence",
    "list": ["Name - type", "Name - type", "Name - type", "Name - type", "Name - type"]
  },
  "restaurants": {
    "intro": "1-2 sentences",
    "categories": [
      {"category": "Local Favorites", "picks": ["Name - note", "Name - note", "Name - note"]},
      {"category": "Fine Dining", "picks": ["Name - note", "Name - note"]},
      {"category": "Casual and Family", "picks": ["Name - note", "Name - note", "Name - note"]},
      {"category": "Brunch and Coffee", "picks": ["Name - note", "Name - note"]}
    ]
  },
  "family_activities": ["activity - note", "activity - note", "activity - note", "activity - note", "activity - note"],
  "nightlife": ["venue - note", "venue - note", "venue - note", "venue - note"],
  "outdoor_recreation": ["activity - note", "activity - note", "activity - note", "activity - note"],
  "shopping": ["place - note", "place - note", "place - note"],
  "persona_insights": {
    "families": "3-4 sentences for families",
    "singles": "3-4 sentences for singles",
    "retirees": "3-4 sentences for retirees"
  },
  "denniss_take": "2-3 sentences as Dennis Fields mortgage expert",
  "adjustment_tips": ["tip 1", "tip 2", "tip 3", "tip 4"],
  "mortgage_insight": "2-3 sentences about mortgage market in this NC city"
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error('Anthropic error status:', response.status);
      console.error('Anthropic error body:', responseText);
      return res.status(500).json({ error: 'Anthropic API error: ' + response.status + ' - ' + responseText });
    }

    const data = JSON.parse(responseText);
    const raw = data.content.filter(b => b.type === 'text').map(b => b.text).join('');
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return res.status(200).json(parsed);

  } catch (err) {
    console.error('Handler error:', err.message);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
