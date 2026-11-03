// What was found for each project, by proof type, checked by web search on 3 Nov 2026.
// kind: official (a government page), press (news or a trade site), wiki. differ: true when sources disagree.
// Nothing is listed under payments: no public payment record for these projects was found.
const L = {
  upeidaGanga: 'https://upeida.up.gov.in/en/page/ganga-expressway',
  gangaPress: 'https://indianinfrastructure.com/2026/04/30/ganga-expressway-worth-rs-362-30-billion-gets-inaugurated/',
  purvOpen: 'https://invest.up.gov.in/wp-content/uploads/2021/11/press-release-16nov21-1.pdf',
  purvWiki: 'https://en.wikipedia.org/wiki/Purvanchal_Expressway',
  purvMetro: 'https://themetrorailguy.com/upeida-purvanchal-expressway-information-route-map-status/',
  bundOpen: 'https://invest.up.gov.in/wp-content/uploads/2022/07/press-release-16july22-7.pdf',
  linkPress: 'https://www.nbmcw.com/news/rs7-283-28-cr-gorakhpur-link-expressway-inaugurated-by-cm-yogi-adityanath.html',
  linkWiki: 'https://en.wikipedia.org/wiki/Gorakhpur_Link_Expressway',
  rrtsOpen: 'https://www.newsonair.gov.in/pm-modi-flags-off-meerut-metro-namo-bharat-train-in-uttar-pradesh',
  rrtsWiki: 'https://en.wikipedia.org/wiki/Delhi%E2%80%93Meerut_Regional_Rapid_Transit_System',
  noida: 'https://www.pib.gov.in/PressReleasePage.aspx?PRID=2246413&reg=3&lang=1',
  kanpurWiki: 'https://en.wikipedia.org/wiki/Kanpur_Metro',
  kanpurNews: 'https://metrorailnews.in/projects/kanpur-metro/',
  agraWiki: 'https://en.wikipedia.org/wiki/Agra_Metro',
  agraNews: 'https://metrorailnews.in/metro-rail-projects-in-india/',
  lkoApproval: 'https://pmindia.gov.in/en/news_updates/approval-for-lucknow-metro-rail-project-phase-1a',
  lkoStatus: 'https://lmrcl.com/project/project-status',
  ropewayContract: 'https://urbantransportnews.com/news/vs-engg-secures-order-worth-807-crore-to-build-indias-first-urban-ropeway-in-varanasi',
  ropewayWiki: 'https://en.wikipedia.org/wiki/Kashi_ropeway',
  kashiPib: 'https://newindiasamachar.pib.gov.in/WriteReadData/flipbook/2026/Jun/1st/English/files/basic-html/page64.html',
  kashiPress: 'https://scroll.in/latest/1012699/prime-minister-narendra-modi-to-inaugurate-first-phase-of-kashi-vishwanath-corridor-today',
  ayodhya: 'https://www.pmindia.gov.in/en/news_updates/pm-inaugurates-maharishi-valmiki-international-airport-at-ayodhya-dham/',
};

export const EVIDENCE = {
  'Ganga Expressway': {
    cost: { text: '₹36,230 cr construction cost. Wikipedia gives ₹37,350 cr including land.', url: L.gangaPress, kind: 'press', differ: true },
    contract: { text: 'Split into 12 packages on a design-build-finance-operate-transfer model.', url: L.upeidaGanga, kind: 'official' },
    opened: { text: 'Inaugurated 29 April 2026, per UPEIDA.', url: L.upeidaGanga, kind: 'official' },
  },
  'Purvanchal Expressway': {
    cost: { text: '₹22,494 cr including land. Construction alone about ₹11,216 cr.', url: L.purvWiki, kind: 'wiki', differ: true },
    contract: { text: '8 packages to 5 contractors. Sources disagree on the names, so none are listed here.', url: L.purvMetro, kind: 'press', differ: true },
    opened: { text: 'Inaugurated 16 November 2021.', url: L.purvOpen, kind: 'official' },
  },
  'Bundelkhand Expressway': {
    cost: { text: 'About ₹14,850 cr, per the state press release. Wikipedia gives ₹14,716 cr.', url: L.bundOpen, kind: 'official', differ: true },
    opened: { text: 'Inaugurated 16 July 2022.', url: L.bundOpen, kind: 'official' },
  },
  'Gorakhpur Link Expressway': {
    cost: { text: '₹7,283.28 cr in press reports. Wikipedia gives about ₹5,876 cr including land.', url: L.linkPress, kind: 'press', differ: true },
    opened: { text: 'Inaugurated 20 June 2025.', url: L.linkPress, kind: 'press' },
  },
  'Delhi-Meerut Namo Bharat (RRTS)': {
    cost: { text: '₹30,274 cr. A check of official sources did not confirm this figure.', url: L.rrtsWiki, kind: 'wiki' },
    opened: { text: 'Full 82 km corridor dedicated 22 February 2026.', url: L.rrtsOpen, kind: 'official' },
  },
  'Noida International Airport, Jewar': {
    cost: { text: 'About ₹11,200 cr for Phase I, as a public-private partnership.', url: L.noida, kind: 'official' },
    contract: { text: 'Concession held by Yamuna International Airport Pvt Ltd.', url: L.noida, kind: 'official' },
    opened: { text: 'Phase I inaugurated 28 March 2026. Flights were to follow later.', url: L.noida, kind: 'official' },
  },
  'Kanpur Metro': {
    cost: { text: 'About ₹11,076 cr.', url: L.kanpurWiki, kind: 'wiki' },
    opened: { text: 'Partly open: about 15 km of the planned 32 km, per an October 2026 tracker.', url: L.kanpurNews, kind: 'press' },
  },
  'Agra Metro': {
    cost: { text: '₹8,379 cr. A check of official sources did not confirm this figure.', url: L.agraWiki, kind: 'wiki' },
    opened: { text: 'Partly open: about 6 km of the planned 30 km, per an October 2026 tracker. Another page disagrees.', url: L.agraNews, kind: 'press', differ: true },
  },
  'Lucknow Metro': {
    cost: { text: '₹6,928 cr estimate at approval. Final spending not confirmed.', url: L.lkoApproval, kind: 'official' },
    sanction: { text: 'Phase 1A approved by the Union Cabinet in 2015.', url: L.lkoApproval, kind: 'official' },
    opened: { text: 'North-South corridor running in full from 8 March 2019.', url: L.lkoStatus, kind: 'official' },
  },
  'Varanasi ropeway': {
    cost: { text: 'Sources give ₹645 cr, ₹807 cr and ₹815.6 cr.', url: L.ropewayContract, kind: 'press', differ: true },
    contract: { text: 'Awarded December 2022 to Visvasamudra Engineering with Bartholet.', url: L.ropewayContract, kind: 'press' },
    note: 'Wikipedia still lists this as under construction.',
    noteUrl: L.ropewayWiki,
  },
  'Kashi Vishwanath Corridor': {
    cost: { text: 'Phase one about ₹339 cr to ₹355 cr. An early estimate was ₹750 cr.', url: L.kashiPib, kind: 'official', differ: true },
    opened: { text: 'First phase inaugurated 13 December 2021.', url: L.kashiPress, kind: 'press' },
  },
  'Maharishi Valmiki Airport, Ayodhya': {
    cost: { text: 'More than ₹1,450 cr for Phase 1.', url: L.ayodhya, kind: 'official' },
    opened: { text: 'Phase 1 inaugurated 30 December 2023.', url: L.ayodhya, kind: 'official' },
  },
};
