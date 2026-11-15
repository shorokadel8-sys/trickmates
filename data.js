// TRICKMATES — shared game data (used by both the Node server and the browser client)
// Units are metres. +X = east, +Z = south. The camera looks from the south.

export const ROOMS = {
  office:   { id: 'office',   name: 'Home Office', x0: -13, x1: -5, z0: -9, z1: 0, floor: 'wood' },
  kitchen:  { id: 'kitchen',  name: 'Kitchen',     x0: -5,  x1: 4,  z0: -9, z1: 0, floor: 'wood' },
  living:   { id: 'living',   name: 'Living Room', x0: 4,   x1: 13, z0: -9, z1: 0, floor: 'wood' },
  bedroom:  { id: 'bedroom',  name: 'Bedroom',     x0: -13, x1: 0,  z0: 0,  z1: 8, floor: 'woodLight' },
  bathroom: { id: 'bathroom', name: 'Bathroom',    x0: 0,   x1: 9,  z0: 0,  z1: 8, floor: 'tile' },
};
export const ROOM_IDS = Object.keys(ROOMS);

export function roomAt(x, z) {
  for (const r of Object.values(ROOMS)) {
    if (x >= r.x0 && x < r.x1 && z >= r.z0 && z < r.z1) return r.id;
  }
  return null;
}

// Walls: [x0, z0, x1, z1, height]. Axis-aligned segments; gaps are doors.
const FULL = 2.8, CUT = 1.15;
export const WALLS = [
  // outer
  [-13, -9, 13, -9, FULL],          // north (back) wall
  [-13, -9, -13, 8, FULL],          // west wall
  [13, -9, 13, 0, CUT],             // east of living
  [9, 0, 13, 0, CUT],               // south of living (outside bathroom)
  [9, 0, 9, 8, CUT],                // east of bathroom
  [-13, 8, 9, 8, CUT],              // south wall
  // office | kitchen (wide opening z -5.2 .. -1.6)
  [-5, -9, -5, -5.2, CUT],
  [-5, -1.6, -5, 0, CUT],
  // kitchen | living (open plan, short stub)
  [4, -9, 4, -6.2, CUT],
  // top row | bottom row (z = 0) with doors office->bedroom and living->bathroom
  [-13, 0, -10.2, 0, CUT],
  [-8.4, 0, 5.4, 0, CUT],
  [7.2, 0, 9, 0, CUT],
  // bedroom | bathroom (door z 4.4 .. 6.2)
  [0, 0, 0, 4.4, CUT],
  [0, 6.2, 0, 8, CUT],
];
export const WALL_T = 0.2;

// Interactive hotspots. pos = object position; chore = what the owner of the house does there.
export const HOTSPOTS = {
  desk_pc:      { room: 'office',   pos: [-9.5, -7.6], label: 'Computer',      chore: 'Answer emails' },
  office_chair: { room: 'office',   pos: [-9.5, -6.5], label: 'Desk Chair',    chore: 'Sit and focus' },
  bookshelf:    { room: 'office',   pos: [-12.3, -4.2], label: 'Bookshelf',    chore: 'Grab a book' },
  fridge:       { room: 'kitchen',  pos: [-4.2, -8.1], label: 'Refrigerator',  chore: 'Grab a snack' },
  stove:        { room: 'kitchen',  pos: [-1.3, -8.2], label: 'Stove',         chore: 'Cook dinner' },
  sink:         { room: 'kitchen',  pos: [1.8, -8.2],  label: 'Kitchen Sink',  chore: 'Wash the dishes' },
  counter:      { room: 'kitchen',  pos: [-0.5, -4.3], label: 'Prep Counter',  chore: 'Prep a salad' },
  sofa:         { room: 'living',   pos: [7.9, -4.3],  label: 'Sofa',          chore: 'Relax on the sofa' },
  tv:           { room: 'living',   pos: [12.3, -4.3], label: 'TV',            chore: 'Watch TV' },
  coffee_table: { room: 'living',   pos: [10.1, -4.3], label: 'Coffee Table',  chore: 'Read a magazine' },
  plant:        { room: 'living',   pos: [12.2, -8.2], label: 'Big Plant',     chore: 'Water the plant' },
  mirror:       { room: 'bathroom', pos: [2.6, 0.7],   label: 'Mirror & Sink', chore: 'Fix your look' },
  shower:       { room: 'bathroom', pos: [8.0, 6.4],   label: 'Shower',        chore: 'Take a shower' },
  towel:        { room: 'bathroom', pos: [4.4, 7.5],   label: 'Towel Rack',    chore: 'Grab a towel' },
  tub:          { room: 'bathroom', pos: [8.0, 2.4],   label: 'Bathtub',       chore: 'Run a bubble bath' },
  bed:          { room: 'bedroom',  pos: [-5.5, 2.2],  label: 'Bed',           chore: 'Take a nap' },
  nightstand:   { room: 'bedroom',  pos: [-4.0, 0.5],  label: 'Alarm Clock',   chore: 'Set the alarm' },
  wardrobe:     { room: 'bedroom',  pos: [-12.2, 4.2], label: 'Wardrobe',      chore: 'Change clothes' },
  slippers:     { room: 'bedroom',  pos: [-9.0, 3.6],  label: 'Slippers',      chore: 'Put on slippers' },
};
export const HOTSPOT_IDS = Object.keys(HOTSPOTS);

