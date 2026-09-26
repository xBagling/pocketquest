// Loot tiers, armour, the bestiary, relics and ranks. Pure data and small helpers, shared with the
// server so it can check results.

// The six rarity tiers, the same values as Krillion's. Fool's Gold is the trap: the "clever"
// answer everyone reaches for. It's worth a little, but no armour is fooled by it.
export const TIERS = {
  c: { key: "c", name: "Copper", gold: 10, rank: 1, share: "🥉", blurb: "The one everyone blurts out." },
  f: { key: "f", name: "Fool's Gold", gold: 15, rank: 0, share: "🤡", blurb: "The famous “obscure” pick. Everyone reaches for it." },
  s: { key: "s", name: "Silver", gold: 30, rank: 2, share: "🥈", blurb: "Solid. A good find." },
  g: { key: "g", name: "Gold", gold: 60, rank: 3, share: "🥇", blurb: "Genuinely uncommon. Nice pull." },
  e: { key: "e", name: "Gem", gold: 85, rank: 4, share: "💎", blurb: "True obscurity. Few dig this deep." },
  j: { key: "j", name: "Crown Jewel", gold: 100, rank: 5, share: "👑", blurb: "The glade's hidden treasure." },
};
export const TIER_ORDER = ["c", "s", "g", "e", "j"];
/** Fool's Gold was retired in rules 4: in today's game those answers are shown (and count) as Copper. */
export const shownTier = (t) => (t === "f" ? "c" : t);

export const ARMOR = {
  none: { key: "none", label: "No armour", short: "Any answer", need: 0 },
  s: { key: "s", label: "Silver armour", short: "Silver or better", need: 2 },
  g: { key: "g", label: "Gold armour", short: "Gold or better", need: 3 },
};

/** Does an answer of this tier get through the armour? Fool's Gold never does. */
export function beatsArmor(tier, armor) {
  if (armor === "none") return true;
  if (tier === "f") return false;
  return TIERS[tier].rank >= ARMOR[armor].need;
}

// Who lives in the wood. Everyone is a little bit cosy: this is a walk you'd take for tea.
export const BESTIARY = {
  bunny: { quirk: "warmup", name: "Dust Bunny", the: "the Dust Bunny", pool: "first", hello: "A dust bunny sneezes and asks you a question.", win: "The dust bunny rolls away, satisfied.", hit: "The dust bunny sneezes on you." },
  slime: { quirk: "bouncy", name: "Puddle Slime", the: "the Puddle Slime", pool: "first", hello: "A puddle slime wobbles up, curious.", win: "The slime jiggles happily and lets you by.", hit: "The slime splashes you." },
  goblin: { quirk: "haggler", name: "Goblin", the: "the Goblin", pool: "plain", hello: "A goblin looks up from its knitting.", win: "The goblin bows and waves you on.", hit: "The goblin bonks you with a ladle." },
  toad: { quirk: "letter", name: "Toadstool", the: "the Toadstool", pool: "plain", hello: "A grumpy toadstool puffs out its cap.", win: "The toadstool shrinks back into the moss.", hit: "The toadstool puffs spores in your face." },
  bat: { quirk: "sleeper", name: "Sleepy Bat", the: "the Sleepy Bat", pool: "plain", hello: "A bat opens one eye, upside down.", win: "The bat yawns and goes back to sleep.", hit: "The bat flaps at your ears." },
  bones: { quirk: "collector", name: "Rattlebones", the: "Rattlebones", pool: "plain", hello: "A skeleton straightens its bow tie.", win: "Rattlebones collapses into a polite heap.", hit: "Rattlebones rattles you to your bones." },
  troll: { quirk: "thick", name: "Stone Troll", the: "the Stone Troll", pool: "elite", hello: "A stone troll blocks the path, arms folded.", win: "The troll grumbles and steps aside.", hit: "The troll flicks you into a bush." },
  wisp: { quirk: "bargain", name: "Wisp", the: "the Wisp", pool: "elite", hello: "A wisp drifts out of its lantern, humming.", win: "The wisp giggles and floats up into the leaves.", hit: "The wisp gives you a chilly hug." },
  mimic: { quirk: "hungry", name: "Mimic", the: "the Mimic", pool: "elite", hello: "A treasure chest clears its throat.", win: "The mimic snaps shut, impressed.", hit: "The mimic nibbles your fingers." },
  dragon: { quirk: "hoard", name: "Old Ember", the: "Old Ember", pool: "boss", hello: "Old Ember uncurls from her hoard. She has already eaten the easy answers.", win: "Old Ember laughs smoke rings and rolls off the hoard.", hit: "Old Ember puffs a warm cloud of soot at you." },
};

