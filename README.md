# Survive Uttar Pradesh

A live satellite map of Uttar Pradesh. Tap a district to get its name in English, Hindi and Urdu, today's air and news, its MPs and MLAs, who comes from there, and where to find chai, a lawyer or a passport office.

## Run it

Needs Node 20 or newer. No install step.

```bash
npm start
```

Then open http://localhost:4173.

## Where the data comes from

| Feature | Source | Live? |
| --- | --- | --- |
| Satellite map | Esri World Imagery | Yes |
| Party layer | 2024 Lok Sabha results, from Wikipedia | Refreshed by `npm run build:data` |
| MLAs, declared cases and assets | MyNeta/ADR affidavits from 2022 and later bye-elections. 398 of 403 seats parsed | Refreshed by `node scripts/build-netas.mjs` |
| Weather and air quality | Open-Meteo | Yes |
| Landmarks near you | Wikipedia geosearch | Yes, cached 10 minutes |
| Events, films, companies | Wikidata | Yes, cached 10 minutes |
| Headline meters and money | Counted from Google News titles. Attention, not support or spending | Yes, cached 10 minutes |
| Craft product | One District One Product, entered by hand | Fixed |
| Religion layer | Census 2011, from Wikipedia | Fixed |
| Caste blocs | Hand-written from press coverage. No official count exists after 1931 | Fixed, approximate |
| Nearby places | OpenStreetMap through two Overpass servers, with Photon as a fallback | Yes |
| News | Google News RSS | Yes, cached 10 minutes |
| Reddit threads | Reddit search RSS | Yes, cached 10 minutes |
| Famous people | Wikidata, by birthplace | Yes, cached 10 minutes |
| Projects | Press-reported totals in `public/js/content.js`, with live news | Totals fixed |

## What it leaves out on purpose

- Home addresses of actors, politicians or anyone else. People are shown by birthplace only.
- Vehicle owner lookup. The plate tool only names the RTO.
- Neighbourhood-level religion or caste maps. Figures stop at district level.
- Lawyer rankings. No public source has win rates, so the site shows mapped offices, case news and Reddit threads.
- Rupee-level project spending. No open feed exists, so the site links to government portals and RTI.