export const CATEGORIES = ['all', 'scary', 'funny', 'surprise', 'kitchen', 'office', 'hidden'];

export const RISK = {
  low:    { label: 'Low',    catchRadius: 2.8, tellRadius: 0,   color: '#7bd389' },
  medium: { label: 'Medium', catchRadius: 4.0, tellRadius: 1.8, color: '#f4c35a' },
  high:   { label: 'High',   catchRadius: 5.5, tellRadius: 3.5, color: '#f0755a' },
};

export const TRIGGERS = {
  interact:  'Fires when the victim uses this object',
  proximity: 'Fires when the victim walks close',
  remote:    'You fire it manually when the victim is nearby',
};

// Victim lines: per victim character [Egyptian Arabic, English]
const L = (oAr, oEn, sAr, sEn) => ({ omar: [oAr, oEn], shorok: [sAr, sEn] });

export const PRANKS = [
  // ---------- HOME OFFICE ----------
  { id: 'fake_spider', name: 'The Fake Bug', item: 'Plastic Spider', icon: '🕷️', room: 'office', hotspot: 'desk_pc',
    cats: ['scary', 'office'], risk: 'low', prep: 2.5, points: 150, trigger: 'interact', fx: 'spider', react: 'scared',
    desc: 'Plant a realistic plastic spider right next to the laptop.',
    lines: L('يا ماما! إيه ده؟', 'Oh mama! What\'s that?', 'عنكبوووت! يا عمر!', 'SPIDER! Omaaar!') },
  { id: 'screen_bug', name: 'Screen Crawler', item: 'Bug Screensaver USB', icon: '🪲', room: 'office', hotspot: 'desk_pc',
    cats: ['scary', 'office'], risk: 'medium', prep: 3, points: 170, trigger: 'remote', fx: 'screenbug', react: 'scared',
    desc: 'A sneaky USB makes a cartoon beetle crawl across the screen — you choose when.',
    lines: L('الحشرة دي جوه الشاشة؟!', 'Is that bug INSIDE the screen?!', 'اللابتوب فيه صراصير؟!', 'The laptop has bugs?!') },
  { id: 'computer_face', name: 'Desktop Surprise', item: 'Silly Wallpaper', icon: '🖥️', room: 'office', hotspot: 'desk_pc',
    cats: ['funny', 'surprise', 'office'], risk: 'medium', prep: 3.5, points: 180, trigger: 'interact', fx: 'screenface', react: 'surprised',
    desc: 'Swap the wallpaper for a giant goofy face that pops up on login.',
    lines: L('مين اللي عمل كده؟!', 'Who did this?!', 'يا خبر! إيه الوش ده؟!', 'What is that FACE?!') },
  { id: 'rolling_chair', name: 'Runaway Chair', item: 'Spinny Wheels', icon: '🪑', room: 'office', hotspot: 'office_chair',
    cats: ['funny', 'office'], risk: 'medium', prep: 3, points: 160, trigger: 'interact', fx: 'chairspin', react: 'surprised',
    desc: 'Loosen the chair so it spins like a merry-go-round when someone sits.',
    lines: L('الكرسي بيلف لوحده!', 'The chair has a mind of its own!', 'وقّفوا الكرسي ده!', 'Somebody stop this chair!') },
  { id: 'honking_book', name: 'Honk Book', item: 'Clown Horn', icon: '📯', room: 'office', hotspot: 'bookshelf',
    cats: ['surprise', 'hidden', 'office'], risk: 'low', prep: 2, points: 120, trigger: 'interact', fx: 'honk', react: 'surprised',
    desc: 'Hide a clown horn behind the favourite book.',
    lines: L('كتاب بيزمّر؟!', 'A book that HONKS?!', 'الكتاب ده بيعمل صوت!', 'This book just honked at me!') },

  // ---------- KITCHEN ----------
  { id: 'toy_rocket', name: 'Rocket Surprise', item: 'Confetti Toy Rocket', icon: '🚀', room: 'kitchen', hotspot: 'stove',
    cats: ['surprise', 'kitchen'], risk: 'high', prep: 4, points: 220, trigger: 'proximity', fx: 'rocket', react: 'scared',
    desc: 'A colourful toy rocket that whooshes up and bursts into confetti. Totally harmless, very loud.',
    lines: L('صاروخ في المطبخ؟!', 'A ROCKET in the kitchen?!', 'إيه الصاروخ ده يا عمر؟!', 'Omar, what is this rocket?!') },
  { id: 'fake_donut', name: 'Sponge Donut', item: 'Fake Donut', icon: '🍩', room: 'kitchen', hotspot: 'fridge',
    cats: ['funny', 'kitchen', 'hidden'], risk: 'low', prep: 2, points: 130, trigger: 'interact', fx: 'sponge', react: 'angry',
    desc: 'Swap the last donut with an identical (squeaky) sponge.',
    lines: L('الدونات دي إسفنجة!', 'This donut is a SPONGE!', 'آخر دونات… وطلعت إسفنجة!', 'My last donut… is a sponge!') },
  { id: 'fridge_jack', name: 'Fridge Guest', item: 'Jack-in-the-box', icon: '🤡', room: 'kitchen', hotspot: 'fridge',
    cats: ['scary', 'surprise', 'kitchen'], risk: 'medium', prep: 3, points: 170, trigger: 'interact', fx: 'jackbox', react: 'scared',
    desc: 'A googly-eyed spring buddy waits on the middle shelf.',
    lines: L('يا لهوي! التلاجة فيها حد!', 'Someone lives in the fridge!', 'مين ده اللي في التلاجة؟!', 'Who is in my fridge?!') },
  { id: 'flour_burst', name: 'Flour Power', item: 'Flour Puff Bag', icon: '🌾', room: 'kitchen', hotspot: 'counter',
    cats: ['funny', 'kitchen'], risk: 'medium', prep: 3, points: 190, trigger: 'interact', fx: 'flour', react: 'angry',
    desc: 'Rig the flour jar to puff a big cartoon cloud.',
    lines: L('بقيت عامل زي الشبح!', 'I look like a ghost!', 'كل هدومي دقيق!', 'Flour EVERYWHERE!') },
  { id: 'squeaky_kettle', name: 'Screaming Kettle', item: 'Whistle Cap', icon: '🫖', room: 'kitchen', hotspot: 'stove',
    cats: ['surprise', 'kitchen'], risk: 'low', prep: 2, points: 110, trigger: 'remote', fx: 'kettle', react: 'surprised',
    desc: 'A super-whistle cap you can set off from anywhere in the house.',
    lines: L('الغلاية بتصرخ!', 'The kettle is SCREAMING!', 'إيه الصوت ده؟!', 'What is that noise?!') },
  { id: 'sink_splash', name: 'Splash Zone', item: 'Sprayer Clip', icon: '💦', room: 'kitchen', hotspot: 'sink',
    cats: ['funny', 'kitchen'], risk: 'medium', prep: 2.5, points: 160, trigger: 'interact', fx: 'splash', react: 'angry',
    desc: 'Clip the sprayer so the tap gives a cartoon splash.',
    lines: L('اتغرّقت!', 'I\'m SOAKED!', 'الطرحة اتبلّت!', 'My scarf is all wet!') },

  // ---------- LIVING ROOM ----------
  { id: 'tv_cow', name: 'Remote Control Trick', item: 'Spare Remote', icon: '📺', room: 'living', hotspot: 'tv',
    cats: ['funny', 'surprise'], risk: 'low', prep: 2, points: 140, trigger: 'remote', fx: 'tvcow', react: 'surprised',
    desc: 'Hijack the TV with a dancing cow — trigger it while they\'re watching.',
    lines: L('البقرة دي جاية منين؟!', 'Where did this cow come from?!', 'مين حط البقرة دي؟!', 'Who put a COW on my show?!') },
  { id: 'whoopee', name: 'Sofa Surprise', item: 'Whoopee Cushion', icon: '🎈', room: 'living', hotspot: 'sofa',
    cats: ['funny', 'hidden'], risk: 'low', prep: 2, points: 130, trigger: 'interact', fx: 'whoopee', react: 'embarrassed',
    desc: 'The classic. Hide it under the middle cushion.',
    lines: L('مش أنا! والله مش أنا!', 'It wasn\'t me, I swear!', 'ده مش أنا على فكرة!', 'That was NOT me!') },
  { id: 'roar_speaker', name: 'Hidden Roar', item: 'Mini Speaker', icon: '🔊', room: 'living', hotspot: 'coffee_table',
    cats: ['scary', 'hidden'], risk: 'medium', prep: 2.5, points: 150, trigger: 'proximity', fx: 'roar', react: 'scared',
    desc: 'A tiny speaker under the magazines that roars like a cartoon lion.',
    lines: L('مين اللي بيزأر؟!', 'Who is ROARING?!', 'في أسد في الصالة!', 'There\'s a lion in the living room!') },
  { id: 'dancing_plant', name: 'Disco Plant', item: 'Wiggle Motor', icon: '🪴', room: 'living', hotspot: 'plant',
    cats: ['funny', 'surprise'], risk: 'medium', prep: 3, points: 150, trigger: 'interact', fx: 'plantdance', react: 'surprised',
    desc: 'The plant starts dancing (with sunglasses) when watered.',
    lines: L('الزرعة بترقص!', 'The plant is DANCING!', 'الزرعة لابسة نضارة؟!', 'Is the plant wearing sunglasses?!') },

  // ---------- BATHROOM ----------
  { id: 'mirror_boo', name: 'Mirror Surprise', item: 'Window Marker', icon: '🪞', room: 'bathroom', hotspot: 'mirror',
    cats: ['scary', 'surprise'], risk: 'medium', prep: 3, points: 170, trigger: 'interact', fx: 'mirror', react: 'scared',
    desc: 'Draw a hidden "BOO!" with a silly mustache that appears in the fog.',
    lines: L('مين ده اللي في المراية؟!', 'Who is THAT in the mirror?!', 'شنب؟! أنا؟!', 'A mustache?! On ME?!') },
  { id: 'cold_shower', name: 'Unexpected Shower', item: 'Shower Timer', icon: '🚿', room: 'bathroom', hotspot: 'shower',
    cats: ['funny', 'surprise'], risk: 'medium', prep: 3, points: 170, trigger: 'proximity', fx: 'shower', react: 'scared',
    desc: 'A sensor bursts the shower on when someone walks by.',
    lines: L('الميّة ساقعة!!', 'COLD WATER!!', 'يا عمر الميّة!!', 'Omar, the WATER!!') },
  { id: 'towel_snake', name: 'Towel Snake', item: 'Rubber Snake', icon: '🐍', room: 'bathroom', hotspot: 'towel',
    cats: ['scary', 'hidden'], risk: 'low', prep: 2, points: 140, trigger: 'interact', fx: 'snake', react: 'scared',
    desc: 'A wiggly rubber snake rolled inside the fluffy towel.',
    lines: L('تعبااان!', 'SNAAAKE!', 'تعبان في الفوطة!', 'A snake in the towel!') },
  { id: 'foam_party', name: 'Foam Explosion', item: 'Mega Bubble Bath', icon: '🫧', room: 'bathroom', hotspot: 'tub',
    cats: ['funny'], risk: 'high', prep: 4, points: 230, trigger: 'interact', fx: 'foam', react: 'surprised',
    desc: 'Ten times the bubble bath. What could go wrong?',
    lines: L('إيه كل الرغوة دي؟!', 'Why is there SO much foam?!', 'الحمام كله رغوة!', 'The whole bathroom is foam!') },

  // ---------- BEDROOM (5th room from the layout reference) ----------
  { id: 'alarm_blast', name: 'Alarm Blast', item: 'Rigged Alarm Clock', icon: '⏰', room: 'bedroom', hotspot: 'nightstand',
    cats: ['surprise'], risk: 'low', prep: 2, points: 140, trigger: 'remote', fx: 'alarm', react: 'scared',
    desc: 'Set the clock to ring like a fire drill — whenever you press the button.',
    lines: L('صحيت! صحيت!', 'I\'m up! I\'m UP!', 'إيه ده؟! الساعة كام؟!', 'What?! What time is it?!') },
  { id: 'confetti_pillow', name: 'Party Pillow', item: 'Confetti Popper', icon: '🎉', room: 'bedroom', hotspot: 'bed',
    cats: ['funny', 'hidden'], risk: 'medium', prep: 3, points: 170, trigger: 'interact', fx: 'confetti', react: 'surprised',
    desc: 'A confetti popper hidden in the pillow — nap time is party time.',
    lines: L('المخدة فرقعت؟!', 'The pillow EXPLODED?!', 'كل السرير بقى كونفيتي!', 'Confetti all over the bed!') },
  { id: 'wardrobe_dino', name: 'Closet Dino', item: 'Inflatable Dinosaur', icon: '🦖', room: 'bedroom', hotspot: 'wardrobe',
    cats: ['scary', 'surprise', 'hidden'], risk: 'high', prep: 4, points: 230, trigger: 'interact', fx: 'dino', react: 'scared',
    desc: 'A giant inflatable T-rex springs out when the wardrobe opens.',
    lines: L('ديناصووور!', 'DINOSAUR!', 'في ديناصور في الدولاب!', 'There\'s a dino in my closet!') },
  { id: 'squeaky_slippers', name: 'Squeaky Steps', item: 'Squeakers', icon: '🥿', room: 'bedroom', hotspot: 'slippers',
    cats: ['funny', 'hidden'], risk: 'low', prep: 2, points: 120, trigger: 'interact', fx: 'squeak', react: 'embarrassed',
    desc: 'Every step squeaks like a rubber duck.',
    lines: L('الشبشب بيزيّق!', 'My slippers SQUEAK!', 'مش هعرف أمشي كده!', 'I can\'t walk like this!') },
];
export const PRANK_BY_ID = Object.fromEntries(PRANKS.map(p => [p.id, p]));