// Who you actually meet. Each monster above is a role (a twist of the rules); on the day it is played
// by one of these forest creatures, picked per door by lookFor() in dungeon.js. Only names, lines and
// art change with the creature: the rules are the role's, so replays never depend on the art.
export const CREATURES = {
  mossbunny: { role: "bunny", name: "Moss Bunny", hello: "A moss bunny twitches its leafy ears at you.", win: "The moss bunny hops off, scattering sparkles.", hit: "The moss bunny thumps its foot at you." },
  mosssprite: { role: "bunny", name: "Moss Sprite", hello: "A little moss sprite blinks up from the grass.", win: "The moss sprite giggles and rolls into the ferns.", hit: "The moss sprite sheds a leaf on your nose." },
  waterdrop: { role: "bunny", name: "Water Drop", hello: "A water drop peeks out from under its leaf.", win: "The water drop splashes happily and waves you on.", hit: "The water drop drips on your boots." },
  cloud: { role: "slime", name: "Cloud Whisp", hello: "A small cloud puffs up, curious.", win: "The cloud whisp swirls away on a happy breeze.", hit: "The cloud whisp rains on your head." },
  dandelion: { role: "slime", name: "Dandelion Puff", hello: "A dandelion puff bobs over on the wind.", win: "The dandelion puff floats up, laughing.", hit: "The dandelion puff sneezes seeds at you." },
  mouse: { role: "goblin", name: "Leaf-Gleaner Mouse", hello: "A mouse in a cloak of leaves sizes you up.", win: "The mouse tucks a berry away and waves you on.", hit: "The mouse pelts you with an acorn." },
  weasel: { role: "goblin", name: "Leaf Weasel", hello: "A leaf weasel slinks out, holding a pinecone.", win: "The weasel bows with a swish of its leafy tail.", hit: "The weasel swats you with its tail." },
  mushguard: { role: "toad", name: "Mushroom Guardian", hello: "A mushroom guardian straightens its mossy cape.", win: "The mushroom guardian tips its cap and steps aside.", hit: "The mushroom guardian puffs spores in your face." },
  myctoad: { role: "toad", name: "Mycelium Toad", hello: "A toad under a glowing mushroom croaks at you.", win: "The mycelium toad croaks a happy song.", hit: "The toad's mushroom puffs glowing spores at you." },
  owlet: { role: "bat", name: "Starry Owlet", hello: "A starry owlet opens one sleepy eye.", win: "The owlet fluffs up and drifts back to sleep.", hit: "The owlet hoots right in your ear." },
  pecker: { role: "bat", name: "Cirrus Pecker", hello: "A cloud-blue bird yawns on its branch.", win: "The cirrus pecker chirps a little cloud and naps.", hit: "The cirrus pecker pecks your hat." },
  berryhog: { role: "bones", name: "Berry Hedgehog", hello: "A hedgehog heaped with berries sniffs at you.", win: "The berry hedgehog offers you a blueberry.", hit: "The berry hedgehog bumps you with its spines." },
  pinecone: { role: "bones", name: "Pinecone Hedgehog", hello: "A pinecone hedgehog uncurls, curious.", win: "The pinecone hedgehog curls up, content.", hit: "The pinecone hedgehog prickles your fingers." },
  stomp: { role: "troll", name: "Moss Stomp", hello: "An old stump stomps onto the path, arms folded.", win: "The moss stomp sighs and settles back into the earth.", hit: "The moss stomp stomps and you fall into a bush." },
  tortoise: { role: "troll", name: "Pebble Tortoise", hello: "A tortoise with a shell of river stones blocks the path.", win: "The pebble tortoise wanders off to its puddle.", hit: "The tortoise nudges you over with its shell." },
  foxsprite: { role: "wisp", name: "Fox Sprite", hello: "A fox sprite sits up, tail swishing.", win: "The fox sprite leaps away into the leaves.", hit: "The fox sprite flicks its tail in your face." },
  soot: { role: "wisp", name: "Soot Sprite", hello: "A soot sprite peers at you, holding a pebble.", win: "The soot sprite squeaks and scurries into the moss.", hit: "The soot sprite leaves smudges on your sleeve." },
  // From the illustrated fork (tools/scenes/fork/): for now they guard its two paths, and the slime waits by the bridge.
  goblin: { role: "goblin", name: "Goblin", hello: "A goblin looks up from its sack of gold in the tree hollow.", win: "The goblin bows and waves you on.", hit: "The goblin bonks you with a ladle." },
  wisp: { role: "wisp", name: "Wisp", hello: "A little wisp flickers out of the mushroom house, humming.", win: "The wisp giggles and floats up into the leaves.", hit: "The wisp gives you a chilly hug." },
  slime: { role: "slime", name: "Puddle Slime", hello: "A puddle slime wobbles up, curious.", win: "The slime jiggles happily and lets you by.", hit: "The slime splashes you." },
  otter: { role: "mimic", name: "River Otter", hello: "A river otter stands up on its rock, whiskers twitching.", win: "The otter slips back into the river, pleased.", hit: "The otter splashes you from head to toe." },
  badger: { role: "mimic", name: "Leaf Badger", hello: "A badger pokes its nose out of the leaf pile.", win: "The leaf badger rolls off with its acorn.", hit: "The leaf badger buries you in leaves." },
};
/** The creatures that can play each monster role. */
export const ROLE_LOOKS = Object.keys(BESTIARY).reduce((o, k) => ((o[k] = Object.keys(CREATURES).filter((c) => CREATURES[c].role === k)), o), {});
/** Who stands at a door or in a room: its creature's name and lines, or the role's (Old Ember). */
export function beast(x) {
  const c = CREATURES[x?.look];
  const b = BESTIARY[x?.monster] || BESTIARY[c?.role];
  return c ? { ...b, name: c.name, the: `the ${c.name}`, hello: c.hello, win: c.win, hit: c.hit, look: x.look } : { ...b, look: x?.monster };
}

