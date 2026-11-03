// Hand-collected content for Ghoomo. Stops use a district's main town unless they carry their own lat and lng.

export const SAMAY_SPOTS = [
  { name: 'Sangam, Prayagraj', lat: 25.43, lng: 81.885, zoom: 14, mela: true, note: 'Sand changes every year as the rivers move. Mela tents show up only if a satellite passed at the right time.' },
  { name: 'Jewar airport', lat: 28.17, lng: 77.61, zoom: 14, note: 'Fields become a runway. Drag the slider to watch it happen.' },
  { name: 'Greater Noida West', lat: 28.6, lng: 77.43, zoom: 14, note: 'Farmland turning into towers.' },
  { name: 'Ram Mandir, Ayodhya', lat: 26.795, lng: 82.194, zoom: 16, note: 'Watch the temple site change.' },
  { name: 'Kashi Vishwanath corridor', lat: 25.31, lng: 83.01, zoom: 17, note: 'Old lanes cleared down to the Ganga.' },
  { name: 'Purvanchal Expressway', lat: 26.75, lng: 81.5, zoom: 14, note: '₹22,494 crore reported. Look for the new line across the fields.' },
];

export const TRAIN_ROUTES = [
  {
    name: 'Delhi to Varanasi, main line',
    stops: [
      { town: 'Khurja', lat: 28.25, lng: 77.85, food: 'Khurchan', note: 'Scraped, sweet thickened milk.' },
      { town: 'Aligarh', district: 'Aligarh', food: 'Kachori and jalebi', note: 'Station-side breakfast.' },
      { town: 'Tundla', lat: 27.21, lng: 78.24, food: 'Chai and pakora', note: 'Change here for Agra.' },
      { town: 'Etawah', district: 'Etawah', food: 'Besan laddu', note: 'Ask around the station road.' },
      { town: 'Kanpur', district: 'Kanpur Nagar', food: 'Thaggu ke laddu', note: 'A city shop with a famous slogan, so plan on leaving the station.' },
      { town: 'Prayagraj', district: 'Prayagraj', food: 'Kachori sabzi, Surkha guava in winter', note: 'Guava is seasonal.' },
      { town: 'Varanasi', district: 'Varanasi', food: 'Kachori sabzi, lassi, paan', note: 'End of the line. Eat properly.' },
    ],
  },
  {
    name: 'Delhi to Lucknow via Moradabad',
    stops: [
      { town: 'Hapur', district: 'Hapur', food: 'Papad', note: 'Hapur papad is sold across north India.' },
      { town: 'Moradabad', district: 'Moradabad', food: 'Moradabadi dal', note: 'Thin, spicy, topped with everything.' },
      { town: 'Bareilly', district: 'Bareilly', food: 'Seekh kebab, barfi', note: 'Worth a stop if you are not in a rush.' },
      { town: 'Sandila', lat: 27.07, lng: 80.52, food: 'Sandila laddu', note: 'Vendors have sold these on this line for generations.' },
      { town: 'Lucknow', district: 'Lucknow', food: 'Kebab, kulcha nihari, makhan malai in winter', note: 'Saved the best for last.' },
    ],
  },
  {
    name: 'Delhi to Agra',
    stops: [
      { town: 'Mathura', district: 'Mathura', food: 'Mathura peda', note: 'Buy from the old city if you have time.' },
      { town: 'Agra', district: 'Agra', food: 'Petha, dalmoth, bedai', note: 'Bedai for breakfast, petha for the bag.' },
    ],
  },
  {
    name: 'Lucknow to Varanasi',
    stops: [
      { town: 'Rae Bareli', district: 'Rae Bareli', food: 'Chai and samosa', note: 'Standard platform fuel.' },
      { town: 'Pratapgarh', district: 'Pratapgarh', food: 'Amla murabba and candy', note: 'Pratapgarh grows most of the amla you have eaten.' },
      { town: 'Jaunpur', district: 'Jaunpur', food: 'Imarti', note: "Jaunpur's imarti is the local claim to fame." },
      { town: 'Varanasi', district: 'Varanasi', food: 'Malaiyo in winter, thandai in summer', note: 'Malaiyo vanishes once the cold goes.' },
    ],
  },
];

