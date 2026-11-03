// Hand-checked reference content. Everything else on the site comes from live sources.

export const PARTIES = {
  BJP: { name: 'BJP', color: '#F08A1D' },
  SP: { name: 'Samajwadi Party', color: '#D3201F' },
  INC: { name: 'Congress', color: '#1C8FD6' },
  RLD: { name: 'RLD', color: '#1E7F3A' },
  ADS: { name: 'Apna Dal (S)', color: '#8C5AC8' },
  ASP: { name: 'Azad Samaj Party', color: '#2B3FB0' },
  BSP: { name: 'BSP', color: '#3E6FE0' },
  SBSP: { name: 'SBSP', color: '#E8C91E' },
  NISHAD: { name: 'NISHAD Party', color: '#12A5A0' },
  JDL: { name: 'Jansatta Dal (L)', color: '#B5651D' },
};

// MyNeta spells some parties in full
export const NETA_PARTY = { 'Apna Dal (Soneylal)': 'ADS', 'Suheldev Bharatiya Samaj Party': 'SBSP', 'Nirbal Indian Shoshit Hamara Aam Dal': 'NISHAD', 'Jansatta Dal Loktantrik': 'JDL' };

export const HELPLINES = [
  ['112', 'Police, fire, ambulance'], ['108', 'Ambulance'], ['1090', 'Women Power Line'], ['181', 'Women helpline'], ['1098', 'Childline'],
  ['1930', 'Cyber fraud'], ['1076', 'CM helpline, complaints'], ['15100', 'Free legal aid'],
];

// Google Maps searches show numbers and reviews. The news terms find real cases.
export const LAW_CATS = [
  { label: 'Criminal, bail', maps: 'criminal lawyer', q: 'bail granted advocate' },
  { label: 'Murder, assault', maps: 'criminal defence advocate', q: 'murder case acquitted court' },
  { label: 'Land, property', maps: 'property lawyer', q: 'land dispute court order' },
  { label: 'Divorce, family', maps: 'family court lawyer', q: 'family court order' },
  { label: 'Cheque bounce', maps: 'cheque bounce lawyer', q: 'cheque bounce court' },
  { label: 'Cyber fraud', maps: 'cyber crime lawyer', q: 'cyber fraud court' },
  { label: 'Consumer', maps: 'consumer court lawyer', q: 'consumer commission order' },
  { label: 'Against netas', maps: 'high court advocate', q: 'MLA convicted OR acquitted court' },
];

export const AREA_CATS = [
  ['Food', 'best food area'], ['Hangout', 'best place to hang out'], ['Nightlife', 'nightlife OR night drive'],
  ['Shopping', 'shopping market street'], ['Live here', 'best area to live rent'], ['Nature', 'river OR park OR lake sunset'],
];

export const UNDER_TABS = [
  { key: 'river', label: 'Rivers, ghats', ages: ['senior', 'mid'] }, { key: 'bridge', label: 'Pul', ages: ['young'] },
  { key: 'tree', label: 'Big old trees', ages: ['mid', 'senior'] }, { key: 'art', label: 'Paintings, art', ages: ['teen', 'young'] },
];

// Subreddits per district. Anything else falls back to the state subreddit.
export const SUBS = {
  Lucknow: 'lucknow', 'Kanpur Nagar': 'kanpur', Varanasi: 'varanasi', Prayagraj: 'allahabad', Agra: 'agra', Meerut: 'meerut',
  Ghaziabad: 'ghaziabad', 'Gautam Buddha Nagar': 'noida', Gorakhpur: 'gorakhpur', Aligarh: 'aligarh', Bareilly: 'bareilly', Moradabad: 'moradabad',
  Jhansi: 'jhansi', Mathura: 'mathura', Ayodhya: 'ayodhya',
};

export const SEARCH_NAME = { 'Gautam Buddha Nagar': 'Noida', 'Kanpur Nagar': 'Kanpur', 'Lakhimpur Kheri': 'Lakhimpur' };

