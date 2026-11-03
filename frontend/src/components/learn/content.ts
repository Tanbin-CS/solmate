/**
 * Lessons for /learn, written for students aged 10-16. Every number a student sees either comes
 * from the published data at run time (scores, gravity, sunlight, AUC) or is checked against the
 * data files by content.test.ts, so the lessons cannot drift from the science.
 */

export type Visual =
  | { kind: 'image'; src: string; alt: string; credit: string; focus?: string }
  | { kind: 'south-pole' } // Moon globe with the south pole marked
  | { kind: 'analog-map' } // known analog field sites on the Earth map
  | { kind: 'dimensions' } // the seven characteristics, tappable
  | { kind: 'layers' } // the NASA data layers stacking up
  | { kind: 'grid' } // Earth cut into 0.1 degree squares
  | { kind: 'bars'; lat: number; lon: number; target: string; caption: string } // a real score taken apart
  | { kind: 'sun'; target: string } // Sun height at a Moon region against a place on Earth
  | { kind: 'regions' } // the nine Artemis III regions
  | { kind: 'gravity' }
  | { kind: 'pressure' }
  | { kind: 'radiation' }
  | { kind: 'validation' }

export interface Card {
  title: string
  body: string
  visual: Visual
}

export interface Place {
  name: string
  lat: number
  lon: number
}

export type Round =
  | { kind: 'hunt'; target: string; clues: string[] }
  | { kind: 'pick'; target: string; clues: string[]; options: [Place, Place, Place]; answer: 0 | 1 | 2; lesson: string }

export interface Question {
  q: string
  options: string[]
  answer: number
  explain: string
}

export interface Level {
  id: string
  title: string
  goal: string
  badge: string
  cards: Card[]
  activity: { kind: 'rounds'; rounds: Round[] } | { kind: 'weigh' } | null
  quiz: Question[]
}

const ql = (id: string) => `data/quicklooks/${id}-imagery.webp`
const QL_CREDIT = 'NASA/USGS Landsat via NASA GIBS'

// Places used in "pick one" rounds (validation sites and screening leads; coordinates from the configs)
const P = {
  atacama: { name: 'Atacama Desert, Chile', lat: -24.083, lon: -70.017 },
  kilauea: { name: 'Kīlauea volcano, Hawaiʻi', lat: 19.406, lon: -155.283 },
  aletsch: { name: 'Aletsch Glacier, Switzerland', lat: 46.45, lon: 8.05 },
  sistan: { name: 'Sistan Basin, Iran–Afghanistan', lat: 32.05, lon: 61.25 },
  ganges: { name: 'Ganges Plain, India', lat: 26.4, lon: 81.8 },
  askja: { name: 'Askja lava fields, Iceland', lat: 65.045, lon: -16.76 },
  puna: { name: 'Puna de Atacama, Argentina', lat: -27.85, lon: -69.15 },
  meteor: { name: 'Meteor Crater, Arizona', lat: 35.027, lon: -111.022 },
  amazon: { name: 'Amazon rainforest, Brazil', lat: -2.6, lon: -60.2 },
  tibet: { name: 'Tibetan Plateau, China', lat: 37.05, lon: 86.75 },
  deathValley: { name: 'Death Valley, California', lat: 36.46, lon: -116.87 },
  iowa: { name: 'Farmland, Iowa', lat: 42.2, lon: -93.9 },
  haughton: { name: 'Haughton Crater, Devon Island', lat: 75.383, lon: -89.683 },
  lonar: { name: 'Lonar Crater, India', lat: 19.976, lon: 76.508 },
} satisfies Record<string, Place>

const MOON_CLUES = ['Freezing cold, with huge swings between day and night', 'Bone dry: no rain, no rivers', 'Bare grey ground with no plants at all']

