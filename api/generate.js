export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'No API key found in environment' });

  const body = req.body;
  const fromCity = body && body.fromCity ? body.fromCity : null;
  const toCity   = body && body.toCity   ? body.toCity   : null;
  const persona  = body && body.persona  ? body.persona  : null;
  const name     = body && body.name     ? body.name     : null;

  if (!fromCity || !toCity || !persona || !name) {
    return res.status(400).json({ error: 'Missing fields', received: { fromCity, toCity, persona, name } });
  }

  const personaLabel = persona === 'family' ? 'Families'
    : persona === 'single' ? 'Singles & Young Professionals' : 'Retirees';

  // ── HARDCODED NC CITY DATA ─────────────────────────────────────────────────
  const NC_CITIES = {
    'greensboro': {
      county: 'Guilford County',
      stateSalesTax: '4.75%', localSalesTax: '2.25%', totalSalesTax: '7.00%',
      propertyTax: '0.7305% (Guilford County) + 0.4375% (City) = ~1.168% combined rate',
      medianHome: '~$265,000',
      weather: {
        highs: [49,53,62,72,79,86,89,88,82,72,62,52],
        lows:  [29,31,39,48,57,65,69,68,61,49,39,31]
      },
      events: [
        'Guilford County Agricultural Fair (October) - one of the largest county fairs in NC',
        'National Folk Festival (September) - free outdoor music and arts celebration',
        'Carolina Blues Festival (June) - outdoor blues music on the lawn',
        'Greensboro Science Center ZooFest (Spring & Fall)',
        'Carolina Classic Fair (October) - rides, food, entertainment',
        'Greensboro Holiday Parade (November)',
        'Tanger Center Broadway Series (year-round performances)',
        'Greensboro Farmers Curb Market (year-round every Saturday)'
      ]
    },
    'winston-salem': {
      county: 'Forsyth County',
      stateSalesTax: '4.75%', localSalesTax: '2.25%', totalSalesTax: '7.00%',
      propertyTax: '0.7174% (Forsyth County) + 0.6367% (City) = ~1.354% combined rate',
      medianHome: '~$245,000',
      weather: {
        highs: [48,52,61,71,78,85,88,87,81,71,61,51],
        lows:  [28,30,38,47,56,64,68,67,60,48,38,30]
      },
      events: [
        'Dixie Classic Fair (October) - largest event in Forsyth County, 11 days of family fun',
        'National Black Theatre Festival (August, biennial) - world-renowned theater event',
        'Twin City RibFest (June) - BBQ competition and live music',
        'Tanglewood Festival of Lights (November-January) - 2.5 million lights display',
        'Piedmont Craftsmen Fair (November) - prestigious juried craft fair',
        'Bookmarks Literary Festival (September)',
        'Salem Fair (Summer) - rides and entertainment at Tanglewood Park',
        'Winston-Salem Symphony Holiday Pops (December)'
      ]
    },
    'high point': {
      county: 'Guilford County',
      stateSalesTax: '4.75%', localSalesTax: '2.25%', totalSalesTax: '7.00%',
      propertyTax: '0.7305% (Guilford County) + 0.5650% (City) = ~1.296% combined rate',
      medianHome: '~$230,000',
      weather: {
        highs: [49,53,62,72,79,86,89,88,82,72,62,52],
        lows:  [29,31,39,48,57,65,69,68,61,49,39,31]
      },
      events: [
        'High Point Market (April & October) - world\'s largest home furnishings trade show',
        'Guilford County Agricultural Fair (October)',
        'High Point City Lake Park Family Events (Spring & Summer)',
        'Jazz at the Point Festival (Summer)',
        'High Point Holiday Parade (November)',
        'High Point Arts Council Gallery events (year-round)'
      ]
    },
    'charlotte': {
      county: 'Mecklenburg County',
      stateSalesTax: '4.75%', localSalesTax: '2.50%', totalSalesTax: '7.25%',
      propertyTax: '0.6169% (Mecklenburg County) + 0.3481% (City) = ~0.9650% combined rate',
      medianHome: '~$385,000',
      weather: {
        highs: [51,55,64,73,81,88,91,90,83,73,63,53],
        lows:  [31,33,41,50,59,67,71,70,63,51,41,33]
      },
      events: [
        'Coca-Cola 600 NASCAR Race at Charlotte Motor Speedway (May)',
        'Charlotte SHOUT! Arts Festival (October) - citywide arts and culture',
        'Taste of Charlotte Food Festival (June) - uptown food celebration',
        'Charlotte Christmas Village (November-December) - European-style holiday market',
        'Queen\'s Feast Charlotte Restaurant Week (July)',
        'Mecklenburg County Fair (August)',
        'Carolina Panthers and Charlotte Hornets home games (year-round)',
        'Carowinds theme park season (Spring-Fall)'
      ]
    },
    'raleigh': {
      county: 'Wake County',
      stateSalesTax: '4.75%', localSalesTax: '2.50%', totalSalesTax: '7.25%',
      propertyTax: '0.6000% (Wake County) + 0.4117% (City) = ~1.012% combined rate',
      medianHome: '~$400,000',
      weather: {
        highs: [50,54,63,72,80,87,90,88,82,72,62,52],
        lows:  [29,31,39,48,57,65,70,69,62,50,40,31]
      },
      events: [
        'NC State Fair (October) - largest annual event in NC, 11 days at the fairgrounds',
        'Hopscotch Music Festival (September) - indie and alternative music downtown',
        'Wide Open Bluegrass Festival (September) - free outdoor bluegrass celebration',
        'Artsplosure Spring Arts Festival (May) - Moore Square arts and music',
        'Raleigh Food & Wine Festival (November)',
        'First Night Raleigh (New Year\'s Eve) - family-friendly celebration',
        'NC Museum of Art Film Festival (Fall)',
        'Midtown Farmers Market (year-round every Saturday)'
      ]
    },
    'durham': {
      county: 'Durham County',
      stateSalesTax: '4.75%', localSalesTax: '2.25%', totalSalesTax: '7.00%',
      propertyTax: '0.7599% (Durham County) + 0.5417% (City) = ~1.302% combined rate',
      medianHome: '~$370,000',
      weather: {
        highs: [50,54,63,72,80,87,90,88,82,72,62,52],
        lows:  [29,31,39,48,57,65,70,69,62,50,40,31]
      },
      events: [
        'Full Frame Documentary Film Festival (April) - internationally acclaimed film event',
        'American Dance Festival (June-July) - world-renowned at DPAC',
        'Bimbe Cultural Arts Festival (May) - celebrating African American culture',
        'Durham Blues Festival (Summer)',
        'Durham Bulls Baseball season (April-September)',
        'Durham Restaurant Week (July)',
        'Durham County Fair (Fall)',
        'Lucky Strike Holiday Market (December)'
      ]
    },
    'chapel hill': {
      county: 'Orange County',
      stateSalesTax: '4.75%', localSalesTax: '2.50%', totalSalesTax: '7.25%',
      propertyTax: '0.8510% (Orange County) + 0.5381% (Town) = ~1.389% combined rate',
      medianHome: '~$430,000',
      weather: {
        highs: [50,54,63,72,80,87,90,88,82,72,62,52],
        lows:  [29,31,39,48,57,65,70,69,62,50,40,31]
      },
      events: [
        'Festifall Arts & Crafts Festival (October) - Franklin Street outdoor arts fair',
        'Carrboro Music Festival (October) - free outdoor music celebration',
        'UNC Tar Heels Basketball and Football home games (year-round)',
        'ArtsCenter Gallery and Performance events (year-round)',
        'Chapel Hill Restaurant Week (January & July)',
        'Orange County Fair (Fall)',
        'Ackland Art Museum events (year-round)'
      ]
    },
    'cary': {
      county: 'Wake County',
      stateSalesTax: '4.75%', localSalesTax: '2.50%', totalSalesTax: '7.25%',
      propertyTax: '0.6000% (Wake County) + 0.3500% (Town) = ~0.950% combined rate',
      medianHome: '~$450,000',
      weather: {
        highs: [50,54,63,72,80,87,90,88,82,72,62,52],
        lows:  [29,31,39,48,57,65,70,69,62,50,40,31]
      },
      events: [
        'Lazy Daze Arts & Crafts Festival (August) - award-winning arts and crafts fair',
        'Cary Diwali Festival (October/November) - one of the largest Diwali celebrations in the Southeast',
        'SAS Championship Golf Tournament (October) - PGA Tour Champions event',
        'Koka Booth Amphitheatre Summer Concert Series (June-September)',
        'Cary Band Day (October) - high school marching band competition',
        'Cary Holiday Parade (December)',
        'Cary Food Truck Rodeo (Spring & Fall)'
      ]
    },
    'wilmington': {
      county: 'New Hanover County',
      stateSalesTax: '4.75%', localSalesTax: '2.25%', totalSalesTax: '7.00%',
      propertyTax: '0.4450% (New Hanover County) + 0.3980% (City) = ~0.843% combined rate',
      medianHome: '~$350,000',
      weather: {
        highs: [55,58,65,73,80,86,90,89,84,75,67,58],
        lows:  [35,37,44,52,61,69,73,72,66,55,45,37]
      },
      events: [
        'Azalea Festival (April) - one of NC\'s oldest and largest festivals, 4 full days',
        'North Carolina Holiday Flotilla (November) - largest holiday boat parade in the Southeast',
        'Cucalorus Film Festival (November) - acclaimed independent film festival',
        'Riverfest (October) - arts and music along the Cape Fear River',
        'Wilmington Wine & Food Festival (May)',
        'Beaches Film & Stages Festival (September)',
        'New Hanover County 4-H Fair (September)',
        'Battleship North Carolina special events (year-round)'
      ]
    },
    'asheville': {
      county: 'Buncombe County',
      stateSalesTax: '4.75%', localSalesTax: '2.25%', totalSalesTax: '7.00%',
      propertyTax: '0.4788% (Buncombe County) + 0.4288% (City) = ~0.908% combined rate',
      medianHome: '~$410,000',
      weather: {
        highs: [46,50,58,67,74,81,84,83,77,67,57,48],
        lows:  [24,26,33,41,50,58,62,61,54,43,34,26]
      },
      events: [
        'Mountain Dance and Folk Festival (August) - America\'s oldest folk festival since 1928',
        'Asheville Brewgrass Festival (October) - craft beer and bluegrass music',
        'NC Mountain State Fair (September) - Western NC\'s largest annual fair',
        'Biltmore Estate Christmas Candlelight Evenings (November-January)',
        'Lexington Avenue Arts & Fun Festival (September)',
        'Asheville Holiday Parade (December)',
        'Warren Wilson College Contra Dance (weekly year-round)',
        'Asheville Art Museum events (year-round)'
      ]
    },
    'fayetteville': {
      county: 'Cumberland County',
      stateSalesTax: '4.75%', localSalesTax: '2.25%', totalSalesTax: '7.00%',
      propertyTax: '0.7850% (Cumberland County) + 0.4975% (City) = ~1.283% combined rate',
      medianHome: '~$210,000',
      weather: {
        highs: [52,56,64,74,81,88,91,89,83,73,64,54],
        lows:  [31,33,40,49,58,66,70,69,62,51,41,33]
      },
      events: [
        'International Folkfest (September) - celebration of global cultures in Festival Park',
        'Dogwood Festival (April) - arts, music, and food in Festival Park',
        'Veterans Day Parade (November) - one of the nation\'s largest near Fort Liberty',
        'Cumberland County Fair (September)',
        'Cape Fear Botanical Garden Plant Fair (Spring & Fall)',
        'Fayetteville Woodpeckers Baseball (April-September)',
        'Symphony of Toys Holiday Concert (December)'
      ]
    },
    'concord': {
      county: 'Cabarrus County',
      stateSalesTax: '4.75%', localSalesTax: '2.00%', totalSalesTax: '6.75%',
      propertyTax: '0.6300% (Cabarrus County) + 0.4800% (City) = ~1.110% combined rate',
      medianHome: '~$320,000',
      weather: {
        highs: [51,55,64,73,81,88,91,90,83,73,63,53],
        lows:  [31,33,41,50,59,67,71,70,63,51,41,33]
      },
      events: [
        'Cabarrus County Fair (September) - annual county fair with rides and livestock',
        'NASCAR Coca-Cola 600 at Charlotte Motor Speedway (May)',
        'NASCAR Bank of America Roval 400 (October)',
        'Speed Street NASCAR Fan Festival (May)',
        'Concord Christmas Parade (December)',
        'Cabarrus Arts Council Gallery events (year-round)',
        'Concord Farmers Market (seasonal Saturdays)'
      ]
    },
    'gastonia': {
      county: 'Gaston County',
      stateSalesTax: '4.75%', localSalesTax: '2.00%', totalSalesTax: '6.75%',
      propertyTax: '0.8200% (Gaston County) + 0.5100% (City) = ~1.330% combined rate',
      medianHome: '~$255,000',
      weather: {
        highs: [51,55,64,73,81,88,91,90,83,73,63,53],
        lows:  [31,33,41,50,59,67,71,70,63,51,41,33]
      },
      events: [
        'Gaston County Fair (September) - rides, livestock, and entertainment',
        'Gastonia Christmas Parade (December)',
        'Art in the Park (Spring) - Gastonia Arts Association annual show',
        'Lowell Festival (October) - historic mill town heritage celebration',
        'Schiele Museum Natural History events and exhibits (year-round)',
        'Gastonia Honey Hunters Baseball (Summer)'
      ]
    },
    'jacksonville': {
      county: 'Onslow County',
      stateSalesTax: '4.75%', localSalesTax: '2.00%', totalSalesTax: '6.75%',
      propertyTax: '0.7450% (Onslow County) + 0.5150% (City) = ~1.260% combined rate',
      medianHome: '~$215,000',
      weather: {
        highs: [55,58,65,73,80,87,90,89,84,75,67,57],
        lows:  [34,36,43,51,60,68,72,71,65,54,44,36]
      },
      events: [
        'Onslow County Fair (October) - largest annual event in Onslow County',
        'Jacksonville 4th of July Fireworks at Sturgeon City Park',
        'Camp Lejeune Air Show (biennial) - military aircraft demonstrations',
        'Veterans Day Ceremonies (November) - major military community celebration',
        'North Topsail Beach Turtle Watch (Summer)',
        'Jacksonville Christmas Parade (December)',
        'Onslow County Museum events (year-round)'
      ]
    },
    'apex': {
      county: 'Wake County',
      stateSalesTax: '4.75%', localSalesTax: '2.50%', totalSalesTax: '7.25%',
      propertyTax: '0.6000% (Wake County) + 0.3850% (Town) = ~0.985% combined rate',
      medianHome: '~$460,000',
      weather: {
        highs: [50,54,63,72,80,87,90,88,82,72,62,52],
        lows:  [29,31,39,48,57,65,70,69,62,50,40,31]
      },
      events: [
        'PeakFest (May) - Apex\'s signature annual community festival with live music and food',
        'Hops & Harvest Beer Festival (October)',
        'Apex Farmers Market (May-November every Saturday)',
        'Apex Christmas Parade (December)',
        'SAS Championship Golf (October) - PGA Tour Champions in nearby Cary',
        'Wake County Speedway events (Spring-Fall)'
      ]
    },
    'huntersville': {
      county: 'Mecklenburg County',
      stateSalesTax: '4.75%', localSalesTax: '2.50%', totalSalesTax: '7.25%',
      propertyTax: '0.6169% (Mecklenburg County) + 0.2175% (Town) = ~0.834% combined rate',
      medianHome: '~$400,000',
      weather: {
        highs: [51,55,64,73,81,88,91,90,83,73,63,53],
        lows:  [31,33,41,50,59,67,71,70,63,51,41,33]
      },
      events: [
        'Huntersville Family Festival (October) - annual community celebration',
        'Lake Norman Dragon Boat Festival (Summer)',
        'Birkdale Village Outdoor Concert Series (Summer)',
        'Charlotte Motor Speedway NASCAR races (May & October) - nearby',
        'Lake Norman State Park Nature events (year-round)',
        'Huntersville Christmas Parade (December)'
      ]
    },
    'burlington': {
      county: 'Alamance County',
      stateSalesTax: '4.75%', localSalesTax: '2.00%', totalSalesTax: '6.75%',
      propertyTax: '0.6160% (Alamance County) + 0.5550% (City) = ~1.171% combined rate',
      medianHome: '~$225,000',
      weather: {
        highs: [49,53,62,72,79,86,89,88,82,72,62,52],
        lows:  [29,31,39,48,57,65,69,68,61,49,39,31]
      },
      events: [
        'Alamance County Fair (October) - rides, exhibits, and livestock',
        'Downtown Burlington Alive After Five (Summer) - outdoor concert series',
        'Company Shops Market Community Events (year-round)',
        'Burlington City Park Carousel season (Spring-Fall)',
        'Elon University Homecoming (October)',
        'Burlington Christmas Parade (December)'
      ]
    },
    'rocky mount': {
      county: 'Nash County',
      stateSalesTax: '4.75%', localSalesTax: '2.00%', totalSalesTax: '6.75%',
      propertyTax: '0.8250% (Nash County) + 0.6200% (City) = ~1.445% combined rate',
      medianHome: '~$195,000',
      weather: {
        highs: [51,55,63,73,80,87,90,89,83,73,64,53],
        lows:  [29,31,38,48,57,65,69,68,62,50,40,31]
      },
      events: [
        'Nash County Agricultural Fair (October)',
        'Eastern NC BBQ Festival (Spring) - celebrating Eastern-style BBQ tradition',
        'Rocky Mount Brewfest (Fall)',
        'Rocky Mount Mills events and markets (year-round) - historic converted mill',
        'Imperial Centre for the Arts and Sciences events (year-round)',
        'Rocky Mount Christmas Parade (December)'
      ]
    },
    'wilson': {
      county: 'Wilson County',
      stateSalesTax: '4.75%', localSalesTax: '2.00%', totalSalesTax: '6.75%',
      propertyTax: '0.8300% (Wilson County) + 0.6550% (City) = ~1.485% combined rate',
      medianHome: '~$185,000',
      weather: {
        highs: [51,55,63,73,80,87,90,89,83,73,64,53],
        lows:  [29,31,38,48,57,65,69,68,62,50,40,31]
      },
      events: [
        'Wilson Whirligig Festival (November) - celebrating folk artist Vollis Simpson\'s whirligigs',
        'Wilson BBQ Festival (May) - Eastern NC-style BBQ competition',
        'Wilson County Fair (September) - one of Eastern NC\'s premier county fairs',
        'Vollis Simpson Whirligig Park (year-round free attraction)',
        'Barton College cultural events (year-round)',
        'Wilson Christmas Parade (December)'
      ]
    },
    'mooresville': {
      county: 'Iredell County',
      stateSalesTax: '4.75%', localSalesTax: '2.00%', totalSalesTax: '6.75%',
      propertyTax: '0.5025% (Iredell County) + 0.4825% (Town) = ~0.985% combined rate',
      medianHome: '~$420,000',
      weather: {
        highs: [51,55,64,73,81,88,91,90,83,73,63,53],
        lows:  [31,33,41,50,59,67,71,70,63,51,41,33]
      },
      events: [
        'Iredell County Fair (October) - rides, exhibits, and entertainment',
        'Lake Norman Wine Festival (Spring)',
        'Lake Norman Dragon Boat Festival (Summer)',
        'Downtown Mooresville Car Shows (Spring-Fall) - NASCAR heritage celebrations',
        'Mooresville Christmas Parade (December)',
        'NASCAR Technical Institute Demo events (year-round)'
      ]
    }
  };

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const toCityLower = toCity.toLowerCase().replace(/,.*/, '').trim();
  let cityData = null;
  for (const [key, val] of Object.entries(NC_CITIES)) {
    if (toCityLower.includes(key) || key.includes(toCityLower)) {
      cityData = val;
      break;
    }
  }

  const taxBlock = cityData
    ? `VERIFIED TAX RATES for ${toCity} (${cityData.county}) - USE THESE EXACTLY:
- NC State Income Tax: 4.5% flat rate (2024)
- State Sales Tax: ${cityData.stateSalesTax}
- Local Sales Tax: ${cityData.localSalesTax}
- Total Combined Sales Tax: ${cityData.totalSalesTax}
- Property Tax: ${cityData.propertyTax}
- Median Home Price: ${cityData.medianHome}
- NC has NO inventory tax and NO inheritance tax`
    : `NC State Income Tax: 4.5% flat rate. NC Sales Tax: 4.75% state + local (total typically 6.75-7.25%). NC has no inventory or inheritance tax.`;

  const weatherBlock = cityData
    ? `VERIFIED MONTHLY WEATHER for ${toCity} - USE THESE EXACT NUMBERS:
${months.map((m,i) => `${m}: High ${cityData.weather.highs[i]}°F / Low ${cityData.weather.lows[i]}°F`).join('\n')}`
    : '';

  const eventsBlock = cityData
    ? `VERIFIED ANNUAL EVENTS in ${toCity} (${cityData.county}) - USE THESE EXACTLY, do not add fictional events:
${cityData.events.map((e,i) => `${i+1}. ${e}`).join('\n')}`
    : '';

  const verifiedFacts = [taxBlock, weatherBlock, eventsBlock].filter(Boolean).join('\n\n');

  const prompt = `You are an NC relocation expert. ${name} is moving from ${fromCity} to ${toCity} NC as ${personaLabel}.

IMPORTANT - Use these verified facts exactly as provided. Do not alter tax rates, weather temperatures, or event names:

${verifiedFacts}

For restaurant names, church names, school names, and hospital names - only include real, well-known establishments that actually exist in that city. Do not invent names.

Return ONLY a JSON object (no markdown, no backticks, no explanation) with these exact keys:
headline (string), tagline (string), pills (array of 4 strings), stats (array of 6 objects with label and value - use verified tax and home price data), city_overview (string 3-4 sentences), coming_from (string 2-3 sentences about transitioning from ${fromCity}), neighborhoods (object with intro string and list array of 4 objects each with name and vibe), schools (object with intro string and public array and private array and higher_ed array), hospitals (object with intro string and list array of 2 objects each with name ranking note), worship (object with intro string and list array of exactly 5 strings each being a real specific place of worship name and denomination - required never empty), restaurants (object with intro string describing the overall food scene in 2-3 sentences, and categories array. Each category has a category string and picks array of the top 3 real specific restaurants ranked by Google rating plus local reputation combined. CRITICAL: Every restaurant name must be a REAL establishment that actually exists within 10 miles of the city - never invent names. Each pick string format: "Restaurant Name - specific description - neighborhood or area". Include these categories: 1) Local Favorites - top 3 most beloved local spots 2) Fine Dining - top 3 upscale restaurants 3) Casual and Family - top 3 family-friendly spots 4) Brunch and Coffee - top 3 brunch and coffee shops 5) BBQ and Southern - top 3 BBQ or Southern food restaurants 6) International: Brazilian Steakhouse - top 1-3 if they exist within 10 miles, otherwise omit this category entirely 7) International: Italian - top 3 Italian restaurants 8) International: Asian - top 3 Asian restaurants specifying Chinese/Japanese/Thai/Vietnamese etc 9) International: Mexican and Latin - top 3 Mexican or Latin restaurants 10) International: Caribbean and Jamaican - top 1-3 if they exist within 10 miles, otherwise omit this category entirely 11) International: Greek and Mediterranean - top 3 if available, otherwise omit 12) International: Indian - top 3 Indian restaurants if available within 10 miles, otherwise omit. For smaller cities substitute best available options in each category. Never include a category with zero real options - omit it entirely instead), family_activities (array of 6 strings), nightlife (array of 5 strings), outdoor_recreation (array of 5 strings), shopping (array of 4 strings), annual_events (array - use the verified events provided above exactly as listed), weather_summary (string 2-3 sentences describing the annual climate using the verified monthly temperatures above), persona_insights (object with families string and singles string and retirees string), denniss_take (string 2-3 sentences as Dennis Fields NC mortgage expert), adjustment_tips (array of 4 strings), mortgage_insight (string 2-3 sentences about mortgage market using verified home price and tax data)`;

  try {
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
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const responseText = await response.text();
    if (!response.ok) {
      return res.status(500).json({ error: 'Anthropic API error', status: response.status, details: responseText });
    }

    const data = JSON.parse(responseText);
    const raw = data.content[0].text;
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({ error: 'Exception: ' + err.message });
  }
}