export const OLD_NAMES = {
  Prayagraj: 'Allahabad, Ilahabad', Ayodhya: 'Faizabad (district name until 2018), Saket', Varanasi: 'Banaras, Kashi', 'Kanpur Nagar': 'Cawnpore',
  Lucknow: 'Lakshmanpur, in old lore', Agra: 'Akbarabad', Mathura: 'Madhupuri, in old lore', Amroha: 'Jyotiba Phule Nagar (2008 to 2012)',
  Hathras: 'Mahamaya Nagar (2008 to 2012)', Kasganj: 'Kanshi Ram Nagar (2008 to 2012)', Amethi: 'Chhatrapati Shahuji Maharaj Nagar (2010 to 2012)',
  Bhadohi: 'Sant Ravidas Nagar', Bulandshahr: 'Baran', Gorakhpur: 'Akhtarnagar, under Mughal rule', Jhansi: 'Balwant Nagar', Rampur: 'Mustafabad',
  Moradabad: 'Chaupala', Aligarh: 'Koil', Ghaziabad: 'Ghaziuddin Nagar', Sultanpur: 'Kushbhawanpur', Mau: 'Maunath Bhanjan', Kannauj: 'Kanyakubja',
  Kaushambi: 'Kosam', Kushinagar: 'Kasia, Kushavati', Shrawasti: 'Sahet-Maheth', Chitrakoot: 'Chhatrapati Shahuji Maharaj Nagar (1997 to 1998)', Bareilly: 'Bans Bareilly', Pratapgarh: 'Bela',
};

export const CRAFT = {
  Lucknow: 'Chikankari embroidery, zardozi', Varanasi: 'Banarasi silk, Gulabi Meenakari', Moradabad: 'Brassware', Firozabad: 'Glass bangles',
  Bhadohi: 'Hand-knotted carpets', Azamgarh: 'Nizamabad black pottery', Saharanpur: 'Wood carving', Aligarh: 'Locks and hardware',
  Kannauj: 'Attar perfume', 'Kanpur Nagar': 'Leather', Agra: 'Marble inlay, leather shoes', Bulandshahr: 'Khurja ceramics', Meerut: 'Sports goods, scissors',
  Mirzapur: 'Carpets', Gorakhpur: 'Terracotta', Rampur: 'Rampur zari, knives', Sambhal: 'Horn and bone craft', Chitrakoot: 'Wooden toys',
  Barabanki: 'Handloom', Mathura: 'Sanjhi paper craft',
};

// One District One Product, the state's own craft list. Entered by hand.
export const ODOP = {
  Agra: 'Leather goods', Aligarh: 'Locks and hardware', 'Ambedkar Nagar': 'Textiles', Amethi: 'Moonj grass craft', Amroha: 'Musical instruments, dholak', Auraiya: 'Desi ghee',
  Ayodhya: 'Jaggery', Azamgarh: 'Black pottery', Baghpat: 'Home furnishings', Bahraich: 'Wheat-stalk craft', Ballia: 'Bindi', Balrampur: 'Pulses', Banda: 'Shazar stone craft',
  Barabanki: 'Textiles', Bareilly: 'Zari-zardozi', Basti: 'Wood craft', Bhadohi: 'Carpets', Bijnor: 'Wood craft', Budaun: 'Zari-zardozi', Bulandshahr: 'Ceramics', Chandauli: 'Zari-zardozi',
  Chitrakoot: 'Wooden toys', Deoria: 'Decorative goods', Etah: 'Ghungroo ankle bells', Etawah: 'Textiles', Farrukhabad: 'Textile printing', Fatehpur: 'Bed sheets, iron fabrication',
  Firozabad: 'Glass', 'Gautam Buddha Nagar': 'Readymade garments', Ghaziabad: 'Engineering goods', Ghazipur: 'Jute wall hangings', Gonda: 'Pulses', Gorakhpur: 'Terracotta', Hamirpur: 'Shoes',
  Hapur: 'Home furnishings', Hardoi: 'Handloom', Hathras: 'Hing, asafoetida', Jalaun: 'Handmade paper', Jaunpur: 'Woollen carpets', Jhansi: 'Soft toys', Kannauj: 'Attar perfume',
  'Kanpur Dehat': 'Aluminium utensils', 'Kanpur Nagar': 'Leather goods', Kasganj: 'Zari-zardozi', Kaushambi: 'Banana products', Kushinagar: 'Banana fibre', 'Lakhimpur Kheri': 'Tribal craft',
  Lalitpur: 'Zari silk sarees', Lucknow: 'Chikankari', Maharajganj: 'Furniture', Mahoba: 'Gaura stone craft', Mainpuri: 'Tarkashi metal inlay', Mathura: 'Sanitary fittings', Mau: 'Powerloom textiles',
  Meerut: 'Sports goods', Mirzapur: 'Carpets', Moradabad: 'Metal craft', Muzaffarnagar: 'Jaggery', Pilibhit: 'Flutes', Pratapgarh: 'Amla products', Prayagraj: 'Moonj grass craft', 'Rae Bareli': 'Wood work',
  Rampur: 'Patchwork, applique', Saharanpur: 'Wood craft', Sambhal: 'Horn and bone craft', 'Sant Kabir Nagar': 'Brassware', Shahjahanpur: 'Zari-zardozi', Shamli: 'Rims and axles', Shrawasti: 'Tribal craft',
  Siddharthnagar: 'Kalanamak rice', Sitapur: 'Carpets', Sonbhadra: 'Carpets', Sultanpur: 'Moonj grass craft', Unnao: 'Zari-zardozi', Varanasi: 'Banarasi silk',
};

