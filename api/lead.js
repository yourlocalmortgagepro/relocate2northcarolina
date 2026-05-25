export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { firstName, lastName, email, phone, fromCity, toCity, persona, source, guideData, extraTags } = req.body || {};

  const results = { ghl: null, email: null };

  // ── STEP 1: SEND LEAD TO GHL ─────────────────────────────────
  try {
    const personaLabel = persona === 'family' ? 'Family'
      : persona === 'single' ? 'Single / Young Professional'
      : persona === 'retiree' ? 'Retiree'
      : persona || '';

    // Build GHL contact payload
    const ghlPayload = {
      firstName: firstName || '',
      lastName: lastName || '',
      email: email || '',
      phone: phone || '',
      source: source || 'NC Relocation Website',
      tags: [
        'nc-relocation-website',
        source === 'relocation-guide' ? 'nc-relocation-guide-lead' : 'nc-agent-match-lead',
        source === 'agent-match' ? 'hot-lead' : null,
        source === 'agent-match' ? 'agent-requested' : null,
        source === 'agent-match' ? 'needs-agent-intro' : null,
        source === 'agent-match' ? 'relocating-to-nc' : null,
        personaLabel ? `persona-${personaLabel.toLowerCase().replace(/\s+/g, '-')}` : '',
        toCity ? `destination-${toCity.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')}` : '',
        ...(extraTags || []),
      ].filter(Boolean),
      customFields: [
        { key: 'moving_from', field_value: fromCity || '' },
        { key: 'moving_to_nc', field_value: toCity || '' },
        { key: 'persona', field_value: personaLabel },
        { key: 'lead_source', field_value: source || '' },
      ]
    };

    const GHL_LOCATION_ID = 'EGPJsvGiNF90gj9kNK7X';
    const GHL_HEADERS = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
      'Version': '2021-07-28'
    };

    // First try to find existing contact by email
    let contactId = null;
    try {
      const searchRes = await fetch(
        `https://services.leadconnectorhq.com/contacts/?locationId=${GHL_LOCATION_ID}&email=${encodeURIComponent(ghlPayload.email)}`,
        { method: 'GET', headers: GHL_HEADERS }
      );
      const searchData = await searchRes.json();
      if (searchData?.contacts?.length > 0) {
        contactId = searchData.contacts[0].id;
      }
    } catch(e) { console.log('Search error:', e.message); }

    let ghlData = {};
    if (contactId) {
      // UPDATE existing contact
      const updateRes = await fetch(
        `https://services.leadconnectorhq.com/contacts/${contactId}`,
        {
          method: 'PUT',
          headers: GHL_HEADERS,
          body: JSON.stringify({
            ...ghlPayload,
            locationId: GHL_LOCATION_ID
          })
        }
      );
      ghlData = await updateRes.json();
      results.ghl = { status: updateRes.status, contactId, action: 'updated', error: ghlData?.message || null };
    } else {
      // CREATE new contact
      const createRes = await fetch(
        `https://services.leadconnectorhq.com/contacts/`,
        {
          method: 'POST',
          headers: GHL_HEADERS,
          body: JSON.stringify({
            ...ghlPayload,
            locationId: GHL_LOCATION_ID
          })
        }
      );
      ghlData = await createRes.json();
      contactId = ghlData?.contact?.id || ghlData?.id || null;
      results.ghl = { status: createRes.status, contactId, action: 'created', error: ghlData?.message || null };
    }
    console.log('GHL Result:', JSON.stringify(results.ghl));

  } catch (err) {
    results.ghl = { error: err.message };
  }

  // ── STEP 2: SEND EMAIL VIA RESEND ────────────────────────────
  if (guideData && email && source === 'relocation-guide') {
    try {
      const { Resend } = await import('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);

      const personaLabel = persona === 'family' ? 'Families'
        : persona === 'single' ? 'Singles & Young Professionals'
        : 'Retirees';

      function listItems(arr) {
        if (!arr || !arr.length) return '';
        return '<ul style="margin:8px 0;padding-left:18px;">' +
          (arr || []).map(i => `<li style="margin-bottom:5px;font-size:13px;color:#5A5A5A;line-height:1.6;font-family:Arial,sans-serif;">${i}</li>`).join('') +
          '</ul>';
      }

      const pills = (guideData.pills || []).map(p =>
        `<span style="display:inline-block;background:#F5E6C8;color:#0C2340;font-size:11px;font-weight:700;padding:4px 12px;border-radius:100px;margin:2px;">${p}</span>`
      ).join('');

      const statsHtml = (guideData.stats || []).map(s =>
        `<tr><td style="padding:7px 12px;font-size:13px;color:#5A5A5A;border-bottom:1px solid #E2DDD5;font-family:Arial,sans-serif;">${s.label}</td>
         <td style="padding:7px 12px;font-size:13px;font-weight:700;color:#0C2340;border-bottom:1px solid #E2DDD5;font-family:Arial,sans-serif;">${s.value}</td></tr>`
      ).join('');

      const schoolsHtml = [
        guideData.schools?.public?.length ? `<strong style="color:#0C2340;font-family:Arial,sans-serif;">Public Schools:</strong>${listItems(guideData.schools.public)}` : '',
        guideData.schools?.private?.length ? `<strong style="color:#0C2340;font-family:Arial,sans-serif;">Private Schools:</strong>${listItems(guideData.schools.private)}` : '',
        guideData.schools?.higher_ed?.length ? `<strong style="color:#0C2340;font-family:Arial,sans-serif;">Higher Ed:</strong>${listItems(guideData.schools.higher_ed)}` : '',
      ].join('');

      const restaurantsHtml = (guideData.restaurants?.categories || [])
        .filter(c => c.picks && c.picks.length > 0)
        .map(c => {
          const isIntl = c.category.toLowerCase().includes('international');
          return `<strong style="color:${isIntl ? '#C8952A' : '#0C2340'};font-family:Arial,sans-serif;">${c.category}</strong>${listItems(c.picks)}`;
        }).join('');

      const weatherHtml = (() => {
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const wd = {
          'greensboro':  { h:[49,53,62,72,79,86,89,88,82,72,62,52], l:[29,31,39,48,57,65,69,68,61,49,39,31] },
          'charlotte':   { h:[51,55,64,73,81,88,91,90,83,73,63,53], l:[31,33,41,50,59,67,71,70,63,51,41,33] },
          'raleigh':     { h:[50,54,63,72,80,87,90,88,82,72,62,52], l:[29,31,39,48,57,65,70,69,62,50,40,31] },
          'wilmington':  { h:[55,58,65,73,80,86,90,89,84,75,67,58], l:[35,37,44,52,61,69,73,72,66,55,45,37] },
          'asheville':   { h:[46,50,58,67,74,81,84,83,77,67,57,48], l:[24,26,33,41,50,58,62,61,54,43,34,26] },
          'default':     { h:[50,54,63,72,80,87,90,88,82,72,62,52], l:[29,31,39,48,57,65,70,69,62,50,40,31] },
        };
        const key = (toCity || '').toLowerCase();
        let w = wd.default;
        for (const [k,v] of Object.entries(wd)) { if (key.includes(k)) { w = v; break; } }
        const mCells = months.map(m => `<td style="text-align:center;padding:4px 2px;font-size:10px;font-weight:700;color:#fff;background:#0C2340;font-family:Arial,sans-serif;">${m}</td>`).join('');
        const hCells = w.h.map(h => `<td style="text-align:center;padding:5px 2px;font-size:11px;font-weight:700;color:#B33A3A;font-family:Arial,sans-serif;">${h}°</td>`).join('');
        const lCells = w.l.map(l => `<td style="text-align:center;padding:5px 2px;font-size:11px;font-weight:700;color:#1a5a8a;font-family:Arial,sans-serif;">${l}°</td>`).join('');
        return `<table width="100%" cellpadding="0" cellspacing="1" style="border-collapse:collapse;margin-top:10px;">
          <tr>${mCells}</tr>
          <tr style="background:#FFF5F5;"><td colspan="12" style="font-size:10px;color:#B33A3A;font-weight:700;padding:3px 2px;font-family:Arial,sans-serif;">🌡 High °F</td></tr>
          <tr>${hCells}</tr>
          <tr style="background:#F0F5FF;"><td colspan="12" style="font-size:10px;color:#1a5a8a;font-weight:700;padding:3px 2px;font-family:Arial,sans-serif;">❄ Low °F</td></tr>
          <tr>${lCells}</tr>
        </table>`;
      })();

      function sec(eyebrow, title, body) {
        return `<div style="background:#fff;border:1px solid #E2DDD5;border-radius:10px;padding:18px 20px;margin-bottom:12px;">
          <div style="color:#C8952A;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:3px;font-family:Arial,sans-serif;">${eyebrow}</div>
          <div style="font-family:Georgia,serif;font-size:17px;color:#0C2340;font-weight:700;margin-bottom:10px;">${title}</div>
          <div style="font-size:13px;color:#5A5A5A;line-height:1.75;font-family:Arial,sans-serif;">${body}</div>
        </div>`;
      }

      const htmlBody = `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#F7F5F0;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F5F0;padding:20px 12px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <tr><td style="background:#0C2340;border-radius:12px 12px 0 0;padding:24px 26px 20px;">
    <div style="color:#C8952A;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;font-family:Arial,sans-serif;">NC Relocation Intelligence · ${personaLabel}</div>
    <div style="font-family:Georgia,serif;color:#fff;font-size:22px;font-weight:700;line-height:1.2;margin-bottom:6px;">${guideData.headline || `Your ${toCity} Relocation Guide`}</div>
    <div style="color:rgba(255,255,255,0.65);font-size:13px;font-family:Arial,sans-serif;margin-bottom:14px;">${guideData.tagline || ''}</div>
    <div>${pills}</div>
  </td></tr>

  <tr><td style="background:#C8952A;padding:8px 26px;">
    <span style="font-size:11px;color:#0C2340;font-weight:700;font-family:Arial,sans-serif;">Dennis Fields · Movement Mortgage · NMLS #1407951 · relocate2northcarolina.com</span>
  </td></tr>

  <tr><td style="background:#fff;padding:20px 20px 8px;">

    <p style="font-size:15px;color:#1A1A1A;font-family:Arial,sans-serif;line-height:1.7;margin:0 0 14px;">
      Hi ${firstName},<br/><br/>
      Here is your personalized NC Relocation Magazine for <strong>${toCity}</strong> — built just for you based on your move from <strong>${fromCity}</strong>. Save this email and share it with your family!
    </p>

    <div style="background:#F7F5F0;border:1px solid #E2DDD5;border-radius:10px;margin-bottom:14px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td colspan="2" style="background:#0C2340;border-radius:8px 8px 0 0;padding:8px 12px;">
          <span style="color:#C8952A;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;font-family:Arial,sans-serif;">City at a Glance</span>
        </td></tr>${statsHtml}
      </table>
    </div>

    ${sec('About the City', toCity + ' — Overview', guideData.city_overview || '')}
    ${sec('Coming From ' + fromCity, 'What to Expect', guideData.coming_from || '')}
    ${sec('Education', 'Schools Directory', (guideData.schools?.intro || '') + schoolsHtml)}
    ${sec('Healthcare', 'Hospitals & Medical', (guideData.hospitals?.intro || '') + '<ul style="margin:8px 0;padding-left:18px;">' + (guideData.hospitals?.list || []).map(h => `<li style="margin-bottom:5px;font-size:13px;color:#5A5A5A;font-family:Arial,sans-serif;"><strong>${h.name}</strong>${h.ranking ? ` (${h.ranking})` : ''} — ${h.note}</li>`).join('') + '</ul>')}
    ${sec('Faith Community', 'Places of Worship', (guideData.worship?.intro || '') + listItems(guideData.worship?.list))}
    ${sec('Food Scene', 'Restaurants & Dining', (guideData.restaurants?.intro || '') + restaurantsHtml)}
    ${sec('Family Life', 'Activities for Kids & Families', listItems(guideData.family_activities))}
    ${sec('Social Life', 'Nightlife & Entertainment', listItems(guideData.nightlife))}
    ${sec('Annual Calendar', 'Events & Festivals', listItems(guideData.annual_events))}
    ${sec('Year-Round Climate', 'Monthly Weather for ' + toCity, (guideData.weather_summary || '') + weatherHtml)}

    <div style="background:#F5E6C8;border-left:4px solid #C8952A;border-radius:0 8px 8px 0;padding:14px 16px;margin-bottom:12px;">
      <div style="color:#C8952A;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;font-family:Arial,sans-serif;">A Note from Dennis</div>
      <div style="font-size:13px;color:#1A1A1A;line-height:1.75;font-family:Arial,sans-serif;">${guideData.denniss_take || ''}</div>
    </div>

    ${sec('Mortgage Insight', 'Home Buying in ' + toCity, guideData.mortgage_insight || '')}
    ${sec('Honest Advice', 'Things to Prepare For', listItems(guideData.adjustment_tips))}

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0C2340;border-radius:10px;margin:16px 0;"><tr><td style="padding:20px 22px;">
      <div style="color:#fff;font-family:Georgia,serif;font-size:18px;font-weight:700;margin-bottom:6px;">Ready to Buy a Home in ${toCity}?</div>
      <div style="color:rgba(255,255,255,0.65);font-size:13px;font-family:Arial,sans-serif;margin-bottom:14px;">The consultation is free. The expertise is priceless.</div>
      <a href="https://calendly.com/dennisfieldsmortgagepro" style="display:inline-block;background:#C8952A;color:#0C2340;font-weight:700;font-size:14px;padding:10px 22px;border-radius:7px;text-decoration:none;font-family:Arial,sans-serif;margin-right:8px;">📅 Book a Free Call</a>
      <a href="https://dennisfieldsmortgagepro.com" style="display:inline-block;border:1.5px solid rgba(255,255,255,0.4);color:#fff;font-weight:600;font-size:14px;padding:10px 22px;border-radius:7px;text-decoration:none;font-family:Arial,sans-serif;">Apply Online →</a>
    </td></tr></table>

    <div style="border:1px solid #E2DDD5;border-left:3px solid #C8952A;border-radius:0 8px 8px 0;padding:10px 14px;margin-bottom:16px;background:#F7F5F0;">
      <p style="font-size:11px;color:#5A5A5A;font-family:Arial,sans-serif;line-height:1.6;margin:0;">
        <strong style="color:#0C2340;">AI-Generated Content Disclaimer:</strong> This guide was created using artificial intelligence for general informational purposes only. Verify all details independently before making decisions. All loans subject to approval. Equal Housing Lender. Dennis Fields · Movement Mortgage · NMLS #1407951.
      </p>
    </div>

  </td></tr>

  <tr><td style="background:#081828;border-radius:0 0 12px 12px;padding:16px 24px;text-align:center;">
    <p style="color:rgba(255,255,255,0.50);font-size:11px;font-family:Arial,sans-serif;line-height:1.8;margin:0;">
      <a href="https://facebook.com/yourlocalmortgagepros" style="color:#C8952A;text-decoration:none;">Facebook</a> &nbsp;·&nbsp;
      <a href="https://instagram.com/dennisfieldsmortgagepro" style="color:#C8952A;text-decoration:none;">Instagram</a> &nbsp;·&nbsp;
      <a href="https://linkedin.com/in/dennis-fields" style="color:#C8952A;text-decoration:none;">LinkedIn</a><br/>
      Dennis Fields · Movement Mortgage · NMLS #1407951 · Licensed in NC, SC &amp; VA
    </p>
  </td></tr>

</table></td></tr></table>
</body></html>`;

      await resend.emails.send({
        from: 'Dennis Fields <dennis@relocate2northcarolina.com>',
        to: email,
        subject: `Your ${toCity} Relocation Guide Is Here, ${firstName}! 🏡`,
        html: htmlBody,
      });

      results.email = { sent: true };
    } catch (emailErr) {
      results.email = { error: emailErr.message };
    }
  }

  return res.status(200).json(results);
}