export const LEVELS: Level[] = [
  {
    id: 'analogs',
    title: 'Why practise on Earth?',
    goal: 'Find out what an analog is and why NASA uses them.',
    badge: 'Analog Cadet',
    cards: [
      {
        title: 'People are going back to the Moon',
        body: 'NASA’s Artemis program plans to land astronauts near the Moon’s south pole. NASA has named nine candidate regions there for the Artemis III landing.',
        visual: { kind: 'south-pole' },
      },
      {
        title: 'Robots are already exploring Mars',
        body: 'The Perseverance rover has been driving around Jezero Crater since February 2021. Long ago, Jezero held a lake.',
        visual: { kind: 'image', src: 'data/quicklooks/jezero-hillshade.webp', alt: 'Shaded relief of Jezero Crater on Mars, showing the old river delta', credit: 'NASA/JPL/MSSS/USGS CTX elevation model' },
      },
      {
        title: 'Practise first, at home',
        body: 'Testing rovers, spacesuits and tools on the Moon is hard and very expensive. So teams practise first in places on Earth that are a bit like the Moon or Mars.',
        visual: { kind: 'analog-map' },
      },
      {
        title: 'These places are called analogs',
        body: 'An analog is a place on Earth that copies some things about another world, such as the rocky ground, the cold or the dryness. No place on Earth copies everything.',
        visual: { kind: 'image', src: ql('atacama-yungay'), alt: 'Satellite image of the Atacama Desert in Chile: bare, pale ground', credit: QL_CREDIT },
      },
    ],
    activity: null,
    quiz: [
      {
        q: 'What is a planetary analog?',
        options: ['A place on Earth that is like another world in some ways', 'A model of a planet built in a lab', 'A photo of Mars taken from Earth', 'A rocket launch site'],
        answer: 0,
        explain: 'Analogs are real places on Earth. They copy some things about the Moon or Mars, never everything.',
      },
      {
        q: 'Why do teams practise on Earth before a mission?',
        options: ['Earth has the same gravity as Mars', 'It is cheaper and safer to find problems at home', 'Rovers cannot be built on the Moon', 'The Moon is too bright for cameras'],
        answer: 1,
        explain: 'A problem found in a desert on Earth costs far less than one found on the Moon.',
      },
      {
        q: 'Where does NASA plan to land the Artemis III astronauts?',
        options: ['On the Moon’s equator', 'In the middle of the far side', 'Near the Moon’s south pole', 'Near the Moon’s north pole'],
        answer: 2,
        explain: 'All nine candidate regions are near the south pole, where some craters may hold water ice.',
      },
    ],
  },
  {
    id: 'satellites',
    title: 'How satellites read Earth',
    goal: 'See how NASA data turns every place into a score.',
    badge: 'Data Reader',
    cards: [
      {
        title: 'Looking alike is not enough',
        body: 'Two places can look the same in a photo and still be completely different: one freezing, one warm; one wet, one dry. So SolMate compares what satellites measure, not just pictures.',
        visual: { kind: 'image', src: ql('meteor-crater'), alt: 'Satellite image of Meteor Crater in Arizona, a round impact crater', credit: QL_CREDIT },
      },
      {
        title: 'Seven things we compare',
        body: 'Terrain, climate, temperature, surface, minerals, ice and dust. Tap each one to see which NASA data measures it.',
        visual: { kind: 'dimensions' },
      },
      {
        title: 'Layers of NASA data',
        body: 'Satellites such as Terra and Aqua measure Earth every day. SolMate stacks their maps of temperature, snow, rock, dust, rain and height into one picture of the planet.',
        visual: { kind: 'layers' },
      },
      {
        title: 'Every place gets a score',
        body: 'Earth’s land is cut into squares about 11 km wide, about 1.9 million of them. Each one gets a score from 0 to 100: the SolMate Analog Index.',
        visual: { kind: 'grid' },
      },
      {
        title: 'A score you can take apart',
        body: 'The index is the average of the seven scores, so you can always see which parts match and which do not.',
        visual: { kind: 'bars', lat: 37.05, lon: 86.75, target: 'jezero_crater', caption: 'Tibetan Plateau against Jezero Crater' },
      },
    ],
    activity: null,
    quiz: [
      {
        q: 'Why doesn’t SolMate just compare photos?',
        options: ['Satellites cannot take photos', 'Photos only show the ocean', 'Places can look alike but differ in cold, dryness and rock', 'Photos are too expensive'],
        answer: 2,
        explain: 'A crater in a warm, rainy place looks like a Moon crater but behaves very differently.',
      },
      {
        q: 'About how wide is each square SolMate scores?',
        options: ['About 1 metre', 'About 11 kilometres', 'About 100 metres', 'About 1,000 kilometres'],
        answer: 1,
        explain: 'Each square is 0.1 degree of latitude and longitude, about 11 km at the equator.',
      },
      {
        q: 'What does an Analog Index of 90 out of 100 mean?',
        options: ['The place is 90 km from the target', '90% of the place is desert', 'The place has 90 craters', 'The place matches the target on most characteristics'],
        answer: 3,
        explain: 'The index averages the seven characteristics. 90 means most of them match well.',
      },
      {
        q: 'Which of these is NOT one of the seven characteristics?',
        options: ['Number of people living there', 'Terrain', 'Temperature', 'Minerals'],
        answer: 0,
        explain: 'SolMate compares the natural world: ground, climate, temperature, surface, minerals, ice and dust.',
      },
    ],
  },
  {
    id: 'moon',
    title: 'The Moon’s south pole',
    goal: 'Learn what makes the Artemis landing regions special, then hunt for their match.',
    badge: 'Moon Scout',
    cards: [
      {
        title: 'The Sun stays low',
        body: 'Near the Moon’s south pole the Sun never climbs more than a few degrees above the horizon. Shadows stretch for kilometres, and astronauts must work in long, low light.',
        visual: { kind: 'sun', target: 'mons_mouton_plateau' },
      },
      {
        title: 'Some craters never see sunlight',
        body: 'The floors of some deep craters have stayed in shadow for a very long time. They are colder than −160 °C, cold enough to keep water ice. In 2009 NASA’s LCROSS probe found water in one of them, Cabeus.',
        visual: { kind: 'image', src: 'media/globe-moon.webp', alt: 'The Moon seen from below, with the cratered south pole region at the bottom', credit: 'NASA LRO LROC WAC mosaic', focus: '50% 85%' },
      },
      {
        title: 'Nine places to land',
        body: 'NASA picked nine candidate regions for Artemis III. They differ: one is the flattest, one has the smallest landing area, one is closest to the pole.',
        visual: { kind: 'regions' },
      },
      {
        title: 'What makes a good Moon analog?',
        body: 'Cold, very dry, high up, bare ground with no plants, and big swings between day and night temperature. High deserts on Earth often score best.',
        visual: { kind: 'image', src: ql('atacama-yungay'), alt: 'Satellite image of the Atacama Desert, one of the driest places on Earth', credit: QL_CREDIT },
      },
    ],
    activity: {
      kind: 'rounds',
      rounds: [
        { kind: 'hunt', target: 'mons_mouton_plateau', clues: [...MOON_CLUES, 'The largest and flattest landing region of the nine'] },
        {
          kind: 'pick',
          target: 'malapert_massif',
          clues: [...MOON_CLUES, 'A huge mountain whose sunlit slopes average about −90 °C'],
          options: [P.kilauea, P.atacama, P.aletsch],
          answer: 1,
          lesson: 'An active volcano gets rain and plants; a glacier is ice, not dry rock. The cold, dry desert wins.',
        },
        { kind: 'hunt', target: 'haworth', clues: [...MOON_CLUES, 'Next to a crater floor that never warms above −163 °C'] },
      ],
    },
    quiz: [
      {
        q: 'How high does the Sun get near the Moon’s south pole?',
        options: ['Straight overhead at noon', 'Only a few degrees above the horizon', 'Halfway up the sky', 'It never rises anywhere on the Moon'],
        answer: 1,
        explain: 'The Moon’s spin axis is almost upright, so near the poles the Sun just skims the horizon.',
      },
      {
        q: 'Why do scientists care about craters that never see sunlight?',
        options: ['They may hold water ice', 'They are the warmest places', 'They have air to breathe', 'Plants grow there'],
        answer: 0,
        explain: 'Ice could give astronauts water to drink and oxygen and fuel to make.',
      },
      {
        q: 'Which kind of place on Earth usually matches the Moon’s south pole best?',
        options: ['A rainforest', 'A busy city', 'A warm beach', 'A cold, high, dry desert'],
        answer: 3,
        explain: 'Cold, dry, bare and high: that is why the Andes and the Tibetan Plateau score so well.',
      },
    ],
  },
  {
    id: 'mars',
    title: 'Mars: an old lake and buried ice',
    goal: 'Meet the two Mars targets, then find their closest match on Earth.',
    badge: 'Mars Scout',
    cards: [
      {
        title: 'Jezero was a lake',
        body: 'More than 3.5 billion years ago a river flowed into Jezero Crater and filled it with water. The river left a delta: a fan of mud and sand you can still see from orbit.',
        visual: { kind: 'image', src: 'data/quicklooks/jezero-hillshade.webp', alt: 'Shaded relief of Jezero Crater with its delta', credit: 'NASA/JPL/MSSS/USGS CTX elevation model' },
      },
      {
        title: 'Looking for signs of ancient life',
        body: 'Perseverance collects rock samples in Jezero. Mars was once wetter, so it may have been a place where life could live. Whether life ever existed there is still unknown.',
        visual: { kind: 'image', src: 'media/globe-mars.webp', alt: 'Mars seen from space', credit: 'USGS/NASA Ames Viking MDIM 2.1' },
      },
      {
        title: 'Arcadia Planitia hides ice',
        body: 'In this wide plain in the north of Mars, NASA’s SWIM project mapped water ice just below the surface. Ice means water and fuel, so it is a candidate place for a human base.',
        visual: { kind: 'image', src: 'media/globe-mars.webp', alt: 'Mars seen from space, northern plains at the top', credit: 'USGS/NASA Ames Viking MDIM 2.1', focus: '50% 20%' },
      },
      {
        title: 'Cold, dusty and dry',
        body: 'Mars has thin air, dust storms and huge swings between day and night. On Earth, dusty deserts and cold high plateaus come closest.',
        visual: { kind: 'image', src: ql('death-valley'), alt: 'Satellite image of Death Valley, California', credit: QL_CREDIT },
      },
    ],
    activity: {
      kind: 'rounds',
      rounds: [
        { kind: 'hunt', target: 'jezero_crater', clues: ['Very dry, with big day-night temperature swings', 'Bare rock and sand, no plants', 'Dark volcanic rock and carbonate minerals, left by water', 'Dusty air'] },
        {
          kind: 'pick',
          target: 'arcadia_planitia',
          clues: ['Cold and dry, with frost in winter', 'Flat, wide plains', 'Bare ground and dusty air'],
          options: [P.askja, P.ganges, P.sistan],
          answer: 2,
          lesson: 'Iceland’s lava fields are wet and cool; the Ganges Plain is farmland. The dusty desert basin is closest.',
        },
      ],
    },
    quiz: [
      {
        q: 'What was Jezero Crater long ago?',
        options: ['A volcano', 'A lake fed by a river', 'A sea of sand dunes', 'A glacier'],
        answer: 1,
        explain: 'Its delta of mud and sand shows where the river entered the lake.',
      },
      {
        q: 'Which rover explores Jezero Crater?',
        options: ['Curiosity', 'Sojourner', 'Perseverance', 'Opportunity'],
        answer: 2,
        explain: 'Perseverance landed in Jezero in February 2021. Curiosity explores a different crater, Gale.',
      },
      {
        q: 'Why is Arcadia Planitia a candidate place for a human base?',
        options: ['Water ice lies just below the surface', 'It is the warmest place on Mars', 'It has air you can breathe', 'It is the highest mountain on Mars'],
        answer: 0,
        explain: 'Ice close to the surface is easy to dig up for water and fuel.',
      },
    ],
  },
  {
    id: 'limits',
    title: 'Where every analog breaks down',
    goal: 'Find out what no place on Earth can copy.',
    badge: 'Reality Checker',
    cards: [
      {
        title: 'Gravity can’t be copied',
        body: 'Everything on the Moon and Mars weighs much less than on Earth. Astronauts walk, jump and fall differently, and no place on Earth can practise that.',
        visual: { kind: 'gravity' },
      },
      {
        title: 'Almost no air',
        body: 'Mars has very thin air and the Moon has almost none. Without a spacesuit you could not breathe, and water would boil away.',
        visual: { kind: 'pressure' },
      },
      {
        title: 'Much more radiation',
        body: 'Earth’s thick air and magnetic field protect us from space radiation. On the Moon and Mars astronauts get far more of it every day.',
        visual: { kind: 'radiation' },
      },
      {
        title: 'Life is everywhere on Earth',
        body: 'Even the driest desert has tiny microbes. That makes deserts good places to test instruments that search for life, and it is one more thing that differs from the Moon.',
        visual: { kind: 'image', src: ql('amazon-forest'), alt: 'Satellite image of the Amazon rainforest, completely green', credit: QL_CREDIT },
      },
    ],
    activity: { kind: 'weigh' },
    quiz: [
      {
        q: 'What can no place on Earth copy?',
        options: ['Cold', 'Dryness', 'Low gravity', 'Craters'],
        answer: 2,
        explain: 'Cold, dryness and craters all exist on Earth. Low gravity does not.',
      },
      {
        q: 'How does the air pressure on Mars compare with Earth’s?',
        options: ['About the same', 'About half', 'Twice as high', 'Less than 1% of Earth’s'],
        answer: 3,
        explain: 'Mars’s air pressure is about 7 hectopascals; Earth’s is about 1,013.',
      },
      {
        q: 'A bag of rice reads 40 kg on a scale on Earth. About what would the same scale read on Mars?',
        options: ['15 kg', '40 kg', '100 kg', '7 kg'],
        answer: 0,
        explain: 'The rice is the same, but Mars pulls on it with only 38% of Earth’s gravity: 40 × 0.38 ≈ 15.',
      },
    ],
  },
  {
    id: 'planner',
    title: 'Mission planner',
    goal: 'Use everything you learned to find training sites for six more Artemis regions.',
    badge: 'Mission Planner',
    cards: [
      {
        title: 'Your mission',
        body: 'Six more Artemis regions need places to train. Remember what matters: cold, dry, high and bare. And remember what can never match.',
        visual: { kind: 'regions' },
      },
      {
        title: 'Novel leads',
        body: 'SolMate also lists strong matches far from every place already used for tests, more than 300 km away. They are new ideas for teams to visit.',
        visual: { kind: 'analog-map' },
      },
      {
        title: 'Checking the science',
        body: 'SolMate was tested on sites NASA and its partners already use. A good method should score them above farms, forests, cities and glaciers.',
        visual: { kind: 'validation' },
      },
    ],
    activity: {
      kind: 'rounds',
      rounds: [
        {
          kind: 'pick',
          target: 'peak_near_cabeus_b',
          clues: [...MOON_CLUES, 'The smallest landing area of all nine regions'],
          options: [P.meteor, P.puna, P.amazon],
          answer: 1,
          lesson: 'Meteor Crater looks like the Moon, but its climate is milder. The cold high desert of the Andes matches better.',
        },
        { kind: 'hunt', target: 'mons_mouton', clues: [...MOON_CLUES, 'The top of a flat-topped mountain'] },
        {
          kind: 'pick',
          target: 'nobile_rim_1',
          clues: [...MOON_CLUES, 'The rim of Nobile crater'],
          options: [P.deathValley, P.iowa, P.tibet],
          answer: 2,
          lesson: 'Death Valley is dry but hot; Iowa is farmland. The cold, high Tibetan Plateau is closest.',
        },
        { kind: 'hunt', target: 'nobile_rim_2', clues: [...MOON_CLUES, 'The other rim of Nobile crater, next to a cold trap'] },
        {
          kind: 'pick',
          target: 'de_gerlache_rim_2',
          clues: [...MOON_CLUES, 'The closest region to the south pole'],
          options: [P.haughton, P.puna, P.lonar],
          answer: 1,
          lesson: 'Haughton is a famous Mars training site, but a good analog for one world is not always good for another.',
        },
        { kind: 'hunt', target: 'slater_plain', clues: [...MOON_CLUES, 'A plain with the biggest share of safe landing ground'] },
      ],
    },
    quiz: [
      {
        q: 'What is a “novel lead”?',
        options: ['The first place a rover lands', 'A strong match far from places already used for tests', 'A type of Moon rock', 'The brightest crater on the Moon'],
        answer: 1,
        explain: 'Novel leads are new ideas: places that score well but have not been used for training yet.',
      },
      {
        q: 'Meteor Crater in Arizona looks like the Moon. Why can it still score lower than a high desert?',
        options: ['It is too small to see from space', 'Craters never count', 'Its climate and temperature are different', 'It is in the wrong country'],
        answer: 2,
        explain: 'Shape is only one of seven characteristics. Climate and temperature count too.',
      },
      {
        q: 'In SolMate’s test, real analog sites for Jezero beat other places with an AUC of 0.84. What does that mean?',
        options: ['84% of Earth is desert', 'Jezero is 84 km wide', 'Scores are 84 out of 100 on average', 'A real analog site beats a random farm, forest or city about 84 times in 100'],
        answer: 3,
        explain: 'AUC is the chance that a real analog site outscores a random non-analog place. 0.5 would be guessing.',
      },
      {
        q: 'Why does SolMate also say where an analog breaks down?',
        options: ['No place on Earth matches everything, so teams need to know the limits', 'To make the scores look higher', 'Because satellites are broken', 'Only for the Moon, not Mars'],
        answer: 0,
        explain: 'Knowing what an analog cannot copy is as useful as knowing what it can.',
      },
    ],
  },
]