export const SEASON_FOOD = [
  { food: 'Makhan malai', district: 'Lucknow', months: [11, 12, 1, 2], note: 'Sold at dawn in the old city. Melts if it warms up.' },
  { food: 'Malaiyo', district: 'Varanasi', months: [11, 12, 1, 2], note: 'Milk foam set by morning dew, by local telling.' },
  { food: 'Surkha guava', district: 'Prayagraj', months: [11, 12, 1, 2], note: 'Red-skinned guava the old Allahabad was known for.' },
  { food: 'Fresh gur', district: 'Muzaffarnagar', months: [11, 12, 1, 2, 3], note: 'Cane crushing season. Kolhus run by the roadside.' },
  { food: 'Gajak and revdi', district: 'Meerut', months: [11, 12, 1, 2], note: 'Sesame and jaggery, for the cold.' },
  { food: 'Fresh amla', district: 'Pratapgarh', months: [11, 12, 1, 2], note: 'Sour enough to wake you up.' },
  { food: 'Gujiya and thandai', district: 'Mathura', months: [3], note: 'Holi in Braj. Plan ahead and watch your clothes.' },
  { food: 'Aam panna', district: 'Lucknow', months: [4, 5, 6], note: 'Raw mango cooler for the loo.' },
  { food: 'Dasheri mango', district: 'Lucknow', lat: 26.92, lng: 80.71, months: [6, 7], note: 'Malihabad orchards, just outside Lucknow.' },
  { food: 'Langra mango', district: 'Varanasi', months: [6, 7], note: 'Banaras claims this one.' },
  { food: 'Chausa mango', district: 'Hardoi', months: [7, 8], note: 'Last mango of the year, so do not wait.' },
  { food: 'Ghevar', district: 'Agra', months: [7, 8], note: 'Sawan sweet that disappears from shops afterwards.' },
];

export const SMELLS = [
  { smell: 'Attar', district: 'Kannauj', note: 'Rose and rain-on-earth perfume, distilled in copper the old way.' },
  { smell: 'Hing', district: 'Hathras', note: 'Asafoetida. You will smell the factories before you see them.' },
  { smell: 'Rose water', district: 'Ghazipur', note: 'Old rose distilling town on the Ganga.' },
  { smell: 'Tanneries', district: 'Kanpur Nagar', lat: 26.43, lng: 80.42, note: 'Jajmau, the leather belt. Strong is a polite word.' },
  { smell: 'Boiling gur', district: 'Muzaffarnagar', note: 'Winter roads smell of burnt sugar.' },
  { smell: 'Hot glass', district: 'Firozabad', note: 'Furnaces burn day and night in the bangle town.' },
  { smell: 'Kebab smoke', district: 'Lucknow', lat: 26.87, lng: 80.91, note: 'Old city at sundown.' },
  { smell: 'Marigold and incense', district: 'Varanasi', lat: 25.307, lng: 83.01, note: 'The ghats at aarti time.' },
  { smell: 'Brass polish', district: 'Moradabad', note: 'Metal workshops in Peetal Nagri.' },
  { smell: 'Wet wool', district: 'Bhadohi', note: 'Carpet dye and washing yards.' },
  { smell: 'Mango blossom', district: 'Lucknow', lat: 26.92, lng: 80.71, note: 'Malihabad, in early spring.' },
  { smell: 'Fresh clay', district: 'Bulandshahr', lat: 28.25, lng: 77.85, note: 'Khurja pottery kilns.' },
];

export const DIALECTS = [
  { key: 'kauravi', wiki: 'Hindustani_language', name: 'Kauravi', color: '#D3201F', where: 'Meerut side', lines: [['कित जा रया है?', 'Kit ja rya hai?'], ['के कर रया है?', 'Ke kar rya hai?']], districts: ['Saharanpur', 'Muzaffarnagar', 'Shamli', 'Baghpat', 'Meerut', 'Ghaziabad', 'Gautam Buddha Nagar', 'Hapur', 'Bulandshahr', 'Bijnor', 'Moradabad', 'Rampur', 'Amroha', 'Sambhal'] },
  { key: 'braj', wiki: 'Braj_Bhasha', name: 'Braj', color: '#F08A1D', where: 'Mathura side', lines: [['कहाँ जाय रह्यो है?', 'Kahan jaay rahyo hai?'], ['का कर रह्यो है?', 'Ka kar rahyo hai?']], districts: ['Mathura', 'Agra', 'Aligarh', 'Hathras', 'Firozabad', 'Mainpuri', 'Etah', 'Kasganj', 'Budaun', 'Bareilly'] },
  { key: 'kannauji', wiki: 'Kannauji_language', name: 'Kannauji', color: '#F6C400', where: 'Kannauj side', lines: [['कहाँ जाय रहे हौ?', 'Kahan jaay rahe hau?'], ['का कर रहे हौ?', 'Ka kar rahe hau?']], districts: ['Kannauj', 'Farrukhabad', 'Etawah', 'Auraiya', 'Kanpur Nagar', 'Kanpur Dehat', 'Hardoi', 'Shahjahanpur', 'Pilibhit'] },
  { key: 'bundeli', wiki: 'Bundeli_language', name: 'Bundeli', color: '#8C5AC8', where: 'Jhansi side', lines: [['कितै जा रए?', 'Kite ja rae?'], ['का कर रए?', 'Ka kar rae?']], districts: ['Jhansi', 'Lalitpur', 'Jalaun', 'Hamirpur', 'Mahoba', 'Banda', 'Chitrakoot'] },
  { key: 'awadhi', wiki: 'Awadhi_language', name: 'Awadhi', color: '#1E7F3A', where: 'Lucknow and Ayodhya side', lines: [['कहाँ जात हौ?', 'Kahan jaat hau?'], ['का करत हौ?', 'Ka karat hau?']], districts: ['Lucknow', 'Unnao', 'Rae Bareli', 'Sitapur', 'Lakhimpur Kheri', 'Barabanki', 'Ayodhya', 'Ambedkar Nagar', 'Sultanpur', 'Amethi', 'Pratapgarh', 'Prayagraj', 'Kaushambi', 'Fatehpur', 'Bahraich', 'Shrawasti', 'Balrampur', 'Gonda'] },
  { key: 'bhojpuri', wiki: 'Bhojpuri_language', name: 'Bhojpuri', color: '#1C8FD6', where: 'Varanasi and Gorakhpur side', lines: [['कहाँ जात बाड़ा?', 'Kahan jaat baada?'], ['का करत बाड़ा?', 'Ka karat baada?']], districts: ['Varanasi', 'Chandauli', 'Ghazipur', 'Ballia', 'Azamgarh', 'Mau', 'Jaunpur', 'Bhadohi', 'Mirzapur', 'Sonbhadra', 'Gorakhpur', 'Deoria', 'Kushinagar', 'Maharajganj', 'Siddharthnagar', 'Basti', 'Sant Kabir Nagar'] },
];

