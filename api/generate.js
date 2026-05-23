export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'No API key found in environment' });
    }

    const body = req.body;
    const fromCity = body && body.fromCity ? body.fromCity : null;
    const toCity = body && body.toCity ? body.toCity : null;
    const persona = body && body.persona ? body.persona : null;
    const name = body && body.name ? body.name : null;

    if (!fromCity || !toCity || !persona || !name) {
      return res.status(400).json({
        error: 'Missing fields',
        received: { fromCity, toCity, persona, name }
      });
    }

    const personaLabel = persona === 'family' ? 'Families'
      : persona === 'single' ? 'Singles & Young Professionals'
      : 'Retirees';

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: `You are an NC relocation expert. ${name} is moving from ${fromCity} to ${toCity} NC as ${personaLabel}. Return ONLY a JSON object (no markdown) with these exact keys: headline, tagline, pills (array of 4 strings), stats (array of 6 objects with label and value), city_overview, coming_from, neighborhoods (object with intro and list of 4 objects with name and vibe), schools (object with intro, public array, private array, higher_ed array), hospitals (object with intro and list of 2 objects with name ranking note), worship (object with intro string and list array of exactly 5 strings, each being a real specific church mosque synagogue or temple name followed by dash and denomination - this field is required and must never be empty), restaurants (object with intro and categories array of 4 objects each with category and picks array), family_activities (array of 6 strings), nightlife (array of 5 strings), outdoor_recreation (array of 5 strings), shopping (array of 4 strings), persona_insights (object with families singles retirees strings), denniss_take, adjustment_tips (array of 4 strings), mortgage_insight.`
        }]
      })
    });

    const responseText = await response.text();

    if (!response.ok) {
      return res.status(500).json({
        error: 'Anthropic API failed',
        status: response.status,
        details: responseText
      });
    }

    const data = JSON.parse(responseText);
    const raw = data.content[0].text;
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({
      error: 'Exception thrown',
      message: err.message,
      stack: err.stack
    });
  }
}