// Every monster plays by one twist of the rules. It's shown at the fork (path: the card's title), and it says it out loud.
export const QUIRKS = {
  warmup: { path: "Easy Stroll", name: "Warm-up", short: "No tricks. Any right answer wins.", say: "Just a little one to start!" },
  bouncy: { path: "Bouncy Crossing", name: "Bouncy", short: "Copper answers bounce off it.", say: "Boring answers just bounce off me!" },
  haggler: { path: "Hollow Trade", name: "Haggler", short: "Silver and Gold pay ×1.5. Copper pays 0.", say: "I don't buy copper, dearie. Silver or better!" },
  letter: { path: "Letter Lock", name: "Letter lock", short: "Your answer must start with the letter on its cap.", say: "Only words starting with my letter!" },
  sleeper: { path: "Sleepy Hollow", name: "Light sleeper", short: "+10 s, but a burnt-out lantern costs 2 hearts.", say: "Take your time… but don't let the lantern go out." },
  collector: { path: "The Collector", name: "Collector", short: "Wants two different answers. Both pay.", say: "I collect them. Two, please!" },
  thick: { path: "Thick Skull", name: "Thick skull", short: "A Gem or Jewel delights it: +1 heart.", say: "Only something really rare gets through this skull." },
  bargain: { path: "Wisdom of the Wisp", name: "Lantern bargain", short: "Offers a hint for half the gold.", say: "Want a hint? It'll cost you half…" },
  hungry: { path: "Hungry Hoard", name: "Hungry", short: "Gems pay ×3. Copper costs you 20 gold.", say: "Feed me something rare. Copper makes me peckish…" },
  hoard: { path: "The Hoard", name: "Hoard keeper", short: "The common answers are eaten. Three strikes of Gold+.", say: "I've eaten the easy ones already. Try me." },
};