export const CHALLENGES = [
  { id: 'kitchen_chaos', name: 'Kitchen Chaos', desc: 'Land a prank in the Kitchen', bonus: 50 },
  { id: 'ghost_mode',    name: 'Ghost Mode',    desc: 'Land a prank you prepared unseen', bonus: 50 },
  { id: 'grand_tour',    name: 'Grand Tour',    desc: 'Land pranks in 3 different rooms', bonus: 100 },
  { id: 'double_trouble',name: 'Double Trouble',desc: 'Land 2 pranks within 45 seconds', bonus: 75 },
  { id: 'sharp_eyes',    name: 'Sharp Eyes',    desc: 'Find & defuse a hidden prank', bonus: 50 },
  { id: 'busy_bee',      name: 'Busy Bee',      desc: 'Finish 5 chores', bonus: 40 },
];

export const RULES = {
  rounds: 3,
  roundSeconds: 150,
  intermissionSeconds: 7,
  maxArmedTraps: 3,
  interactRadius: 1.7,
  proximityRadius: 1.4,
  remoteRadius: 2.8,
  choreSeconds: 1.5,
  searchSeconds: 1.2,
  stunSeconds: 2.4,
  distractCooldown: 40,
  lureSeconds: 25,
  reconnectSeconds: 60,
  points: {
    prepared: 20, unseenBonus: 25, discoveredPenalty: -40, defuseReward: 40,
    caughtPenalty: -30, catchReward: 20, remoteMiss: -15, chore: 15, lure: 35,
  },
  walkSpeed: 3.0,
  runSpeed: 5.2,
};

export const CHARACTERS = {
  omar:   { id: 'omar',   name: 'Omar',   color: '#5b8de0', caughtLine: ['عمر، بجد؟!', 'Omar, really?'] },
  shorok: { id: 'shorok', name: 'Shorok', color: '#e8b98f', caughtLine: ['شروق، بجد؟!', 'Shorok, really?'] },
};
export const other = (c) => (c === 'omar' ? 'shorok' : 'omar');
export const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
