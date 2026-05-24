import { Resend } from 'resend';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { firstName, email, fromCity, toCity, persona, guideData } = req.body || {};
  if (!firstName || !email || !guideData) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const personaLabel = persona === 'family' ? 'Families'
    : persona === 'single' ? 'Singles & Young Professionals'
    : 'Retirees';

  const pills = (guideData.pills || []).map(p =>
    `<span style="display:inline-block;background:#F5E6C8;color:#0C2340;font-size:11px;font-weight:700;padding:4px 12px;border-radius:100px;margin:3px 3px 3px 0;">${p}</span>`
  ).join('');

  const statRows = (guideData.stats || []).map(s =>
    `<tr>
      <td style="padding:8px 14px;font-size:13px;color:#5A5A5A;font-family:Arial,sans-serif;border-bottom:1px solid #E2DDD5;">${s.label}</td>
      <td style="padding:8px 14px;font-size:13px;font-weight:700;color:#0C2340;font-family:Arial,sans-serif;border-bottom:1px solid #E2DDD5;">${s.value}</td>
    </tr>`
  ).join('');

  function section(eyebrow, title, content) {
    return `
    <div style="background:#ffffff;border:1px solid #E2DDD5;border-radius:12px;padding:22px 24px;margin-bottom:14px;">
      <div style="color:#C8952A;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;font-family:Arial,sans-serif;">${eyebrow}</div>
      <div style="font-family:Georgia,serif;font-size:18px;color:#0C2340;font-weight:700;margin-bottom:12px;">${title}</div>
      <div style="font-size:13px;color:#5A5A5A;line-height:1.75;font-family:Arial,sans-serif;">${content}</div>
    </div>`;
  }

  function listItems(arr) {
    if (!arr || !arr.length) return '';
    return '<ul style="margin:8px 0;padding-left:18px;">' +
      arr.map(i => `<li style="margin-bottom:6px;font-size:13px;color:#5A5A5A;line-height:1.6;font-family:Arial,sans-serif;">${i}</li>`).join('') +
      '</ul>';
  }

  const schoolsHtml = [
    guideData.schools?.public?.length ? `<strong style="color:#0C2340;">Public Schools:</strong>${listItems(guideData.schools.public)}` : '',
    guideData.schools?.private?.length ? `<strong style="color:#0C2340;">Private Schools:</strong>${listItems(guideData.schools.private)}` : '',
    guideData.schools?.higher_ed?.length ? `<strong style="color:#0C2340;">Higher Education:</strong>${listItems(guideData.schools.higher_ed)}` : '',
  ].join('');

  const hospitalsHtml = (guideData.hospitals?.list || []).map(h =>
    `<li style="margin-bottom:6px;font-size:13px;color:#5A5A5A;font-family:Arial,sans-serif;"><strong>${h.name}</strong>${h.ranking ? ` (${h.ranking})` : ''} — ${h.note}</li>`
  ).join('');

  const restaurantsHtml = (guideData.restaurants?.categories || []).map(cat =>
    `<strong style="color:#0C2340;">${cat.category}</strong>${listItems(cat.picks)}`
  ).join('');

  const personaCards = `
  <table width="100%" cellpadding="0" cellspacing="8" style="margin-top:12px;">
    <tr>
      <td style="background:#EEF4FB;border:1px solid #BDD0E8;border-radius:8px;padding:14px;vertical-align:top;width:33%;">
        <div style="font-size:11px;font-weight:700;color:#1a4a7a;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;font-family:Arial,sans-serif;">👨‍👩‍👧 For Families</div>
        <div style="font-size:12px;color:#5A5A5A;line-height:1.6;font-family:Arial,sans-serif;">${guideData.persona_insights?.families || ''}</div>
      </td>
      <td width="8"></td>
      <td style="background:#F5E6C8;border:1px solid #C8952A;border-radius:8px;padding:14px;vertical-align:top;width:33%;">
        <div style="font-size:11px;font-weight:700;color:#7a4a0a;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;font-family:Arial,sans-serif;">💼 Singles & Young Pros</div>
        <div style="font-size:12px;color:#5A5A5A;line-height:1.6;font-family:Arial,sans-serif;">${guideData.persona_insights?.singles || ''}</div>
      </td>
      <td width="8"></td>
      <td style="background:#EEF9F1;border:1px solid #A8D5B5;border-radius:8px;padding:14px;vertical-align:top;width:33%;">
        <div style="font-size:11px;font-weight:700;color:#1a5a30;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;font-family:Arial,sans-serif;">🌅 Retirees</div>
        <div style="font-size:12px;color:#5A5A5A;line-height:1.6;font-family:Arial,sans-serif;">${guideData.persona_insights?.retirees || ''}</div>
      </td>
    </tr>
  </table>`;

  const weatherRows = (() => {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const weatherData = {
      'greensboro':   { highs:[49,53,62,72,79,86,89,88,82,72,62,52], lows:[29,31,39,48,57,65,69,68,61,49,39,31] },
      'winston':      { highs:[48,52,61,71,78,85,88,87,81,71,61,51], lows:[28,30,38,47,56,64,68,67,60,48,38,30] },
      'charlotte':    { highs:[51,55,64,73,81,88,91,90,83,73,63,53], lows:[31,33,41,50,59,67,71,70,63,51,41,33] },
      'raleigh':      { highs:[50,54,63,72,80,87,90,88,82,72,62,52], lows:[29,31,39,48,57,65,70,69,62,50,40,31] },
      'wilmington':   { highs:[55,58,65,73,80,86,90,89,84,75,67,58], lows:[35,37,44,52,61,69,73,72,66,55,45,37] },
      'asheville':    { highs:[46,50,58,67,74,81,84,83,77,67,57,48], lows:[24,26,33,41,50,58,62,61,54,43,34,26] },
      'default':      { highs:[50,54,63,72,80,87,90,88,82,72,62,52], lows:[29,31,39,48,57,65,70,69,62,50,40,31] },
    };
    const key = toCity.toLowerCase();
    let w = weatherData.default;
    for (const [k, v] of Object.entries(weatherData)) {
      if (key.includes(k)) { w = v; break; }
    }
    const highCells = months.map((m, i) =>
      `<td style="text-align:center;padding:6px 4px;font-size:11px;font-weight:700;color:#B33A3A;font-family:Arial,sans-serif;">${w.highs[i]}°</td>`
    ).join('');
    const lowCells = months.map((m, i) =>
      `<td style="text-align:center;padding:6px 4px;font-size:11px;font-weight:700;color:#1a5a8a;font-family:Arial,sans-serif;">${w.lows[i]}°</td>`
    ).join('');
    const monthCells = months.map(m =>
      `<td style="text-align:center;padding:4px;font-size:10px;font-weight:700;color:#ffffff;background:#0C2340;font-family:Arial,sans-serif;">${m}</td>`
    ).join('');
    return `<table width="100%" cellpadding="0" cellspacing="1" style="margin-top:10px;border-collapse:collapse;">
      <tr>${monthCells}</tr>
      <tr><td colspan="12" style="font-size:10px;color:#B33A3A;font-weight:700;font-family:Arial,sans-serif;padding:4px 2px;">🌡 High °F</td></tr>
      <tr style="background:#FFF5F5;">${highCells}</tr>
      <tr><td colspan="12" style="font-size:10px;color:#1a5a8a;font-weight:700;font-family:Arial,sans-serif;padding:4px 2px;">❄ Low °F</td></tr>
      <tr style="background:#F0F5FF;">${lowCells}</tr>
    </table>`;
  })();

  const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#F7F5F0;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F5F0;padding:24px 16px;">
  <tr><td align="center">
  <table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;">

    <!-- HEADER -->
    <tr><td style="background:#0C2340;border-radius:14px 14px 0 0;padding:28px 30px 22px;">
      <div style="color:#C8952A;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;font-family:Arial,sans-serif;">NC Relocation Intelligence · Personalized for ${personaLabel}</div>
      <div style="font-family:Georgia,serif;color:#ffffff;font-size:24px;font-weight:700;line-height:1.2;margin-bottom:8px;">${guideData.headline || `Your ${toCity} Relocation Guide`}</div>
      <div style="color:rgba(255,255,255,0.68);font-size:13px;font-family:Arial,sans-serif;line-height:1.6;margin-bottom:16px;">${guideData.tagline || ''}</div>
      <div>${pills}</div>
    </td></tr>

    <!-- GOLD BAR -->
    <tr><td style="background:#C8952A;padding:10px 30px;display:flex;justify-content:space-between;">
      <span style="font-size:11px;color:#0C2340;font-weight:700;font-family:Arial,sans-serif;">Dennis Fields · Movement Mortgage · NMLS #1407951</span>
    </td></tr>

    <!-- BODY -->
    <tr><td style="background:#ffffff;padding:24px 24px 8px;">

      <!-- GREETING -->
      <p style="font-size:15px;color:#1A1A1A;font-family:Arial,sans-serif;line-height:1.7;margin:0 0 16px;">
        Hi ${firstName},<br/><br/>
        Here is your personalized NC Relocation Magazine for <strong>${toCity}</strong> — built just for you based on your move from <strong>${fromCity}</strong>. Save this email. Share it with your family. And when you're ready to talk mortgage, I'm one click away.
      </p>

      <!-- STATS -->
      <div style="background:#F7F5F0;border:1px solid #E2DDD5;border-radius:10px;padding:4px;margin-bottom:16px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td colspan="2" style="background:#0C2340;border-radius:8px 8px 0 0;padding:10px 14px;">
            <span style="color:#C8952A;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;font-family:Arial,sans-serif;">City at a Glance</span>
          </td></tr>
          ${statRows}
        </table>
      </div>

      ${section('About the City', `${toCity} — Overview`, guideData.city_overview || '')}
      ${section('Coming From ' + fromCity, 'What to Expect', guideData.coming_from || '')}
      ${section('Education', 'Schools Directory', (guideData.schools?.intro || '') + schoolsHtml)}
      ${section('Healthcare', 'Hospitals & Medical Centers', (guideData.hospitals?.intro || '') + '<ul style="margin:8px 0;padding-left:18px;">' + hospitalsHtml + '</ul>')}
      ${section('Faith Community', 'Places of Worship', (guideData.worship?.intro || '') + listItems(guideData.worship?.list))}
      ${section('Food Scene', 'Restaurants & Dining', (guideData.restaurants?.intro || '') + restaurantsHtml)}
      ${section('Family Life', 'Activities for Kids & Families', listItems(guideData.family_activities))}
      ${section('Social Life', 'Nightlife & Entertainment', listItems(guideData.nightlife))}
      ${section('Annual Calendar', 'Events & Festivals', listItems(guideData.annual_events))}
      ${section('Year-Round Climate', 'Monthly Weather', (guideData.weather_summary || '') + weatherRows)}
      ${section('Who Is This City Best For?', 'Life in ' + toCity + ' by Lifestyle', personaCards)}

      <!-- DENNIS NOTE -->
      <div style="background:#F5E6C8;border-left:4px solid #C8952A;border-radius:0 10px 10px 0;padding:18px 20px;margin-bottom:14px;">
        <div style="color:#C8952A;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;font-family:Arial,sans-serif;">A Note from Dennis</div>
        <div style="font-size:13px;color:#1A1A1A;line-height:1.75;font-family:Arial,sans-serif;">${guideData.denniss_take || ''}</div>
      </div>

      ${section('Home Buying in ' + toCity, 'Mortgage Insight', guideData.mortgage_insight || '')}
      ${section('Honest Advice', 'Things to Prepare For', listItems(guideData.adjustment_tips))}

      <!-- CTA -->
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#0C2340;border-radius:12px;margin:20px 0;padding:24px;">
        <tr><td>
          <div style="color:#ffffff;font-family:Georgia,serif;font-size:20px;font-weight:700;margin-bottom:8px;">Ready to Buy a Home in ${toCity}?</div>
          <div style="color:rgba(255,255,255,0.68);font-size:13px;font-family:Arial,sans-serif;margin-bottom:18px;">The consultation is free. The mortgage expertise is priceless.</div>
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="background:#C8952A;border-radius:8px;padding:12px 24px;margin-right:10px;">
              <a href="https://calendly.com/dennisfieldsmortgagepro" style="color:#0C2340;font-weight:700;font-size:14px;font-family:Arial,sans-serif;text-decoration:none;">📅 Book a Free Call</a>
            </td>
            <td width="12"></td>
            <td style="border:1.5px solid rgba(255,255,255,0.35);border-radius:8px;padding:12px 24px;">
              <a href="https://dennisfieldsmortgagepro.com" style="color:#ffffff;font-weight:600;font-size:14px;font-family:Arial,sans-serif;text-decoration:none;">Apply Online →</a>
            </td>
          </tr></table>
        </td></tr>
      </table>

      <!-- DISCLAIMER -->
      <div style="border:1px solid #E2DDD5;border-left:3px solid #C8952A;border-radius:0 8px 8px 0;padding:12px 16px;margin-bottom:20px;background:#F7F5F0;">
        <p style="font-size:11px;color:#5A5A5A;font-family:Arial,sans-serif;line-height:1.65;margin:0;">
          <strong style="color:#0C2340;">AI-Generated Content Disclaimer:</strong> This guide was created using artificial intelligence and is for general informational purposes only. Verify all details independently before making relocation or financial decisions. All loans subject to approval. Equal Housing Lender. Dennis Fields · Movement Mortgage · NMLS #1407951.
        </p>
      </div>

    </td></tr>

    <!-- FOOTER -->
    <tr><td style="background:#081828;border-radius:0 0 14px 14px;padding:20px 30px;text-align:center;">
      <p style="color:rgba(255,255,255,0.55);font-size:11px;font-family:Arial,sans-serif;line-height:1.8;margin:0;">
        <a href="https://facebook.com/yourlocalmortgagepros" style="color:#C8952A;">Facebook</a> &nbsp;·&nbsp;
        <a href="https://instagram.com/dennisfieldsmortgagepro" style="color:#C8952A;">Instagram</a> &nbsp;·&nbsp;
        <a href="https://linkedin.com/in/dennis-fields" style="color:#C8952A;">LinkedIn</a><br/>
        Dennis Fields · Movement Mortgage · NMLS #1407951 · Licensed in NC, SC &amp; VA<br/>
        <a href="{{unsubscribe_url}}" style="color:rgba(255,255,255,0.35);font-size:10px;">Unsubscribe</a>
      </p>
    </td></tr>

  </table>
  </td></tr>
</table>
</body>
</html>`;

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    
    await resend.emails.send({
      from: 'Dennis Fields <dennis@relocate2northcarolina.com>',
      to: email,
      subject: `Your ${toCity} Relocation Guide Is Here, ${firstName}! 🏡`,
      html: htmlBody,
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Email error:', err.message);
    return res.status(500).json({ error: 'Email failed: ' + err.message });
  }
}