// Trades and public places only. No private homes or named individuals.
export const KARIGAR = [
  { what: 'Kushti akhada', kind: 'Akhada', district: 'Varanasi', lat: 25.2945, lng: 83.0065, place: 'Tulsi Ghat', note: 'Mud-pit wrestling beside the Ganga. Go at dawn.' },
  { what: 'Ramnagar Ramlila', kind: 'Theatre', district: 'Varanasi', lat: 25.27, lng: 83.025, place: 'Ramnagar', note: 'A month-long Ramlila staged across the town, around Dussehra.' },
  { what: 'Banarasi handloom', kind: 'Craft', district: 'Varanasi', lat: 25.297, lng: 83.0, place: 'Madanpura', note: 'Weaving lanes. Look for the clack of the looms.' },
  { what: 'Gulabi meenakari', kind: 'Craft', district: 'Varanasi', lat: 25.32, lng: 83.02, place: 'Gai Ghat side', note: 'Pink enamel work, now done by a small number of workshops.' },
  { what: 'Kabootarbaazi', kind: 'Pastime', district: 'Lucknow', lat: 26.87, lng: 80.91, place: 'Old Lucknow', note: 'Pigeon flying from rooftops. Look up around sunset.' },
  { what: 'Patang makers', kind: 'Craft', district: 'Lucknow', lat: 26.865, lng: 80.915, place: 'Old Lucknow', note: 'Kite shops fill up before the kite days of winter and spring.' },
  { what: 'Chikankari', kind: 'Craft', district: 'Lucknow', lat: 26.868, lng: 80.915, place: 'Chowk', note: 'Embroidery, usually done by women working from home and sold through Chowk shops.' },
  { what: 'Dastangoi', kind: 'Storytelling', district: 'Lucknow', place: 'Lucknow', note: 'Old Urdu storytelling, revived at festivals. Check event listings.' },
  { what: 'Bansuri makers', kind: 'Craft', district: 'Pilibhit', place: 'Pilibhit', note: 'A big share of India’s flutes are cut here, from bamboo.' },
  { what: 'Black pottery', kind: 'Craft', district: 'Azamgarh', lat: 26.05, lng: 83.0, place: 'Nizamabad', note: 'Silver patterns on black clay.' },
  { what: 'Attar distilling', kind: 'Craft', district: 'Kannauj', place: 'Kannauj', note: 'Deg and bhapka, copper stills sealed with clay.' },
  { what: 'Terracotta', kind: 'Craft', district: 'Gorakhpur', place: 'Aurangabad village side', note: 'Horses and elephants, shaped by hand.' },
  { what: 'Khurja pottery', kind: 'Craft', district: 'Bulandshahr', lat: 28.25, lng: 77.85, place: 'Khurja', note: 'Blue-painted ceramics by the truckload.' },
  { what: 'Hathrasi nautanki', kind: 'Theatre', district: 'Hathras', place: 'Hathras', note: 'Folk musical theatre, now rare to catch. Ask locally around melas.' },
  { what: 'Sanjhi paper cutting', kind: 'Craft', district: 'Mathura', place: 'Vrindavan side', note: 'Fine stencils cut for temple floor art.' },
];