/** Stars for a hunt: your score against SolMate's best for that target. */
export function huntStars(yours: number, best: number): 0 | 1 | 2 | 3 {
  const r = best > 0 ? yours / best : 0
  return r >= 0.9 ? 3 : r >= 0.75 ? 2 : r >= 0.55 ? 1 : 0
}

/** A quiz is passed with at least 60% right. */
export const passMark = (n: number) => Math.ceil(n * 0.6)

/** Click position on an equirectangular map (0..1 across, 0..1 down) to latitude and longitude. */
export function mapToLatLon(fx: number, fy: number): { lat: number; lon: number } {
  const lon = Math.max(-180, Math.min(180, fx * 360 - 180))
  const lat = Math.max(-90, Math.min(90, 90 - fy * 180))
  return { lat: Math.round(lat * 100) / 100, lon: Math.round(lon * 100) / 100 }
}

/** Great-circle distance in km. */
export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const r = Math.PI / 180
  const h = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lon - a.lon) * r) / 2) ** 2
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Natural background radiation on Earth, world average (UNSCEAR 2008: 2.4 mSv per year). */
export const EARTH_DOSE_MSV_DAY = 2.4 / 365

export type LatLon = { lat: number; lon: number }

/** Position of a point on an equirectangular map, in % of the map. */
export const mapPos = (p: LatLon) => ({ left: `${((p.lon + 180) / 360) * 100}%`, top: `${((90 - p.lat) / 180) * 100}%` })

/** A word for a 0-100 score, so the number means something to a ten-year-old (bands as on the Method page). */
export function alike(sai: number): { word: string; tone: string } {
  return sai >= 75 ? { word: 'Very alike', tone: 'text-positive' } : sai >= 40 ? { word: 'A bit alike', tone: 'text-reference' } : { word: 'Not very alike', tone: 'text-slate-300' }
}

/** Story visuals the student can play with (the card shows a "Try it" prompt). */
export function isInteractive(v: Visual): boolean {
  return ['analog-map', 'dimensions', 'layers', 'grid', 'bars', 'sun', 'gravity', 'validation'].includes(v.kind)
}

/** The clues used for a target in the levels (every target has exactly one round). */
export function cluesFor(targetId: string): string[] {
  for (const l of LEVELS) if (l.activity?.kind === 'rounds') for (const r of l.activity.rounds) if (r.target === targetId) return r.clues
  return []
}