export const MUSIC = {
  Lucknow: 'Lucknow gharana of Kathak and thumri', Varanasi: 'Banaras gharana of tabla and thumri', Agra: 'Agra gharana of Khayal',
  Rampur: 'Rampur-Sahaswan gharana', Budaun: 'Rampur-Sahaswan gharana',
  Mathura: 'Braj Rasiya folk songs', Ballia: 'Bhojpuri Birha and folk', Ghazipur: 'Bhojpuri Birha and folk',
  Hathras: 'Hathrasi Nautanki', 'Kanpur Nagar': 'Kanpur Nautanki',
};

export const HISTORY = {
  Meerut: ['1857: sepoys rose up here on 10 May, opening the Indian Rebellion.'],
  Gorakhpur: ['1922: the Chauri Chaura incident led Gandhi to call off Non-Cooperation.'],
  Lucknow: ['1857: the Siege of Lucknow at the Residency.', '1925: the Kakori train action took place just outside the city.'],
  'Kanpur Nagar': ['1857: the Siege of Cawnpore and Satichaura Ghat.'],
  Jhansi: ['1857 to 1858: Rani Lakshmibai held Jhansi against the British.'],
  Prayagraj: ['Anand Bhavan and Swaraj Bhavan became centres of the freedom movement.', '1931: Chandrashekhar Azad died in Alfred Park.'],
  Agra: ['1632 to 1653: the Taj Mahal was built.'],
  Ayodhya: ['1992: the Babri Masjid was demolished.', '2019: the Supreme Court ruled on the title dispute.', '2024: the Ram temple opened.'],
  Varanasi: ['528 BCE, by tradition: Buddha gave his first sermon at nearby Sarnath.'],
  Ballia: ['1942: Ballia briefly declared itself free during Quit India.'],
  Kushinagar: ['About 483 BCE, by tradition: Buddha died here.'],
  Mathura: ['1017 to 1018: Mahmud of Ghazni sacked the city.'],
  Etawah: ['1857: the district officer A. O. Hume, later a Congress founder, served here.'],
  Azamgarh: ['1857: Kunwar Singh fought the British around Azamgarh.'],
};

// What the press commonly names as vote blocs. No official caste count exists after 1931.
export const BLOCS = {
  Etawah: 'Yadav, Dalit, Lodh', Mainpuri: 'Yadav, Shakya, Thakur', Kannauj: 'Yadav, Muslim, Brahmin', Azamgarh: 'Yadav, Muslim, Dalit',
  Firozabad: 'Yadav, Jatav, Muslim', Baghpat: 'Jat, Muslim, Gurjar', Shamli: 'Jat, Gurjar, Muslim', Muzaffarnagar: 'Jat, Muslim, Dalit',
  Mathura: 'Jat, Thakur, Brahmin', Agra: 'Jatav, Vaishya, Brahmin', Saharanpur: 'Muslim, Dalit, Gurjar', Bijnor: 'Muslim, Dalit, Jat',
  Etah: 'Lodh, Yadav, Shakya', Gorakhpur: 'Nishad, Yadav, Brahmin, Thakur', Ballia: 'Bhumihar, Thakur, Yadav', Ghazipur: 'Yadav, Bhumihar, Dalit',
  Varanasi: 'Kurmi, Brahmin, Vaishya, Muslim', 'Rae Bareli': 'Pasi, Brahmin, Muslim', Amethi: 'Dalit, Brahmin, Muslim', Sonbhadra: 'Adivasi, Kol, Gond',
  Banda: 'Dalit, Brahmin, Kurmi', Mirzapur: 'Kurmi, Dalit, Brahmin', Lucknow: 'Muslim, Brahmin, Kayastha', Rampur: 'Muslim, Lodh, Dalit',
  Moradabad: 'Muslim, Dalit, Thakur', Meerut: 'Muslim, Dalit, Vaishya, Gurjar', Ghaziabad: 'Thakur, Vaishya, Dalit',
};

