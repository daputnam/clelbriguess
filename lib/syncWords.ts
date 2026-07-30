// Short, common, easy-to-spell words used to build memorable sync codes
// (e.g. "coral-otter-maple"). Kept free of homophones, profanity, and
// near-duplicates so codes are easy to say and re-type correctly.
const WORDS = [
  "acorn", "amber", "anchor", "apple", "arrow", "ash", "aspen", "atlas",
  "badger", "bamboo", "banjo", "barn", "basil", "bay", "beacon", "bean",
  "bear", "beaver", "birch", "bison", "blaze", "blossom", "bluebird", "boat",
  "bolt", "bramble", "brass", "breeze", "brook", "bronze", "buffalo", "cabin",
  "camel", "canary", "candle", "canoe", "canyon", "cardinal", "cedar", "chalk",
  "cherry", "chess", "chestnut", "cinder", "clay", "cliff", "clover", "cloud",
  "coast", "cobalt", "cocoa", "comet", "compass", "copper", "coral",
  "cotton", "cougar", "coyote", "crane", "creek", "cricket", "crimson", "crow",
  "crystal", "current", "cypress", "daisy", "dawn", "deer", "delta", "denim",
  "desert", "dew", "diamond", "dolphin", "dove", "dragon", "drift", "drum",
  "eagle", "ebony", "echo", "eel", "elder", "elk", "elm", "ember",
  "emerald", "falcon", "fawn", "feather", "fern", "field", "finch", "fir",
  "fjord", "flame", "flint", "fog", "forest", "fossil", "fox", "frost",
  "garnet", "gazelle", "gecko", "geode", "ginger", "glacier", "glade", "gold",
  "goose", "granite", "grape", "gravel", "grove", "gull", "harbor", "hare",
  "harvest", "hawk", "hazel", "heather", "hemlock", "heron", "hickory", "hill",
  "holly", "honey", "hornet", "horizon", "hummingbird", "husky", "ibis", "ice",
  "indigo", "iris", "ivory", "ivy", "jade", "jaguar", "jasmine", "jay",
  "jungle", "juniper", "kelp", "kestrel", "kiwi", "koala", "lagoon", "lake",
  "lantern", "lark", "laurel", "lava", "leaf", "lemon", "lichen", "lightning",
  "lilac", "lily", "lime", "linen", "lion", "lizard", "llama", "lobster",
  "locust", "loon", "lotus", "lynx", "magma", "magnolia", "magpie", "mallow",
  "mango", "maple", "marble", "marigold", "marsh", "meadow", "mesa", "meteor",
  "mint", "mist", "mole", "moon", "moose", "moss", "mountain", "mulberry",
  "mustang", "myrtle", "nectar", "nest", "nettle", "newt", "nickel", "nutmeg",
  "oak", "oasis", "ocean", "ocelot", "olive", "onyx", "opal", "orange",
  "orbit", "orca", "orchid", "oriole", "osprey", "otter", "owl", "oxide",
  "palm", "panda", "panther", "papaya", "parrot", "peach", "peak", "pearl",
  "pebble", "pecan", "pelican", "penguin", "peony", "pepper", "petal", "pheasant",
  "pigeon", "pine", "pinecone", "pixel", "plateau", "plum", "pond", "poplar",
  "poppy", "prairie", "prism", "puffin", "pumpkin", "quail", "quartz", "quill",
  "rabbit", "raccoon", "rain", "raven", "reed", "reef", "ridge", "river",
  "robin", "rocket", "rose", "rowan", "ruby", "sage", "sail", "salmon",
  "sand", "sandpiper", "sapphire", "sequoia", "shale", "shamrock", "shell", "shore",
  "silver", "sky", "slate", "sloth", "smoke", "snow", "sorrel", "sparrow",
  "spice", "spring", "spruce", "squirrel", "starling", "steel", "stone", "storm",
  "stream", "sun", "sunflower", "swallow", "swan", "sycamore", "tangerine", "teal",
  "thistle", "thrush", "thunder", "tide", "tiger", "timber", "topaz", "tortoise",
  "toucan", "trail", "trout", "tulip", "tundra", "turquoise", "turtle", "twig",
  "valley", "velvet", "vine", "violet", "walnut", "walrus", "warbler", "water",
  "wave", "wheat", "willow", "wind", "wing", "winter", "wolf", "wren",
  "yarrow", "yew", "zebra", "zephyr", "zinc",
];

export function randomWord(): string {
  return WORDS[Math.floor(Math.random() * WORDS.length)];
}

export function generateSyncCode(): string {
  const chosen = new Set<string>();
  while (chosen.size < 3) {
    chosen.add(randomWord());
  }
  return Array.from(chosen).join("-");
}

// A code is exactly 3 hyphen-separated words from the list. Normalizes
// casing/whitespace so "Coral Otter Maple" and "coral-otter-maple" match.
export function normalizeSyncCode(input: string): string | null {
  const parts = input
    .trim()
    .toLowerCase()
    .split(/[\s-]+/)
    .filter(Boolean);

  if (parts.length !== 3 || !parts.every((word) => WORDS.includes(word))) {
    return null;
  }
  return parts.join("-");
}
