/**
 * Curated plant taxonomy for the Israeli retail market.
 *
 * - `names`: names that identify the taxon itself (any language). First Hebrew/English entries are display names.
 * - `defaultNames`: generic/genus names that Israeli retailers use for this specific species by convention
 *   (e.g. a plain "מונסטרה" is sold as Monstera deliciosa). Matches through these get level "genus-default"
 *   and a lower confidence, and are flagged in the UI.
 * - `cultivars`: named cultivars; a cultivar match implies the species.
 * - rank "genus"/"family": only the higher taxon is known; never treated as a specific species.
 *
 * Scientific names follow current accepted usage (POWO) with common trade synonyms as aliases.
 * Adding an entry: keep names unambiguous; if a name is used for two different plants, leave it out.
 */

export type TaxonRank = "species" | "genus" | "family";

export interface TaxonDef {
  id: string;
  scientificName: string;
  rank: TaxonRank;
  genus: string;
  /** Botanical family, used to match family-level queries such as "סחלב" (orchids). */
  family?: string;
  he: string[];
  en: string[];
  aliases?: string[];
  defaultNames?: string[];
  cultivars?: { name: string; aliases: string[] }[];
  /** Override the terms sent to source search endpoints. */
  searchTerms?: string[];
}

export const TAXA: TaxonDef[] = [
  // ---- Monstera & look-alikes -------------------------------------------------------------
  {
    id: "monstera-deliciosa",
    scientificName: "Monstera deliciosa",
    rank: "species",
    genus: "Monstera",
    he: ["מונסטרה דליסיוזה", "מונסטרה דליסיוסה", "מונסטרה דליציוזה", "מונסטרה דלישיוזה", "מונסטרה דלסיוזה", "מונסטרה דליסיוזא", "מונסטרה נאכלת", "דליסיוזה", "דליסיוסה"],
    en: ["Monstera deliciosa", "Swiss cheese plant", "split leaf philodendron", "delicious monster", "deliciosa"],
    defaultNames: ["מונסטרה", "מונסטרות", "monstera", "monsteras"],
    cultivars: [
      { name: "Thai Constellation", aliases: ["תאי קונסטליישן", "תאי קונסטלציה", "תאי קטנסטליישן", "תאי קון", "תאי", "thai constellation", "thai"] },
      { name: "Albo Variegata", aliases: ["אלבו", "אלבו וריגטה", "albo", "albo variegata", "borsigiana albo"] },
      { name: "Aurea", aliases: ["אאוראה", "אוראה", "אוריאה", "aurea", "marmorata"] },
      { name: "Mint", aliases: ["מינט", "mint"] },
      { name: "White Monster", aliases: ["וויט מונסטר", "ווייט מונסטר", "white monster"] },
      { name: "Aussie Dream", aliases: ["אוסיי דרים", "אוסי דרים", "aussie dream"] },
      { name: "Borsigiana", aliases: ["בורסיגיאנה", "בורסיגיאנה", "borsigiana"] },
      { name: "Variegata", aliases: ["וריגטה", "variegata", "variegated", "מגוונת"] }
    ],
    searchTerms: ["מונסטרה", "monstera"]
  },
  {
    id: "monstera-adansonii",
    scientificName: "Monstera adansonii",
    rank: "species",
    genus: "Monstera",
    he: ["מונסטרה מאנקי", "מונסטרה מנקי", "מונסטרה מונקי", "מונסטרה מאנקי מאסק", "מאנקי מאסק", "מונסטרה אדנסוני", "מונסטרה אדנסוניי", "מונסטרה אדנסונאי"],
    en: ["Monstera adansonii", "monkey mask", "monkey mask monstera", "Swiss cheese vine", "adansonii", "monstera monkey"],
    searchTerms: ["מונסטרה", "monstera"]
  },
  {
    id: "monstera-standleyana",
    scientificName: "Monstera standleyana",
    rank: "species",
    genus: "Monstera",
    he: ["מונסטרה סטנדליאנה", "פילודנדרון קוברה", "סטנדליאנה"],
    en: ["Monstera standleyana", "philodendron cobra", "standleyana"],
    searchTerms: ["מונסטרה", "monstera"]
  },
  {
    id: "monstera-karstenianum",
    scientificName: "Monstera karstenianum",
    rank: "species",
    genus: "Monstera",
    // Widely sold as "Monstera obliqua Peru", but the plant in trade is M. karstenianum.
    he: ["מונסטרה פרו", "מונסטרה קרסטניאנום", "מונסטרה אובליקה פרו", "מונסטרה אובליקווה פרו"],
    en: ["Monstera peru", "Monstera karstenianum", "monstera sp peru"],
    searchTerms: ["מונסטרה", "monstera"]
  },
  {
    id: "monstera-obliqua",
    scientificName: "Monstera obliqua",
    rank: "species",
    genus: "Monstera",
    he: ["מונסטרה אובליקווה", "מונסטרה אובליקה"],
    en: ["Monstera obliqua"],
    searchTerms: ["מונסטרה", "monstera"]
  },
  {
    id: "monstera-siltepecana",
    scientificName: "Monstera siltepecana",
    rank: "species",
    genus: "Monstera",
    he: ["מונסטרה סילטפקנה", "מונסטרה סילטפקאנה", "מונסטרה סילטפיקנה", "מונסטרה סילטה פיקנה", "סילטפיקנה"],
    en: ["Monstera siltepecana"],
    searchTerms: ["מונסטרה", "monstera"]
  },
  {
    id: "monstera-dubia",
    scientificName: "Monstera dubia",
    rank: "species",
    genus: "Monstera",
    he: ["מונסטרה דוביה"],
    en: ["Monstera dubia"],
    searchTerms: ["מונסטרה", "monstera"]
  },
  {
    id: "rhaphidophora-tetrasperma",
    scientificName: "Rhaphidophora tetrasperma",
    rank: "species",
    genus: "Rhaphidophora",
    he: ["רפידופורה טטרספרמה", "מונסטרה מינימה", "מיני מונסטרה", "מונסטרה מיני", "רפידופורה"],
    en: ["Rhaphidophora tetrasperma", "mini monstera", "monstera minima", "philodendron ginny", "rhaphidophora"],
    searchTerms: ["רפידופורה", "מונסטרה"]
  },

  // ---- Aroids --------------------------------------------------------------------------------
  {
    id: "epipremnum-aureum",
    scientificName: "Epipremnum aureum",
    rank: "species",
    genus: "Epipremnum",
    he: ["פוטוס", "פוטוס זהוב", "אפיפרמנום", "אפיפרמנום אאורום"],
    en: ["Epipremnum aureum", "pothos", "golden pothos", "devil's ivy", "devils ivy"],
    cultivars: [
      { name: "Manjula", aliases: ["מנגולה", "מנג'ולה", "מאנג'ולה", "manjula"] },
      { name: "Marble Queen", aliases: ["מרבל קווין", "מרבל קוין", "marble queen"] },
      { name: "N'Joy", aliases: ["אנגוי", "אנג'וי", "njoy", "n joy"] },
      { name: "Neon", aliases: ["נאון", "ניאון", "neon"] },
      { name: "Global Green", aliases: ["גלובל גרין", "global green"] }
    ]
  },
  {
    id: "scindapsus-pictus",
    scientificName: "Scindapsus pictus",
    rank: "species",
    genus: "Scindapsus",
    he: ["סקינדפסוס", "סקינדפסוס פיקטוס", "פוטוס כסוף", "פוטוס סאטן", "פיקטוס", "פוטוס תאילנדי"],
    en: ["Scindapsus pictus", "satin pothos", "silver pothos", "scindapsus"]
  },
  {
    id: "philodendron-hederaceum",
    scientificName: "Philodendron hederaceum",
    rank: "species",
    genus: "Philodendron",
    he: ["פילודנדרון מטפס", "פילודנדרון הדרציאום", "פילודנדרון סקנדנס", "פילודנדרון ברזיל", "פילודנדרון לב", "פילודנדרון מיקנס"],
    en: ["Philodendron hederaceum", "heartleaf philodendron", "philodendron scandens", "philodendron brasil", "philodendron micans"]
  },
  {
    id: "thaumatophyllum-bipinnatifidum",
    scientificName: "Thaumatophyllum bipinnatifidum",
    rank: "species",
    genus: "Thaumatophyllum",
    he: ["פילודנדרון סלואום", "פילודנדרון סלו", "פילודנדרון ביפינטיפידום", "פילודנדרון סלום", "פילודנדרון ביפי"],
    en: ["Thaumatophyllum bipinnatifidum", "Philodendron bipinnatifidum", "philodendron selloum", "tree philodendron"]
  },
  {
    id: "philodendron",
    scientificName: "Philodendron",
    rank: "genus",
    genus: "Philodendron",
    he: ["פילודנדרון", "פילודנדרונים"],
    en: ["Philodendron"]
  },
  {
    id: "zamioculcas-zamiifolia",
    scientificName: "Zamioculcas zamiifolia",
    rank: "species",
    genus: "Zamioculcas",
    he: ["זמיוקולקס", "זמיוקולקוס", "זמיוקולקס זמיפוליה", "זמיה"],
    en: ["Zamioculcas zamiifolia", "zz plant", "zanzibar gem", "zamioculcas"],
    searchTerms: ["זמיה", "זמיוקולקס", "zamioculcas"], // stores mostly use the colloquial "זמיה"
    cultivars: [
      { name: "Raven", aliases: ["רייבן", "ריוון", "raven", "זמיה שחורה"] },
      { name: "Zenzi", aliases: ["זנזי", "זאנזי", "zenzi"] }
    ]
  },
  {
    id: "spathiphyllum",
    scientificName: "Spathiphyllum",
    rank: "genus",
    genus: "Spathiphyllum",
    he: ["ספטיפילום", "ספטיפיליום", "שושנת השלום"],
    en: ["Spathiphyllum", "peace lily"]
  },
  {
    id: "anthurium",
    scientificName: "Anthurium",
    rank: "genus",
    genus: "Anthurium",
    he: ["אנטוריום", "אנתוריום"],
    en: ["Anthurium", "flamingo flower"]
  },
  {
    id: "aglaonema",
    scientificName: "Aglaonema",
    rank: "genus",
    genus: "Aglaonema",
    he: ["אגלונמה", "אגלאונמה"],
    en: ["Aglaonema", "Chinese evergreen"]
  },
  {
    id: "dieffenbachia",
    scientificName: "Dieffenbachia",
    rank: "genus",
    genus: "Dieffenbachia",
    he: ["דיפנבכיה", "דיפנבאכיה"],
    en: ["Dieffenbachia", "dumb cane"]
  },
  {
    id: "syngonium-podophyllum",
    scientificName: "Syngonium podophyllum",
    rank: "species",
    genus: "Syngonium",
    he: ["סינגוניום פודופילום"],
    en: ["Syngonium podophyllum", "arrowhead plant"],
    defaultNames: ["סינגוניום", "syngonium"]
  },
  {
    id: "alocasia",
    scientificName: "Alocasia",
    rank: "genus",
    genus: "Alocasia",
    he: ["אלוקסיה", "אלוקאסיה"],
    en: ["Alocasia"]
  },
  {
    id: "alocasia-zebrina",
    scientificName: "Alocasia zebrina",
    rank: "species",
    genus: "Alocasia",
    he: ["אלוקסיה זברינה", "אלוקסיה זברה"],
    en: ["Alocasia zebrina"]
  },
  {
    id: "alocasia-amazonica",
    scientificName: "Alocasia × amazonica",
    rank: "species",
    genus: "Alocasia",
    he: ["אלוקסיה פולי", "אלוקסיה אמזוניקה", "אלוקסיה אמזונס"],
    en: ["Alocasia amazonica", "Alocasia polly", "African mask plant"]
  },

  // ---- Ficus -----------------------------------------------------------------------------------
  {
    id: "ficus",
    scientificName: "Ficus",
    rank: "genus",
    genus: "Ficus",
    he: ["פיקוס"],
    en: ["Ficus"]
  },
  {
    id: "ficus-lyrata",
    scientificName: "Ficus lyrata",
    rank: "species",
    genus: "Ficus",
    he: ["פיקוס כינורי", "פיקוס לירטה", "פיקוס ליראטה", "פיקוס לירטא", "פיקוס ליירטה"],
    en: ["Ficus lyrata", "fiddle leaf fig", "fiddle-leaf fig"],
    cultivars: [{ name: "Bambino", aliases: ["במבינו", "bambino"] }],
    searchTerms: ["פיקוס", "ficus"]
  },
  {
    id: "ficus-elastica",
    scientificName: "Ficus elastica",
    rank: "species",
    genus: "Ficus",
    he: ["פיקוס גומי", "פיקוס אלסטיקה", "פיקוס הגומי"],
    en: ["Ficus elastica", "rubber plant", "rubber tree", "rubber fig"],
    cultivars: [
      { name: "Tineke", aliases: ["טינקה", "tineke"] },
      { name: "Burgundy", aliases: ["בורגונדי", "burgundy", "abidjan"] },
      { name: "Robusta", aliases: ["רובוסטה", "robusta"] }
    ],
    searchTerms: ["פיקוס", "ficus"]
  },
  {
    id: "ficus-benjamina",
    scientificName: "Ficus benjamina",
    rank: "species",
    genus: "Ficus",
    he: ["פיקוס בנימינה", "פיקוס בנגמינה", "פיקוס בנג'מינה", "פיקוס בנימין", "פיקוס בנימיני"],
    en: ["Ficus benjamina", "weeping fig"],
    searchTerms: ["פיקוס", "ficus"]
  },
  {
    id: "ficus-microcarpa",
    scientificName: "Ficus microcarpa",
    rank: "species",
    genus: "Ficus",
    he: ["פיקוס גינסנג", "פיקוס ג'ינסנג", "פיקוס מיקרוקרפה", "פיקוס רטוזה"],
    en: ["Ficus microcarpa", "ficus ginseng", "ficus retusa", "chinese banyan"],
    searchTerms: ["פיקוס", "ficus"]
  },
  {
    id: "ficus-benghalensis",
    scientificName: "Ficus benghalensis",
    rank: "species",
    genus: "Ficus",
    he: ["פיקוס אודרי", "פיקוס בנגלנסיס", "פיקוס בנגלי"],
    en: ["Ficus benghalensis", "ficus audrey", "banyan"],
    searchTerms: ["פיקוס", "ficus"]
  },

  // ---- Dracaena / Sansevieria -----------------------------------------------------------------
  {
    id: "dracaena-trifasciata",
    scientificName: "Dracaena trifasciata",
    rank: "species",
    genus: "Dracaena",
    he: ["לשון חמות", "סנסוויריה טריפסציאטה", "דרצנה טריפסציאטה", "כידונן חרבות", "כידונן משולש"],
    en: ["Dracaena trifasciata", "Sansevieria trifasciata", "snake plant", "mother in law's tongue", "mother in laws tongue"],
    // "כידונן" is the Hebrew botanical name of Sansevieria.
    defaultNames: ["סנסוויריה", "סנסיווריה", "סנסבריה", "סנסווריה", "סנסויריה", "סנסיוויריה", "סנסיויריה", "sansevieria", "כידונן"],
    cultivars: [
      { name: "Laurentii", aliases: ["לורנטי", "לורנטיי", "laurentii", "פס צהוב"] },
      { name: "Moonshine", aliases: ["מונשיין", "מון שיין", "moonshine"] },
      { name: "Hahnii", aliases: ["האני", "hahnii"] }
    ],
    searchTerms: ["סנסוויריה", "סנסיווריה", "sansevieria"]
  },
  {
    id: "dracaena-angolensis",
    scientificName: "Dracaena angolensis",
    rank: "species",
    genus: "Dracaena",
    he: ["סנסוויריה גלילית", "סנסיווריה גלילית", "סנסוויריה צילינדריקה", "סנסוויריה סילינדריקה", "כידונן גלילני", "כידונן גליני", "כידונן גלילי"],
    en: ["Dracaena angolensis", "Sansevieria cylindrica", "cylindrical snake plant"],
    searchTerms: ["סנסוויריה", "סנסיווריה", "sansevieria"]
  },
  {
    id: "dracaena",
    scientificName: "Dracaena",
    rank: "genus",
    genus: "Dracaena",
    he: ["דרצנה", "דרצאנה", "דראצנה"],
    en: ["Dracaena"]
  },
  {
    id: "dracaena-marginata",
    scientificName: "Dracaena marginata",
    rank: "species",
    genus: "Dracaena",
    he: ["דרצנה מרגינטה", "דרצנה מרגינאטה"],
    en: ["Dracaena marginata", "dragon tree", "Madagascar dragon tree"],
    searchTerms: ["דרצנה", "dracaena"]
  },
  {
    id: "dracaena-fragrans",
    scientificName: "Dracaena fragrans",
    rank: "species",
    genus: "Dracaena",
    he: ["דרצנה פרגרנס", "דרצנה מסנגיאנה", "דרצנה מסנג'יאנה", "דרצנה מסנגנה", "דרצנה מסנג'נה", "דרצנה מסינגנה", "דרצנה ריחנית"],
    en: ["Dracaena fragrans", "corn plant", "dracaena massangeana", "dracaena deremensis"],
    cultivars: [
      { name: "Lemon Lime", aliases: ["למון ליים", "לימון ליים", "למונליים", "lemon lime"] },
      { name: "Janet Craig", aliases: ["ג'נט קרייג", "גנט קרייג", "janet craig"] },
      { name: "Compacta", aliases: ["קומפקטה", "compacta"] }
    ],
    searchTerms: ["דרצנה", "dracaena"]
  },
  {
    id: "dracaena-sanderiana",
    scientificName: "Dracaena sanderiana",
    rank: "species",
    genus: "Dracaena",
    he: ["דרצנה במבוק", "במבוק המזל", "לאקי במבוק", "לאקי במבו", "עץ המזל"],
    en: ["Dracaena sanderiana", "lucky bamboo"],
    searchTerms: ["דרצנה", "במבוק", "dracaena"]
  },
  {
    // Cordyline is a different genus that Israeli stores often sell as "דרצנה".
    id: "cordyline",
    scientificName: "Cordyline",
    rank: "genus",
    genus: "Cordyline",
    he: ["קורדילינה", "קורדליין", "קורדילין", "דרצנה קורדליין", "דרצנה קורדילינה", "דרצנה אוסטרלית"],
    en: ["Cordyline", "ti plant", "cabbage tree"],
    searchTerms: ["קורדילינה", "cordyline"]
  },
  {
    id: "yucca-gigantea",
    scientificName: "Yucca gigantea",
    rank: "species",
    genus: "Yucca",
    he: ["יוקה פילית", "יוקה אלפנטיפס"],
    en: ["Yucca gigantea", "Yucca elephantipes", "spineless yucca"],
    defaultNames: ["יוקה", "yucca"]
  },
  {
    id: "beaucarnea-recurvata",
    scientificName: "Beaucarnea recurvata",
    rank: "species",
    genus: "Beaucarnea",
    he: ["בוקרנאה", "בוקרניאה", "נולינה", "רגל פיל"],
    en: ["Beaucarnea recurvata", "ponytail palm", "nolina recurvata", "elephant foot"]
  },

  // ---- Marantaceae -----------------------------------------------------------------------------
  {
    id: "calathea",
    scientificName: "Goeppertia (Calathea)",
    rank: "genus",
    genus: "Goeppertia",
    he: ["קלתאה", "קלתיאה", "קלטאה", "קלאתאה"],
    en: ["Calathea", "Goeppertia"],
    searchTerms: ["קלתאה", "קלתיאה", "calathea"]
  },
  {
    id: "goeppertia-orbifolia",
    scientificName: "Goeppertia orbifolia",
    rank: "species",
    genus: "Goeppertia",
    he: ["קלתאה אורביפוליה", "קלתיאה אורביפוליה", "קלתאה אורבופוליה"],
    en: ["Goeppertia orbifolia", "Calathea orbifolia"],
    searchTerms: ["קלתאה", "calathea"]
  },
  {
    id: "goeppertia-makoyana",
    scientificName: "Goeppertia makoyana",
    rank: "species",
    genus: "Goeppertia",
    he: ["קלתאה מקויאנה", "קלתיאה מקויאנה", "קלתאה מקיויאנה"],
    en: ["Goeppertia makoyana", "Calathea makoyana", "peacock plant"],
    searchTerms: ["קלתאה", "calathea"]
  },
  {
    id: "maranta-leuconeura",
    scientificName: "Maranta leuconeura",
    rank: "species",
    genus: "Maranta",
    he: ["מרנטה לאוקונאורה", "צמח התפילה"],
    en: ["Maranta leuconeura", "prayer plant"],
    defaultNames: ["מרנטה", "מראנטה", "maranta"]
  },
  {
    id: "ctenanthe",
    scientificName: "Ctenanthe",
    rank: "genus",
    genus: "Ctenanthe",
    // Ctenanthe oppenheimiana is commonly sold as a "Calathea".
    he: ["קטננטה", "קטנאנטה", "קלתאה אופנהיימינה", "קלתאה אופנהיימיאנה", "קטננטה אופנהיימיאנה"],
    en: ["Ctenanthe", "Ctenanthe oppenheimiana"]
  },
  {
    // Stromanthe 'Triostar' is commonly sold as "Calathea Triostar".
    id: "stromanthe-sanguinea",
    scientificName: "Stromanthe sanguinea",
    rank: "species",
    genus: "Stromanthe",
    he: ["סטרומנטה", "סטרומנטה טריוסטאר", "קלתאה טריוסטאר", "קלתיאה טריוסטאר"],
    en: ["Stromanthe sanguinea", "Stromanthe thalia", "stromanthe triostar", "calathea triostar"]
  },

  // ---- Other foliage --------------------------------------------------------------------------
  {
    id: "chlorophytum-comosum",
    scientificName: "Chlorophytum comosum",
    rank: "species",
    genus: "Chlorophytum",
    he: ["כלורופיטום", "צמח העכביש"],
    en: ["Chlorophytum comosum", "spider plant"]
  },
  {
    id: "strelitzia-nicolai",
    scientificName: "Strelitzia nicolai",
    rank: "species",
    genus: "Strelitzia",
    he: ["סטרליציה ניקולאי", "סטרליציה ניקולאיי", "סטרליציה לבנה", "ציפור גן עדן ניקולאי", "ציפור גן עדן לבנה"],
    en: ["Strelitzia nicolai", "white bird of paradise", "giant bird of paradise"],
    searchTerms: ["סטרליציה", "ציפור גן עדן", "strelitzia"]
  },
  {
    id: "strelitzia-reginae",
    scientificName: "Strelitzia reginae",
    rank: "species",
    genus: "Strelitzia",
    he: ["סטרליציה רגינה", "סטרליציה מלכותית", "ציפור גן עדן כתומה"],
    en: ["Strelitzia reginae", "crane flower", "orange bird of paradise"],
    searchTerms: ["סטרליציה", "ציפור גן עדן", "strelitzia"]
  },
  {
    // "ציפור גן עדן" (bird of paradise) is used in Israeli trade for both S. reginae and S. nicolai,
    // so on its own it only identifies the genus.
    id: "strelitzia",
    scientificName: "Strelitzia",
    rank: "genus",
    genus: "Strelitzia",
    he: ["סטרליציה", "סטרלציה", "ציפור גן עדן"],
    en: ["Strelitzia", "bird of paradise"],
    searchTerms: ["סטרליציה", "ציפור גן עדן", "strelitzia"]
  },
  {
    id: "peperomia",
    scientificName: "Peperomia",
    rank: "genus",
    genus: "Peperomia",
    he: ["פפרומיה", "פפרומייה"],
    en: ["Peperomia"]
  },
  {
    id: "peperomia-argyreia",
    scientificName: "Peperomia argyreia",
    rank: "species",
    genus: "Peperomia",
    he: ["פפרומיה אבטיח", "פפרומיה ארגירייה", "פפרומיה ארגיריאה"],
    en: ["Peperomia argyreia", "watermelon peperomia"],
    searchTerms: ["פפרומיה", "peperomia"]
  },
  {
    id: "peperomia-obtusifolia",
    scientificName: "Peperomia obtusifolia",
    rank: "species",
    genus: "Peperomia",
    he: ["פפרומיה אובטוסיפוליה", "פפרומיה עגולת עלים"],
    en: ["Peperomia obtusifolia", "baby rubber plant"],
    searchTerms: ["פפרומיה", "peperomia"]
  },
  {
    id: "pilea-peperomioides",
    scientificName: "Pilea peperomioides",
    rank: "species",
    genus: "Pilea",
    he: ["פילאה פפרומיואידס", "פילאה פפרומוידיס", "פילאה פפרומידיס", "צמח הכסף הסיני", "צמח המטבעות"],
    en: ["Pilea peperomioides", "Chinese money plant", "pancake plant", "UFO plant"],
    defaultNames: ["פילאה", "פיליאה", "pilea"]
  },
  {
    id: "schefflera-arboricola",
    scientificName: "Schefflera arboricola",
    rank: "species",
    genus: "Schefflera",
    he: ["שפלרה ארבוריקולה"],
    en: ["Schefflera arboricola", "Heptapleurum arboricola", "dwarf umbrella tree"],
    defaultNames: ["שפלרה", "שפלירה", "schefflera"]
  },
  {
    id: "hedera-helix",
    scientificName: "Hedera helix",
    rank: "species",
    genus: "Hedera",
    he: ["קיסוס החורש", "קיסוס", "הדרה"],
    en: ["Hedera helix", "English ivy", "common ivy"]
  },
  {
    id: "fittonia",
    scientificName: "Fittonia",
    rank: "genus",
    genus: "Fittonia",
    he: ["פיטוניה"],
    en: ["Fittonia", "nerve plant"]
  },
  {
    id: "codiaeum-variegatum",
    scientificName: "Codiaeum variegatum",
    rank: "species",
    genus: "Codiaeum",
    he: ["קרוטון", "קודיאום"],
    en: ["Codiaeum variegatum", "croton"]
  },
  {
    id: "begonia",
    scientificName: "Begonia",
    rank: "genus",
    genus: "Begonia",
    he: ["בגוניה", "בגוניות"],
    en: ["Begonia"]
  },
  {
    id: "begonia-rex",
    scientificName: "Begonia Rex Cultorum Group",
    rank: "species",
    genus: "Begonia",
    he: ["בגוניה רקס"],
    en: ["Begonia rex", "rex begonia", "painted-leaf begonia"],
    searchTerms: ["בגוניה", "begonia"]
  },
  {
    id: "begonia-maculata",
    scientificName: "Begonia maculata",
    rank: "species",
    genus: "Begonia",
    he: ["בגוניה מקולטה", "בגוניה מקולאטה", "בגוניה מנוקדת"],
    en: ["Begonia maculata", "polka dot begonia"],
    searchTerms: ["בגוניה", "begonia"]
  },
  {
    id: "tradescantia",
    scientificName: "Tradescantia",
    rank: "genus",
    genus: "Tradescantia",
    he: ["טרדסקנטיה", "טרדסקאנטיה"],
    en: ["Tradescantia", "wandering dude"]
  },
  {
    id: "tradescantia-zebrina",
    scientificName: "Tradescantia zebrina",
    rank: "species",
    genus: "Tradescantia",
    he: ["טרדסקנטיה זברינה"],
    en: ["Tradescantia zebrina", "inch plant"],
    searchTerms: ["טרדסקנטיה", "tradescantia"]
  },
  {
    id: "hoya",
    scientificName: "Hoya",
    rank: "genus",
    genus: "Hoya",
    he: ["הויה", "הוייה", "בת שבע"], // "בת שבע" is the Hebrew common name of Hoya
    en: ["Hoya", "wax plant"]
  },
  {
    id: "hoya-carnosa",
    scientificName: "Hoya carnosa",
    rank: "species",
    genus: "Hoya",
    he: ["הויה קרנוזה", "הויה קרנוסה", "הויה קומפקטה"], // H. carnosa 'Compacta' is sold as "Hoya compacta"
    en: ["Hoya carnosa"],
    searchTerms: ["הויה", "hoya"]
  },
  {
    id: "hoya-kerrii",
    scientificName: "Hoya kerrii",
    rank: "species",
    genus: "Hoya",
    he: ["הויה קרי", "הויה קריי", "הויה לב"],
    en: ["Hoya kerrii", "sweetheart hoya", "valentine hoya"],
    searchTerms: ["הויה", "hoya"]
  },

  // ---- Palms -----------------------------------------------------------------------------------
  {
    id: "dypsis-lutescens",
    scientificName: "Dypsis lutescens",
    rank: "species",
    genus: "Dypsis",
    he: ["דקל ארקה", "ארקה", "דיפסיס"],
    en: ["Dypsis lutescens", "areca palm", "butterfly palm", "golden cane palm"]
  },
  {
    id: "chamaedorea-elegans",
    scientificName: "Chamaedorea elegans",
    rank: "species",
    genus: "Chamaedorea",
    he: ["דקל סלון", "דקל הסלון", "כמדוריאה אלגנס"],
    en: ["Chamaedorea elegans", "parlor palm", "parlour palm"],
    defaultNames: ["כמדוריאה", "כמדוראה", "chamaedorea"]
  },
  {
    id: "howea-forsteriana",
    scientificName: "Howea forsteriana",
    rank: "species",
    genus: "Howea",
    he: ["קנטיה", "דקל קנטיה", "הוואה"],
    en: ["Howea forsteriana", "kentia palm", "kentia"]
  },
  {
    id: "rhapis-excelsa",
    scientificName: "Rhapis excelsa",
    rank: "species",
    genus: "Rhapis",
    he: ["ראפיס", "רפיס", "דקל ראפיס"],
    en: ["Rhapis excelsa", "lady palm", "broadleaf lady palm"]
  },

  // ---- Ferns -----------------------------------------------------------------------------------
  {
    id: "asplenium-nidus",
    scientificName: "Asplenium nidus",
    rank: "species",
    genus: "Asplenium",
    he: ["קן הציפור", "אספלניום נידוס"],
    en: ["Asplenium nidus", "bird's nest fern", "birds nest fern"],
    defaultNames: ["אספלניום", "asplenium"]
  },
  {
    id: "nephrolepis-exaltata",
    scientificName: "Nephrolepis exaltata",
    rank: "species",
    genus: "Nephrolepis",
    he: ["שרך בוסטון", "נפרולפיס אקסלטטה"],
    en: ["Nephrolepis exaltata", "Boston fern", "sword fern"],
    defaultNames: ["נפרולפיס", "nephrolepis"]
  },
  {
    id: "platycerium-bifurcatum",
    scientificName: "Platycerium bifurcatum",
    rank: "species",
    genus: "Platycerium",
    he: ["קרן הצבי", "קרן האייל", "פלטיצריום ביפורקטום"],
    en: ["Platycerium bifurcatum", "staghorn fern", "elkhorn fern"],
    defaultNames: ["פלטיצריום", "platycerium"]
  },

  // ---- Succulents & cacti ------------------------------------------------------------------------
  {
    id: "crassula-ovata",
    scientificName: "Crassula ovata",
    rank: "species",
    genus: "Crassula",
    he: ["עץ הכסף", "עץ הירקן", "קרסולה אובטה"],
    en: ["Crassula ovata", "jade plant", "money tree", "money plant"],
    defaultNames: ["קרסולה", "crassula"],
    cultivars: [
      { name: "Gollum", aliases: ["גולום", "gollum"] },
      { name: "Hobbit", aliases: ["הוביט", "hobbit"] }
    ]
  },
  {
    id: "aloe-vera",
    scientificName: "Aloe vera",
    rank: "species",
    genus: "Aloe",
    he: ["אלוורה", "אלוי ורה", "אלוה ורה", "אלווה ורה"],
    en: ["Aloe vera", "aloe barbadensis"],
    searchTerms: ["אלוורה", "אלוי", "aloe"]
  },
  {
    id: "aloe",
    scientificName: "Aloe",
    rank: "genus",
    genus: "Aloe",
    he: ["אלוי"],
    en: ["Aloe"]
  },
  {
    id: "curio-rowleyanus",
    scientificName: "Curio rowleyanus",
    rank: "species",
    genus: "Curio",
    he: ["סנציו כדורי", "מחרוזת פנינים", "סנציו רולייאנוס"],
    en: ["Curio rowleyanus", "Senecio rowleyanus", "string of pearls"]
  },
  {
    id: "ceropegia-woodii",
    scientificName: "Ceropegia woodii",
    rank: "species",
    genus: "Ceropegia",
    he: ["סרופגיה", "סרופגיה וודי", "מחרוזת לבבות", "שרשרת לבבות"],
    en: ["Ceropegia woodii", "string of hearts", "rosary vine"]
  },
  {
    id: "portulacaria-afra",
    scientificName: "Portulacaria afra",
    rank: "species",
    genus: "Portulacaria",
    he: ["פורטולקריה", "פורטולקריה אפרה"],
    en: ["Portulacaria afra", "elephant bush", "dwarf jade"]
  },
  {
    id: "haworthia",
    scientificName: "Haworthiopsis / Haworthia",
    rank: "genus",
    genus: "Haworthia",
    he: ["הוורטיה", "האוורטיה", "הבורטיה"],
    en: ["Haworthia", "zebra plant"]
  },
  {
    id: "echeveria",
    scientificName: "Echeveria",
    rank: "genus",
    genus: "Echeveria",
    he: ["אכבריה", "אצ'בריה", "אצבריה", "אקווריה"],
    en: ["Echeveria"]
  },
  {
    id: "kalanchoe",
    scientificName: "Kalanchoe",
    rank: "genus",
    genus: "Kalanchoe",
    he: ["קלנכואה", "קלנחואה", "קלנצ'ואה"],
    en: ["Kalanchoe"]
  },
  {
    id: "euphorbia-milii",
    scientificName: "Euphorbia milii",
    rank: "species",
    genus: "Euphorbia",
    he: ["כתר קוצים", "אופורביה מילי", "אופורביה מיליי"],
    en: ["Euphorbia milii", "crown of thorns"]
  },
  {
    id: "adenium-obesum",
    scientificName: "Adenium obesum",
    rank: "species",
    genus: "Adenium",
    he: ["אדניום", "שושנת המדבר", "אדניום אובזום"],
    en: ["Adenium obesum", "desert rose"]
  },
  {
    id: "cactaceae",
    scientificName: "Cactaceae",
    rank: "family",
    genus: "Cactaceae",
    he: ["קקטוס", "קקטוסים", "קקטוסי"],
    en: ["cactus", "cacti"]
  },

  // ---- Orchids -----------------------------------------------------------------------------------
  {
    id: "phalaenopsis",
    scientificName: "Phalaenopsis",
    rank: "genus",
    genus: "Phalaenopsis",
    family: "Orchidaceae",
    he: ["פלנופסיס", "פלאנופסיס", "סחלב פרפר", "סחלב הפרפר"],
    en: ["Phalaenopsis", "moth orchid"]
  },
  {
    id: "orchidaceae",
    scientificName: "Orchidaceae",
    rank: "family",
    genus: "Orchidaceae",
    he: ["סחלב", "סחלבים"],
    en: ["orchid", "orchids"]
  },

  // ---- Outdoor, herbs and trees ------------------------------------------------------------------
  {
    id: "bougainvillea",
    scientificName: "Bougainvillea",
    rank: "genus",
    genus: "Bougainvillea",
    he: ["בוגנוויליה", "בוגונביליה", "בוגנביליה", "בוגנויליה"],
    en: ["Bougainvillea"]
  },
  {
    id: "olea-europaea",
    scientificName: "Olea europaea",
    rank: "species",
    genus: "Olea",
    he: ["עץ זית", "זית אירופי", "זית"],
    en: ["Olea europaea", "olive tree"]
  },
  {
    id: "lavandula",
    scientificName: "Lavandula",
    rank: "genus",
    genus: "Lavandula",
    he: ["לבנדר", "אזוביון", "לוונדר"],
    en: ["Lavandula", "lavender"]
  },
  {
    id: "ocimum-basilicum",
    scientificName: "Ocimum basilicum",
    rank: "species",
    genus: "Ocimum",
    he: ["בזיליקום", "ריחן"],
    en: ["Ocimum basilicum", "basil", "sweet basil"]
  },
  {
    id: "salvia-rosmarinus",
    scientificName: "Salvia rosmarinus",
    rank: "species",
    genus: "Salvia",
    he: ["רוזמרין"],
    en: ["Salvia rosmarinus", "Rosmarinus officinalis", "rosemary"]
  },
  {
    id: "mentha",
    scientificName: "Mentha",
    rank: "genus",
    genus: "Mentha",
    he: ["נענע", "מנתה"],
    en: ["Mentha", "mint"]
  },
  {
    id: "citrus-limon",
    scientificName: "Citrus limon",
    rank: "species",
    genus: "Citrus",
    he: ["עץ לימון", "לימון"],
    en: ["Citrus limon", "lemon tree"]
  },
  {
    id: "jasminum",
    scientificName: "Jasminum",
    rank: "genus",
    genus: "Jasminum",
    he: ["יסמין"],
    en: ["Jasminum", "jasmine"]
  },
  {
    id: "gardenia-jasminoides",
    scientificName: "Gardenia jasminoides",
    rank: "species",
    genus: "Gardenia",
    he: ["גרדניה", "גרדניה יסמינית"],
    en: ["Gardenia jasminoides", "gardenia", "cape jasmine"]
  },
  {
    id: "pistacia-lentiscus",
    scientificName: "Pistacia lentiscus",
    rank: "species",
    genus: "Pistacia",
    he: ["אלת המסטיק", "אלת מסטיק"],
    en: ["Pistacia lentiscus", "mastic tree", "lentisk"]
  },
  {
    id: "zanthoxylum",
    scientificName: "Zanthoxylum",
    rank: "genus",
    genus: "Zanthoxylum",
    he: ["פלפלון סיני", "זנתוקסילום"],
    en: ["Zanthoxylum", "Chinese pepper", "Sichuan pepper"]
  }
];