// Plate prefixes for UP. Number after UP is the RTO, not an owner.
export const RTO = {
  11: 'Saharanpur', 12: 'Muzaffarnagar', 13: 'Bulandshahr', 14: 'Ghaziabad', 15: 'Meerut', 16: 'Noida', 17: 'Baghpat', 19: 'Shamli',
  20: 'Bijnor', 21: 'Moradabad', 22: 'Rampur', 23: 'Amroha', 24: 'Budaun', 25: 'Bareilly', 26: 'Pilibhit', 27: 'Shahjahanpur',
  30: 'Hardoi', 31: 'Lakhimpur Kheri', 32: 'Lucknow', 33: 'Rae Bareli', 34: 'Sitapur', 35: 'Unnao', 36: 'Amethi', 37: 'Hapur', 38: 'Sambhal',
  40: 'Bahraich', 41: 'Barabanki', 42: 'Ayodhya', 43: 'Gonda', 44: 'Sultanpur', 45: 'Ambedkar Nagar', 46: 'Shrawasti', 47: 'Balrampur',
  50: 'Azamgarh', 51: 'Basti', 52: 'Deoria', 53: 'Gorakhpur', 54: 'Mau', 55: 'Siddharthnagar', 56: 'Maharajganj', 57: 'Kushinagar', 58: 'Sant Kabir Nagar',
  60: 'Ballia', 61: 'Ghazipur', 62: 'Jaunpur', 63: 'Mirzapur', 64: 'Sonbhadra', 65: 'Varanasi', 66: 'Bhadohi', 67: 'Chandauli',
  70: 'Prayagraj', 71: 'Fatehpur', 72: 'Pratapgarh', 73: 'Kaushambi',
  74: 'Kannauj', 75: 'Etawah', 76: 'Farrukhabad', 77: 'Kanpur Dehat', 78: 'Kanpur Nagar', 79: 'Auraiya',
  80: 'Agra', 81: 'Aligarh', 82: 'Etah', 83: 'Firozabad', 84: 'Mainpuri', 85: 'Mathura', 86: 'Hathras', 87: 'Kasganj',
  90: 'Banda', 91: 'Hamirpur', 92: 'Jalaun', 93: 'Jhansi', 94: 'Lalitpur', 95: 'Mahoba', 96: 'Chitrakoot',
};

// Reported headline costs. Status changes, so each card also pulls live news.
export const PROJECTS = [
  { name: 'Ganga Expressway', cost: '₹36,230 cr reported', km: '594 km', wiki: 'Ganga_Expressway', districts: ['Meerut', 'Hapur', 'Bulandshahr', 'Amroha', 'Sambhal', 'Budaun', 'Shahjahanpur', 'Hardoi', 'Unnao', 'Rae Bareli', 'Pratapgarh', 'Prayagraj'] },
  { name: 'Purvanchal Expressway', cost: '₹22,494 cr reported', km: '341 km', wiki: 'Purvanchal_Expressway', districts: ['Lucknow', 'Barabanki', 'Amethi', 'Sultanpur', 'Ayodhya', 'Ambedkar Nagar', 'Azamgarh', 'Mau', 'Ghazipur'] },
  { name: 'Bundelkhand Expressway', cost: '₹14,850 cr reported', km: '296 km', wiki: 'Bundelkhand_Expressway', districts: ['Chitrakoot', 'Banda', 'Hamirpur', 'Jalaun', 'Auraiya', 'Etawah'] },
  { name: 'Gorakhpur Link Expressway', cost: '₹5,876 to ₹7,283 cr reported', km: '91 km', wiki: 'Gorakhpur_Link_Expressway', districts: ['Gorakhpur', 'Sant Kabir Nagar', 'Ambedkar Nagar', 'Azamgarh'] },
  { name: 'Delhi-Meerut Namo Bharat (RRTS)', cost: '₹30,274 cr reported', km: '82 km', wiki: 'Delhi%E2%80%93Meerut_Regional_Rapid_Transit_System', districts: ['Ghaziabad', 'Meerut'] },
  { name: 'Noida International Airport, Jewar', cost: 'Phase one about ₹11,200 cr reported', km: '', wiki: 'Noida_International_Airport', districts: ['Gautam Buddha Nagar'] },
  { name: 'Kanpur Metro', cost: '₹11,076 cr reported', km: '32 km planned', wiki: 'Kanpur_Metro', districts: ['Kanpur Nagar'] },
  { name: 'Agra Metro', cost: '₹8,379 cr reported', km: '30 km planned', wiki: 'Agra_Metro', districts: ['Agra'] },
  { name: 'Lucknow Metro', cost: '₹6,928 cr reported, phase one', km: '23 km operating', wiki: 'Lucknow_Metro', districts: ['Lucknow'] },
  { name: 'Varanasi ropeway', cost: 'About ₹800 cr reported', km: '3.8 km', wiki: 'Varanasi_Ropeway', districts: ['Varanasi'] },
  { name: 'Kashi Vishwanath Corridor', cost: 'About ₹800 cr reported', km: '', wiki: 'Kashi_Vishwanath_Corridor', districts: ['Varanasi'] },
  { name: 'Maharishi Valmiki Airport, Ayodhya', cost: 'About ₹1,450 cr reported, phase one', km: '', wiki: 'Ayodhya_Airport', districts: ['Ayodhya'] },
];