// The characters you can walk as. Everyone starts as the Wanderer; the rest are bought with the gold
// saved from walks taken on their own day. Each ability lives in the engine, so the server re-plays it.
export const HEROES = {
  wanderer: { name: "The Wanderer", cost: 0, ability: "No tricks, just good boots.", short: "No ability" },
  fox: { name: "Fox Scout", cost: 250, ability: "Once a walk, listens in at a fork to hear a question before you choose.", short: "Listen in once a walk" },
  lamplighter: { name: "Lamplighter", cost: 400, ability: "A bigger lantern: +10 seconds in every glade.", short: "+10 s every glade" },
  magpie: { name: "Magpie", cost: 500, ability: "Loves anything shiny: Copper answers pay double.", short: "Copper pays ×2" },
  witch: { name: "Hedge Witch", cost: 700, ability: "Starts every walk with an extra heart.", short: "+1 heart" },
  dowser: { name: "Dowser", cost: 900, ability: "In every glade: how many answers there are, and the Crown Jewel's first letter.", short: "A hint every glade" },
  knight: { name: "Moss Knight", cost: 1200, ability: "Old Ember respects a knight: she needs one strike fewer.", short: "One strike fewer" },
};

// One relic is picked at the Wishing Stones after glade 2, from three offered that day.
export const RELICS = {
  draught: { name: "Healing Draught", text: "+1 heart, right now.", short: "+1 heart" },
  helm: { name: "Iron Helm", text: "Blocks the next hit you take.", short: "Blocks a hit" },
  candle: { name: "Spare Lantern Oil", text: "+10 seconds in every glade from now on.", short: "+10 s per glade" },
  map: { name: "Goblin's Map", text: "At every fork, you hear both questions.", short: "Hear the questions" },
  rod: { name: "Dowsing Rod", text: "In the next glade: how many answers exist, and the Crown Jewel's first letter.", short: "A hint next glade" },
  coin: { name: "Lucky Coin", text: "Your next Copper answer counts as Gold.", short: "Copper → Gold" },
  tooth: { name: "Dragon's Tooth", text: "Old Ember falls to two strikes instead of three.", short: "Dragon needs 2 strikes" },
  clover: { name: "Four-leaf Clover", text: "Your first Copper answer in each glade turns to Silver.", short: "First Copper → Silver" },
};
export const RELIC_IDS = Object.keys(RELICS);

export const CATEGORIES = {
  earth: { name: "Geography", about: "Places, countries and capitals" },
  screen: { name: "Film", about: "Film and cinema" },
  sound: { name: "Music", about: "Music and musicals" },
  lore: { name: "History & myth", about: "History, myth and legend" },
  nature: { name: "Nature", about: "Animals, plants and weather" },
  craft: { name: "Science", about: "Science, the body and gadgets" },
  table: { name: "Food & drink", about: "Food and drink" },
  arena: { name: "Sport", about: "Sport" },
  words: { name: "Books & words", about: "Books, letters and language" },
};

// The rank for the day, by gold. Tuned with tools/simulate.mjs so the middle of the crowd is a Wayfinder.
export const RANKS = [
  { min: 0, name: "Acorn Gatherer", line: "The wood is patient. Come back tomorrow." },
  { min: 60, name: "Lantern-bearer", line: "A steady light between the trees." },
  { min: 130, name: "Wayfinder", line: "You know the paths better than most." },
  { min: 250, name: "Treasure-seeker", line: "Your pockets jingle." },
  { min: 450, name: "Dragon-friend", line: "Old Ember will remember you." },
  { min: 650, name: "Legend of the Wood", line: "The moss spirits will sing about this one." },
];
export const rankFor = (gold) => [...RANKS].reverse().find((r) => gold >= r.min);
