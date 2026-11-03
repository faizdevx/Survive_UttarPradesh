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
| MLAs, declared cases and assets | MyNeta/ADR affidavits from 2022, with later bye-election winners from Wikipedia | Refreshed by `node scripts/build-netas.mjs`, then `node scripts/build-seats.mjs` |
| Chunav mode seats | Boundaries by [DataMeet](https://github.com/datameet/maps/tree/master/assembly-constituencies) ([CC BY 2.5 IN](http://creativecommons.org/licenses/by/2.5/in/)). 2022 votes and margins from Wikipedia | Refreshed by `node scripts/build-seats.mjs` |
| Weather and air quality | Open-Meteo | Yes |
| Kohra and loo meter | Open-Meteo forecast. Fog risk combines visibility, humidity, dew point and wind, and has not been checked against real fog records | Yes, cached 1 hour |
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
| Mera Hisaab budget | PRS Legislative Research, UP Budget Analysis 2026-27 | Refreshed by `node scripts/build-hisaab.mjs` |
| Mera Hisaab MP funds | MoSPI MPLADS portal, Lok Sabha MPs, current term. Contractor names removed | Server rechecks every 6 hours |

## Ghoomo

Ten niche pages, most of them hand-collected: Kohra meter (live fog and loo risk), Samay slider (Esri Wayback imagery back to 2014), Tune the TV (Radio Browser), Sirf is mausam mein, Bhojan by train, Naak ka naksha, Bhasha slider, Aakhri karigar, Plate bingo and Ajeeb gaon. Hand-collected entries live in `public/js/ghoomo-data.js` and have not been checked on the ground. Dialect lines still need native speakers.

## Mera Hisaab

Keeps each kind of evidence apart, so a budget is never shown as a payment and a payment is never shown as a finished work. The stages and the rule of showing gaps are inspired by the open [Hisaab](https://github.com/theadiram/Hisaab) project (MIT). No code or data was copied.

## What it leaves out on purpose

- Home addresses of actors, politicians or anyone else. People are shown by birthplace only.
- Vehicle owner lookup. The plate tool only names the RTO.
- Neighbourhood-level religion or caste maps. Figures stop at district level.
- Lawyer rankings. No public source has win rates, so the site shows mapped offices, case news and Reddit threads.
- Rupee-level project spending. No open feed exists, so the site links to government portals and RTI.