export const MONEY_LINKS = [
  { label: 'data.gov.in open budget and scheme data', url: 'https://www.data.gov.in/' },
  { label: 'eGramSwaraj, village panchayat spending', url: 'https://egramswaraj.gov.in/' },
  { label: 'PMGSY rural road progress', url: 'https://omms.nic.in/' },
  { label: 'MPLADS, what each MP spent', url: 'https://mplads.mospi.gov.in/' },
  { label: 'PFMS, central scheme payments', url: 'https://pfms.nic.in/' },
  { label: 'File an RTI for line-item spending', url: 'https://rtionline.up.gov.in/' },
];

export const PAPERS = [
  {
    key: 'voter', osm: 'voter', title: 'Voter ID (EPIC)', time: 'Usually 2 to 6 weeks', place: 'Tehsil and election offices', reddit: 'voter id',
    link: { label: 'Open the ECI voter portal', url: 'https://voters.eci.gov.in/' },
    steps: ['Be 18 or older on a qualifying date.', 'Fill Form 6 on the ECI portal or give it to your booth level officer (BLO).', 'Attach age and address proof with a photo.', 'Wait for the BLO to visit and verify.', 'The electoral officer decides, then the card comes by post. Download the e-EPIC meanwhile.'],
  },
  {
    key: 'passport', osm: 'passport', title: 'Passport', time: 'Normal about 2 to 4 weeks. Tatkal is faster and costs more', place: 'Passport Seva Kendras and post office centres', radius: 80000, reddit: 'passport police verification',
    link: { label: 'Open Passport Seva', url: 'https://www.passportindia.gov.in/' },
    steps: ['Register on Passport Seva and fill the form.', 'Pay online and book a slot at a PSK or POPSK.', 'Carry originals of address and birth proof.', 'Finish biometrics and document checks at the centre.', 'Clear police verification at your local station.', 'Track the dispatch, then receive it by Speed Post.'],
  },
  {
    key: 'aadhaar', osm: 'aadhaar', title: 'Aadhaar', time: 'Up to 90 days, often far less', place: 'Aadhaar centres and post offices', reddit: 'aadhaar center',
    link: { label: 'Open UIDAI', url: 'https://uidai.gov.in/' },
    steps: ['Book an appointment or walk in to an enrolment centre.', 'Bring proof of identity and address.', 'Give biometrics. First enrolment is free.', 'Keep the slip and track status with the enrolment ID.'],
  },
  {
    key: 'citizen', osm: 'dm', title: 'Citizenship', time: 'Several months to years, case by case', place: 'District Magistrate offices', radius: 40000, reddit: 'citizenship certificate',
    link: { label: 'Open the citizenship portal', url: 'https://indiancitizenshiponline.nic.in/' },
    steps: ['Born in India to Indian parents? You likely hold citizenship already. Your birth certificate and passport are the proof.', 'Registering or naturalising? Apply on the Home Ministry portal under the matching section.', 'Upload the required residence and parentage documents.', 'Attend the District Magistrate review and oath.', 'Get legal advice for any doubtful case. Free help is on NALSA 15100.'],
  },
];
