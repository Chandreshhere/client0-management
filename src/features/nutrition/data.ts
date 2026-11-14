import type { PlanStatus } from "@/data/types";

/**
 * Nutrition workspace fixtures (synthetic). Food values are rounded reference values for the demo,
 * not a nutrient database. Portions use Indian household measures (katori, phulka, glass).
 */

export type Diet = "veg" | "egg" | "nonveg";
export type GI = "low" | "medium" | "high";

export interface Food {
  id: string;
  name: string;
  portion: string;
  kcal: number;
  protein: number;
  fibre: number;
  diet: Diet;
  jain: boolean;
  gi: GI;
  region: string;
  /** 1 = everyday staple · 3 = premium ingredient (paneer, nuts, fish) */
  cost: 1 | 2 | 3;
}

const f = (id: string, name: string, portion: string, kcal: number, protein: number, fibre: number, diet: Diet, jain: boolean, gi: GI, region: string, cost: 1 | 2 | 3): Food => ({ id, name, portion, kcal, protein, fibre, diet, jain, gi, region, cost });

export const FOODS: Food[] = [
  // early morning & drinks
  f("methi-water", "Methi (fenugreek) water", "1 tsp seeds soaked in 1 glass", 12, 0.8, 1.5, "veg", true, "low", "Pan-Indian", 1),
  f("lemon-water", "Warm lemon water", "1 glass (250 ml)", 8, 0.1, 0.1, "veg", true, "low", "Pan-Indian", 1),
  f("almonds-walnuts", "Soaked almonds & walnuts", "5 almonds + 2 walnut halves", 95, 3, 1.4, "veg", true, "low", "Pan-Indian", 3),
  f("green-tea", "Green tea", "1 cup (150 ml)", 2, 0, 0, "veg", true, "low", "Pan-Indian", 2),
  f("masala-chai", "Masala chai, less sugar", "1 cup (150 ml)", 70, 2.5, 0, "veg", false, "medium", "Pan-Indian", 1),
  f("buttermilk", "Buttermilk (chaas)", "1 glass (250 ml)", 60, 3.3, 0, "veg", true, "low", "Gujarati", 1),
  f("toned-milk", "Toned milk", "1 glass (200 ml)", 120, 6.2, 0, "veg", true, "low", "Pan-Indian", 1),
  f("ragi-malt", "Ragi malt", "1 glass (200 ml)", 130, 4, 3, "veg", true, "low", "South Indian", 1),
  // breakfast
  f("idli-sambar", "Idli with sambar", "2 idli + 1 katori sambar", 250, 9, 5, "veg", false, "medium", "South Indian", 1),
  f("plain-dosa", "Plain dosa with chutney", "1 medium dosa + 2 tbsp chutney", 230, 5, 2, "veg", false, "high", "South Indian", 1),
  f("ragi-dosa", "Ragi dosa", "2 small dosa", 210, 6, 5, "veg", true, "low", "South Indian", 1),
  f("pesarattu", "Pesarattu (green moong dosa)", "2 medium", 240, 12, 5, "veg", false, "low", "Andhra", 1),
  f("moong-chilla", "Moong dal chilla", "2 medium chilla + mint chutney", 220, 12, 4, "veg", true, "low", "North Indian", 1),
  f("besan-chilla", "Besan chilla", "2 medium chilla", 240, 11, 4, "veg", true, "low", "North Indian", 1),
  f("veg-poha", "Vegetable poha", "1 katori (150 g)", 250, 5, 3, "veg", false, "medium", "Maharashtrian", 1),
  f("rava-upma", "Rava upma", "1 katori (150 g)", 230, 6, 2.5, "veg", false, "medium", "South Indian", 1),
  f("masala-oats", "Masala oats", "1 katori (150 g)", 200, 7, 5, "veg", false, "low", "Pan-Indian", 2),
  f("dalia-khichdi", "Dalia khichdi (Jain style)", "1 katori (150 g)", 190, 7, 5, "veg", true, "low", "Gujarati", 1),
  f("thepla", "Methi thepla", "2 thepla", 240, 6, 4, "veg", true, "medium", "Gujarati", 1),
  f("dhokla", "Khaman dhokla", "3 pieces", 160, 6, 2, "veg", true, "medium", "Gujarati", 1),
  f("egg-bhurji-roti", "Egg bhurji with multigrain roti", "2 eggs + 1 roti", 300, 16, 3, "egg", false, "low", "North Indian", 2),
  f("boiled-eggs", "Boiled eggs", "2 eggs", 140, 12, 0, "egg", false, "low", "Pan-Indian", 1),
  f("masala-omelette", "Masala omelette", "2-egg omelette", 190, 13, 1, "egg", false, "low", "Pan-Indian", 1),
  f("paneer-bhurji", "Paneer bhurji", "75 g paneer", 230, 14, 1, "veg", false, "low", "North Indian", 3),
  // snacks & fruit
  f("sprouts-chaat", "Sprouts chaat", "1 katori (100 g)", 140, 9, 4, "veg", false, "low", "Pan-Indian", 1),
  f("roasted-chana", "Roasted chana", "1 handful (30 g)", 110, 6, 3.5, "veg", true, "low", "Pan-Indian", 1),
  f("makhana", "Roasted makhana", "1 cup (25 g)", 90, 3, 2, "veg", true, "low", "Pan-Indian", 2),
  f("peanut-chikki", "Peanut chikki", "1 piece (20 g)", 100, 3, 1, "veg", true, "medium", "Maharashtrian", 1),
  f("hung-curd", "Hung curd with seeds", "1 katori (150 g) + 1 tsp seeds", 150, 12, 1.5, "veg", true, "low", "Pan-Indian", 2),
  f("curd", "Curd (dahi)", "1 katori (150 g)", 90, 5, 0, "veg", true, "low", "Pan-Indian", 1),
  f("guava", "Guava", "1 medium (100 g)", 68, 2.6, 5.4, "veg", true, "low", "Pan-Indian", 1),
  f("papaya", "Papaya", "1 katori (120 g)", 50, 0.6, 2, "veg", true, "medium", "Pan-Indian", 1),
  f("apple", "Apple", "1 small (120 g)", 62, 0.3, 2.9, "veg", true, "low", "Pan-Indian", 2),
  f("banana", "Banana", "1 small (90 g)", 80, 1, 2.3, "veg", true, "medium", "Pan-Indian", 1),
  f("dates", "Dates", "2 dates", 46, 0.4, 1.3, "veg", true, "medium", "Pan-Indian", 2),
  // mains
  f("phulka", "Phulka (whole wheat)", "2 phulka, no ghee", 170, 6, 4, "veg", true, "medium", "North Indian", 1),
  f("multigrain-roti", "Multigrain roti", "2 roti", 190, 7, 5, "veg", true, "low", "North Indian", 1),
  f("jowar-bhakri", "Jowar bhakri", "1 bhakri", 150, 4.5, 4, "veg", true, "low", "Maharashtrian", 1),
  f("brown-rice", "Brown rice", "1 katori cooked (150 g)", 165, 3.8, 2.7, "veg", true, "medium", "Pan-Indian", 2),
  f("white-rice", "Steamed white rice", "1 katori cooked (150 g)", 195, 4, 0.6, "veg", true, "high", "Pan-Indian", 1),
  f("matta-rice", "Kerala matta rice", "1 katori cooked (150 g)", 170, 4, 3, "veg", true, "medium", "Kerala", 1),
  f("toor-dal", "Toor dal (plain tadka)", "1 katori (150 ml)", 150, 9, 4, "veg", true, "low", "Pan-Indian", 1),
  f("sambar", "Sambar", "1 katori (150 ml)", 130, 6, 4, "veg", false, "low", "South Indian", 1),
  f("rajma", "Rajma curry", "1 katori (150 g)", 210, 10, 7, "veg", false, "low", "North Indian", 1),
  f("palak-paneer", "Palak paneer", "1 katori (75 g paneer)", 250, 13, 3, "veg", false, "low", "North Indian", 3),
  f("soya-curry", "Soya chunk curry", "1 katori (30 g dry soya)", 180, 16, 4, "veg", false, "low", "Pan-Indian", 1),
  f("tofu-stirfry", "Tofu stir-fry", "100 g tofu + vegetables", 160, 14, 3, "veg", false, "low", "Pan-Indian", 3),
  f("bhindi-sabzi", "Bhindi sabzi", "1 katori (100 g)", 100, 2, 3, "veg", true, "low", "North Indian", 1),
  f("lauki-sabzi", "Lauki sabzi (Jain style)", "1 katori (120 g)", 80, 2, 3, "veg", true, "low", "Gujarati", 1),
  f("mixed-veg", "Mixed vegetable sabzi", "1 katori (120 g)", 120, 3, 4, "veg", false, "low", "Pan-Indian", 1),
  f("avial", "Avial", "1 katori (120 g)", 160, 3, 4, "veg", false, "low", "Kerala", 1),
  f("kachumber", "Kachumber salad", "1 katori", 35, 1, 2, "veg", false, "low", "Pan-Indian", 1),
  f("veg-soup", "Clear vegetable soup", "1 bowl (200 ml)", 60, 2, 2, "veg", false, "low", "Pan-Indian", 1),
  f("moong-khichdi", "Moong dal khichdi", "1 katori (200 g)", 230, 9, 4, "veg", true, "medium", "Gujarati", 1),
  f("fish-curry", "Kerala fish curry", "2 pieces + gravy", 210, 22, 1, "nonveg", false, "low", "Kerala", 3),
  f("chicken-curry", "Home-style chicken curry", "100 g chicken + gravy", 240, 24, 1, "nonveg", false, "low", "North Indian", 3),
];

export const foodById = (id: string) => FOODS.find((x) => x.id === id);

export const DIET_LABEL: Record<Diet, string> = { veg: "Vegetarian", egg: "Contains egg", nonveg: "Non-veg" };

export type SlotId = "early" | "breakfast" | "midmorning" | "lunch" | "evening" | "dinner";

/** Meal slots with home-day and office-day timings (routine-aware). Packable = carried to work. */
export const SLOTS: { id: SlotId; label: string; home: string; office: string; packable: boolean }[] = [
  { id: "early", label: "Early morning", home: "06:45", office: "06:30", packable: false },
  { id: "breakfast", label: "Breakfast", home: "08:30", office: "07:45", packable: false },
  { id: "midmorning", label: "Mid-morning", home: "11:00", office: "11:00", packable: true },
  { id: "lunch", label: "Lunch", home: "13:30", office: "13:30", packable: true },
  { id: "evening", label: "Evening", home: "17:00", office: "17:00", packable: true },
  { id: "dinner", label: "Dinner", home: "20:00", office: "20:30", packable: false },
];

export const SLOT_LABEL = Object.fromEntries(SLOTS.map((s) => [s.id, s.label])) as Record<SlotId, string>;

export type SubReason = "availability" | "preference" | "budget";
export const SUB_REASON_LABEL: Record<SubReason, string> = { availability: "Availability", preference: "Preference", budget: "Budget" };

/** Reviewed substitutions offered alongside a food (availability, preference or affordability). */
export const SWAPS: Record<string, { foodId: string; reason: SubReason; note: string }[]> = {
  "moong-chilla": [
    { foodId: "pesarattu", reason: "preference", note: "South Indian weekend breakfast" },
    { foodId: "besan-chilla", reason: "availability", note: "When moong batter isn't soaked overnight" },
  ],
  guava: [
    { foodId: "apple", reason: "availability", note: "When guava is out of season" },
    { foodId: "papaya", reason: "availability", note: "Any seasonal fruit, 1 katori" },
  ],
  "roasted-chana": [{ foodId: "makhana", reason: "preference", note: "Lighter crunch for office desk" }],
  "multigrain-roti": [
    { foodId: "jowar-bhakri", reason: "preference", note: "Millet option" },
    { foodId: "phulka", reason: "availability", note: "Office canteen: ask for phulka without ghee" },
  ],
  "egg-bhurji-roti": [
    { foodId: "paneer-bhurji", reason: "preference", note: "No-egg days (Tuesday)" },
    { foodId: "soya-curry", reason: "budget", note: "Same protein at lower cost" },
  ],
  "fish-curry": [{ foodId: "soya-curry", reason: "budget", note: "Fish on 2 days, soya on others" }],
  "chicken-curry": [{ foodId: "soya-curry", reason: "budget", note: "Lower cost, similar protein" }],
  "palak-paneer": [{ foodId: "soya-curry", reason: "budget", note: "Paneer is the costliest item this week" }],
  "almonds-walnuts": [{ foodId: "roasted-chana", reason: "budget", note: "Everyday alternative to nuts" }],
  "brown-rice": [{ foodId: "matta-rice", reason: "availability", note: "Kerala red rice from local store" }],
  "toor-dal": [{ foodId: "sambar", reason: "preference", note: "Family meal days" }],
  "hung-curd": [{ foodId: "curd", reason: "budget", note: "Home-set curd" }],
  "sprouts-chaat": [{ foodId: "roasted-chana", reason: "availability", note: "When there was no time to sprout" }],
  "bhindi-sabzi": [{ foodId: "lauki-sabzi", reason: "availability", note: "Any non-starchy sabzi" }],
};

export interface TemplateDef {
  id: string;
  name: string;
  description: string;
  preference: string;
  kcal: number;
  slots: Record<SlotId, string[]>;
}

export const TEMPLATES: TemplateDef[] = [
  {
    id: "pcos-lowgi", name: "PCOS · low-GI eggetarian", description: "1,700 kcal · protein at every meal · packed snacks", preference: "Eggetarian", kcal: 1700,
    slots: { early: ["methi-water", "almonds-walnuts"], breakfast: ["moong-chilla", "curd"], midmorning: ["guava", "roasted-chana"], lunch: ["multigrain-roti", "toor-dal", "bhindi-sabzi", "kachumber"], evening: ["green-tea", "sprouts-chaat"], dinner: ["egg-bhurji-roti", "veg-soup", "mixed-veg"] },
  },
  {
    id: "heart-south-veg", name: "Heart-healthy · South Indian vegetarian", description: "2,100 kcal · oil 3 tsp/day · 30 g fibre", preference: "Vegetarian", kcal: 2100,
    slots: { early: ["lemon-water", "almonds-walnuts"], breakfast: ["idli-sambar", "papaya"], midmorning: ["guava", "roasted-chana"], lunch: ["matta-rice", "sambar", "avial", "curd", "kachumber"], evening: ["masala-chai", "sprouts-chaat", "ragi-malt"], dinner: ["phulka", "toor-dal", "bhindi-sabzi", "veg-soup"] },
  },
  {
    id: "dash-lowsodium", name: "DASH-style · low sodium", description: "1,900 kcal · sodium < 2 g · fish or chicken twice", preference: "Non-vegetarian", kcal: 1900,
    slots: { early: ["lemon-water", "almonds-walnuts"], breakfast: ["masala-oats", "boiled-eggs"], midmorning: ["apple", "buttermilk"], lunch: ["brown-rice", "fish-curry", "mixed-veg", "kachumber"], evening: ["green-tea", "makhana", "guava"], dinner: ["multigrain-roti", "chicken-curry", "lauki-sabzi", "veg-soup"] },
  },
  {
    id: "jain-iron", name: "Iron-rich · Jain vegetarian", description: "1,800 kcal · vitamin C with iron · no root vegetables", preference: "Jain", kcal: 1800,
    slots: { early: ["dates", "almonds-walnuts"], breakfast: ["thepla", "curd"], midmorning: ["guava", "roasted-chana"], lunch: ["phulka", "toor-dal", "lauki-sabzi", "buttermilk"], evening: ["peanut-chikki", "ragi-malt"], dinner: ["moong-khichdi", "bhindi-sabzi", "papaya"] },
  },
  {
    id: "diabetes-kerala", name: "Diabetes · Kerala meals", description: "1,800 kcal · consistent carbohydrate timing", preference: "Non-vegetarian", kcal: 1800,
    slots: { early: ["methi-water", "almonds-walnuts"], breakfast: ["ragi-dosa", "sambar"], midmorning: ["buttermilk", "guava"], lunch: ["matta-rice", "fish-curry", "avial", "kachumber"], evening: ["green-tea", "roasted-chana"], dinner: ["phulka", "toor-dal", "mixed-veg"] },
  },
  {
    id: "prenatal-iron", name: "Prenatal · iron & protein", description: "2,200 kcal · small frequent meals", preference: "Vegetarian", kcal: 2200,
    slots: { early: ["dates", "almonds-walnuts", "toned-milk"], breakfast: ["besan-chilla", "curd"], midmorning: ["ragi-malt", "guava"], lunch: ["phulka", "palak-paneer", "brown-rice", "kachumber"], evening: ["roasted-chana", "banana", "makhana"], dinner: ["multigrain-roti", "toor-dal", "mixed-veg"] },
  },
  {
    id: "nafld-med", name: "NAFLD · Mediterranean-Indian", description: "1,900 kcal · no added sugar · whole grains", preference: "Vegetarian", kcal: 1900,
    slots: { early: ["lemon-water", "almonds-walnuts"], breakfast: ["besan-chilla", "hung-curd"], midmorning: ["apple", "green-tea"], lunch: ["brown-rice", "rajma", "kachumber", "mixed-veg"], evening: ["buttermilk", "roasted-chana"], dinner: ["multigrain-roti", "soya-curry", "veg-soup", "lauki-sabzi"] },
  },
  {
    id: "lowfodmap", name: "Low-FODMAP · vegetarian (phase 2)", description: "2,000 kcal · lactose-free · no onion or garlic", preference: "Vegetarian", kcal: 2000,
    slots: { early: ["lemon-water", "almonds-walnuts"], breakfast: ["plain-dosa", "banana"], midmorning: ["papaya", "makhana"], lunch: ["white-rice", "bhindi-sabzi", "tofu-stirfry", "toor-dal"], evening: ["green-tea", "peanut-chikki"], dinner: ["brown-rice", "lauki-sabzi", "toor-dal", "ragi-dosa"] },
  },
];

export const templateById = (id: string) => TEMPLATES.find((t) => t.id === id);

/** Which template seeded each plan, plus patient-specific practical notes on items. */
export const PLAN_SOURCE: Record<string, { template: string; notes?: Partial<Record<string, string>> }> = {
  "np-aditi": {
    template: "pcos-lowgi",
    notes: {
      "moong-chilla": "Batter soaked the night before; cook makes it on office days",
      "roasted-chana": "Keep a jar at the office desk",
      "multigrain-roti": "Office days: pack from home — canteen thali is rice-heavy",
      "sprouts-chaat": "Packed in a steel tiffin on office days",
      "egg-bhurji-roti": "Take metformin with this meal — don't skip dinner",
    },
  },
  "np-kabir": { template: "heart-south-veg", notes: { "phulka": "Office days: dinner by 19:30 — carry phulka, eat before the commute" } },
  "np-arun": { template: "dash-lowsodium", notes: { "fish-curry": "Grilled or curry with 1 tsp oil; no added salt at table" } },
  "np-rajesh": { template: "diabetes-kerala", notes: { "matta-rice": "1 katori only — use a measured katori, not a plate" } },
  "np-sameer": { template: "nafld-med" },
  "np-tanvi": { template: "jain-iron", notes: { "guava": "Vitamin C with the iron-rich snack" } },
  "np-ishita": { template: "prenatal-iron", notes: { "palak-paneer": "Iron tablet 2 h away from this meal and from tea" } },
  "np-nikhil": { template: "lowfodmap" },
};

export interface Routine {
  work: string;
  cooking: string;
  availability: string;
  budget: string;
  preferences: string[];
  appetite: string;
  officeDays: string | null;
}

export const ROUTINES: Record<string, Routine> = {
  "p-aditi": {
    work: "Product designer, hybrid — office Tue & Thu 09:30–18:30 (50 min commute). Works from home Mon, Wed, Fri.",
    cooking: "Cook comes 07:30–09:00 on weekdays (breakfast + lunch). Aditi cooks dinner; no help on weekends.",
    availability: "Office canteen on Tue/Thu serves rice-based thalis; vending machine snacks only after 16:00.",
    budget: "Moderate — around ₹9,000 a month for two. Prefers not to buy specialty items (quinoa, chia).",
    preferences: ["Eggetarian", "Savoury breakfasts", "South Indian on weekends", "Dislikes bitter gourd"],
    appetite: "Low appetite early morning; hunger peaks around 17:00.",
    officeDays: "Tue · Thu",
  },
  "p-kabir": {
    work: "Software engineer, office 3 days (Mon, Wed, Thu) 10:00–19:00; 40 min metro commute.",
    cooking: "Mother cooks for the family; Kabir makes his own breakfast.",
    availability: "Office pantry has fruit and buttermilk. Late meetings on Thursdays.",
    budget: "Comfortable — no constraint mentioned.",
    preferences: ["Vegetarian", "South Indian", "Filter coffee — limit to 1 cup"],
    appetite: "Normal; snacks late on office days.",
    officeDays: "Mon · Wed · Thu",
  },
  "p-arun": {
    work: "Retired bank manager; walks 07:00–07:30 with a neighbour.",
    cooking: "Wife cooks all meals; family eats fish twice a week.",
    availability: "Local market for fish on Wednesdays and Saturdays.",
    budget: "Pension income — keep weekly fish and nuts affordable.",
    preferences: ["Non-vegetarian", "Prefers rice at lunch", "Likes pickle — salty"],
    appetite: "Reduced since the MI; small portions.",
    officeDays: null,
  },
  "p-rajesh": {
    work: "Runs a hardware shop 09:30–20:30, six days a week.",
    cooking: "Wife cooks; lunch is a packed tiffin to the shop.",
    availability: "Tea and biscuits offered to customers through the day.",
    budget: "Moderate.",
    preferences: ["Non-vegetarian", "Kerala meals", "Matta rice"],
    appetite: "Large lunch, light dinner.",
    officeDays: "Mon – Sat",
  },
  "p-sameer": {
    work: "Sales manager — 2 days of field travel each week.",
    cooking: "Cooks himself; orders in when travelling.",
    availability: "Highway dhabas and hotel breakfasts on travel days.",
    budget: "Comfortable.",
    preferences: ["Vegetarian", "Enjoys rajma-chawal", "Weekend family snacks"],
    appetite: "Normal; snacks when stressed.",
    officeDays: "Field days vary",
  },
  "p-tanvi": {
    work: "College student — classes 09:00–15:30, hostel weekdays.",
    cooking: "Hostel mess (Jain counter available); home on weekends.",
    availability: "Mess menu rotates weekly; fruit stall at the gate.",
    budget: "Tight — pocket money about ₹1,500 a month for extras.",
    preferences: ["Jain — no root vegetables, no onion or garlic", "Likes thepla", "Avoids milk at night"],
    appetite: "Low; skips breakfast before early classes.",
    officeDays: "Mon – Fri (college)",
  },
  "p-ishita": {
    work: "Teacher, school hours 07:45–14:30; on her feet most of the day.",
    cooking: "Husband cooks dinner; Ishita packs a tiffin for school.",
    availability: "Staff room has tea only.",
    budget: "Moderate.",
    preferences: ["Vegetarian", "Bengali home food", "Avoids strong smells (nausea easing)"],
    appetite: "Improving after the first trimester; small frequent meals help.",
    officeDays: "Mon – Sat (school)",
  },
  "p-nikhil": {
    work: "Data analyst, fully remote.",
    cooking: "Cooks simple meals; orders in twice a week.",
    availability: "Lactose-free milk from the online grocer.",
    budget: "Comfortable.",
    preferences: ["Vegetarian", "Lactose-intolerant", "No onion or garlic during trial"],
    appetite: "Normal; bloating after large meals.",
    officeDays: null,
  },
};

export interface Guidance {
  by: string;
  version: string;
  effective: string;
  review: string;
  lines: string[];
  changed: { at: string; summary: string } | null;
  targets: { kcal: number; protein: number; fibre: number };
}

export const GUIDANCE: Record<string, Guidance> = {
  "p-aditi": {
    by: "s-vikram", version: "v2", effective: "2026-11-10T16:20:00+05:30", review: "2027-02-10",
    lines: [
      "Energy about 1,700 kcal/day for gradual loss of 0.5 kg/week.",
      "Protein at least 70 g/day.",
      "Prefer low-GI carbohydrates; no sugary drinks.",
      "Metformin 500 mg with dinner — dinner must not be skipped.",
      "Fibre at least 25 g/day.",
    ],
    changed: { at: "2026-11-10T16:20:00+05:30", summary: "Protein target raised from 60 g to 70 g. Metformin started — dinner can no longer be skipped." },
    targets: { kcal: 1700, protein: 70, fibre: 25 },
  },
  "p-kabir": {
    by: "s-ananya", version: "v3", effective: "2026-11-06T11:05:00+05:30", review: "2026-12-04",
    lines: ["Oil 3 tsp/day; salt under 5 g/day.", "Coffee limited to 1 cup before noon.", "LDL-C target below 70 mg/dL — prioritise soluble fibre.", "No breath retention or fasting protocols."],
    changed: null,
    targets: { kcal: 2100, protein: 75, fibre: 30 },
  },
  "p-arun": {
    by: "s-ananya", version: "v1", effective: "2026-11-11T12:30:00+05:30", review: "2026-12-11",
    lines: ["Post-MI: sodium under 2 g/day.", "Saturated fat under 7% of energy; triglycerides 260 mg/dL.", "Fish twice a week is encouraged.", "Weight goal 80 kg by February."],
    changed: null,
    targets: { kcal: 1900, protein: 80, fibre: 30 },
  },
  "p-rajesh": {
    by: "s-vikram", version: "v2", effective: "2026-10-21T11:40:00+05:30", review: "2027-01-21",
    lines: ["HbA1c 8.4% — carbohydrate about 45% of energy, at consistent times.", "No fruit juices or sweetened tea.", "Walk 15 minutes after lunch."],
    changed: null,
    targets: { kcal: 1800, protein: 75, fibre: 30 },
  },
  "p-sameer": {
    by: "s-vikram", version: "v1", effective: "2026-08-01T10:00:00+05:30", review: "2027-02-01",
    lines: ["NAFLD: aim for 7% weight loss over 6 months.", "No alcohol.", "Limit added sugar and fructose drinks."],
    changed: null,
    targets: { kcal: 1900, protein: 80, fibre: 30 },
  },
  "p-tanvi": {
    by: "s-vikram", version: "v1", effective: "2026-11-12T10:00:00+05:30", review: "2027-01-12",
    lines: ["Ferritin 9 ng/mL — iron-rich foods with vitamin C at the same meal.", "Tea or coffee at least 1 h away from meals.", "Iron tablet as prescribed; guardian consent pending for under-21 programme."],
    changed: { at: "2026-11-12T10:00:00+05:30", summary: "New guidance with the assignment on 12 Nov." },
    targets: { kcal: 1800, protein: 60, fibre: 25 },
  },
  "p-ishita": {
    by: "s-sana", version: "v2", effective: "2026-11-09T10:40:00+05:30", review: "2026-12-07",
    lines: ["22 weeks; Hb 10.2 g/dL — iron and folate focus.", "No raw sprouts or unpasteurised dairy.", "Small, frequent meals; 2.5 L fluids."],
    changed: null,
    targets: { kcal: 2200, protein: 75, fibre: 28 },
  },
  "p-nikhil": {
    by: "s-vikram", version: "v1", effective: "2026-09-02T13:00:00+05:30", review: "2026-12-02",
    lines: ["IBS — low-FODMAP trial under nutritionist supervision only.", "Lactose intolerance confirmed."],
    changed: null,
    targets: { kcal: 2000, protein: 65, fibre: 25 },
  },
};

export interface VersionEntry {
  version: number;
  status: PlanStatus;
  by: string;
  at: string;
  why: string;
  changes: string[];
}

/** Change lines start with + (added), − (removed) or ~ (changed). */
export const PLAN_HISTORY: Record<string, VersionEntry[]> = {
  "np-aditi": [
    { version: 1, status: "superseded", by: "s-meera", at: "2026-09-18T15:00:00+05:30", why: "First plan after the nutrition assessment (PCOS, insulin resistance).", changes: ["+ Created from “PCOS · low-GI eggetarian”, reviewed for Aditi", "~ Energy 1,600 kcal"] },
    { version: 2, status: "published", by: "s-meera", at: "2026-10-16T12:10:00+05:30", why: "Patient was skipping sweet breakfasts; canteen lunches on office days.", changes: ["~ Breakfast: oats porridge → moong dal chilla", "+ Packed lunch for Tue/Thu", "~ Energy 1,600 → 1,700 kcal"] },
    { version: 3, status: "in-review", by: "s-meera", at: "2026-11-12T12:40:00+05:30", why: "Dr. Vikram Iyer raised the protein target to 70 g (guidance v2). Breakfast skipped 3 of 7 days (self-reported).", changes: ["+ Curd at breakfast", "+ Roasted chana mid-morning (portable)", "~ Dinner: paneer → egg bhurji", "~ Protein 60 → 78 g"] },
  ],
  "np-kabir": [
    { version: 1, status: "superseded", by: "s-meera", at: "2026-09-12T12:00:00+05:30", why: "Assigned by Dr. Ananya Rao — LDL 142 mg/dL at baseline.", changes: ["+ Created from “Heart-healthy · South Indian vegetarian”"] },
    { version: 2, status: "superseded", by: "s-meera", at: "2026-09-30T10:00:00+05:30", why: "Weight stable; patient asked for more variety at dinner.", changes: ["+ Phulka dinner option", "− Second rice serving"] },
    { version: 3, status: "superseded", by: "s-meera", at: "2026-10-21T16:30:00+05:30", why: "Fibre below 25 g on office days.", changes: ["+ Guava mid-morning", "+ Sprouts chaat evening"] },
    { version: 4, status: "published", by: "s-meera", at: "2026-11-12T17:05:00+05:30", why: "Dinner timing slipping on work-from-office days.", changes: ["~ Office days: dinner by 19:30, eaten before the commute", "+ Ragi malt evening (keeps dinner light)"] },
  ],
  "np-arun": [
    { version: 1, status: "draft", by: "s-meera", at: "2026-11-12T16:00:00+05:30", why: "Drafted ahead of the visit from Dr. Ananya Rao's assignment (post-MI).", changes: ["+ Created from “DASH-style · low sodium”"] },
  ],
  "np-rajesh": [
    { version: 1, status: "superseded", by: "s-rohan", at: "2025-11-24T11:00:00+05:30", why: "Initial diabetes plan.", changes: ["+ Created from “Diabetes · Kerala meals”"] },
    { version: 2, status: "published", by: "s-rohan", at: "2026-10-22T10:00:00+05:30", why: "HbA1c rose to 8.4%; doctor asked for consistent carbohydrate timing.", changes: ["~ Lunch rice measured to 1 katori", "+ Methi water early morning"] },
  ],
  "np-sameer": [
    { version: 1, status: "superseded", by: "s-rohan", at: "2026-08-05T18:00:00+05:30", why: "NAFLD programme start.", changes: ["+ Created from “NAFLD · Mediterranean-Indian”"] },
    { version: 2, status: "published", by: "s-rohan", at: "2026-11-01T19:20:00+05:30", why: "Travel days needed hotel-breakfast swaps.", changes: ["+ Travel-day breakfast options", "~ Evening snack: chikki → roasted chana"] },
  ],
  "np-tanvi": [
    { version: 1, status: "draft", by: "s-meera", at: "2026-11-12T11:30:00+05:30", why: "Draft before today's assessment at 16:30.", changes: ["+ Created from “Iron-rich · Jain vegetarian”"] },
  ],
  "np-ishita": [
    { version: 1, status: "superseded", by: "s-meera", at: "2026-08-20T11:00:00+05:30", why: "First-trimester plan (nausea).", changes: ["+ Created from “Prenatal · iron & protein”"] },
    { version: 2, status: "published", by: "s-meera", at: "2026-11-09T11:00:00+05:30", why: "Second trimester; Hb 10.2 g/dL.", changes: ["+ Palak paneer at lunch", "~ Energy 2,000 → 2,200 kcal"] },
  ],
  "np-nikhil": [
    { version: 1, status: "superseded", by: "s-rohan", at: "2026-09-05T13:00:00+05:30", why: "Low-FODMAP elimination phase.", changes: ["+ Created from “Low-FODMAP · vegetarian”"] },
    { version: 2, status: "superseded", by: "s-rohan", at: "2026-09-26T13:00:00+05:30", why: "Symptoms settled; widen grains.", changes: ["+ Ragi dosa", "+ Brown rice"] },
    { version: 3, status: "superseded", by: "s-rohan", at: "2026-10-18T13:00:00+05:30", why: "Reintroduction phase started — managed in consultation.", changes: ["~ Plan closed; reintroduction handled visit by visit"] },
  ],
};

/* ------------------------------------------------------------------ food logs */

export type Fill = "sambar" | "dal" | "curd" | "chutney" | "rajma" | "sabzi" | "soup" | "chai" | "malt" | "cabbage";

export type PlatePart =
  | { k: "katori"; x: number; y: number; fill: Fill; r?: number }
  | { k: "idli"; x: number; y: number }
  | { k: "roti"; x: number; y: number; r?: number }
  | { k: "chilla"; x: number; y: number; r?: number }
  | { k: "rice"; x: number; y: number; r?: number }
  | { k: "salad"; x: number; y: number; r?: number }
  | { k: "fruit"; x: number; y: number; fill: "guava" | "papaya" | "apple" }
  | { k: "bhurji"; x: number; y: number; r?: number }
  | { k: "samosa"; x: number; y: number; rot?: number }
  | { k: "papad"; x: number; y: number; r?: number }
  | { k: "sprouts"; x: number; y: number; r?: number }
  | { k: "dates"; x: number; y: number }
  | { k: "cup"; x: number; y: number; fill: Fill };

export interface PlateSpec {
  vessel: "thali" | "plate" | "bowl" | "tray" | "none";
  parts: PlatePart[];
  /** describes the render for assistive tech */
  alt: string;
}

export type LogMatch = "as-planned" | "partly" | "different" | "skipped";
export const LOG_MATCH_LABEL: Record<LogMatch, string> = { "as-planned": "As planned", partly: "Partly as planned", different: "Different from plan", skipped: "Skipped" };

export type LogStatus = "new" | "reviewed" | "flagged";

export interface LogComment {
  id: string;
  by: string;
  at: string;
  text: string;
}

export interface FoodLog {
  id: string;
  patientId: string;
  slot: SlotId;
  eatenAt: string;
  loggedAt: string;
  text: string;
  photo: PlateSpec | null;
  source: string;
  planned: string;
  planVersion: number;
  match: LogMatch;
  status: LogStatus;
  reviewedBy?: { by: string; at: string };
  flag?: { reason: string; by: string; at: string };
  comments: LogComment[];
}

const L = (day: number, hhmm: string) => `2026-11-${String(day).padStart(2, "0")}T${hhmm}:00+05:30`;

export const FLAG_REASONS = ["Pattern to discuss at review", "Portion concern", "Needs doctor input", "Photo unclear — ask patient", "Possible low blood sugar risk"];

export const FOOD_LOGS: FoodLog[] = [
  {
    id: "log-a1", patientId: "p-aditi", slot: "breakfast", eatenAt: L(13, "07:50"), loggedAt: L(13, "08:12"),
    text: "2 moong dal chilla with curd and mint chutney", source: "Patient app · photo",
    photo: { vessel: "plate", alt: "Plate with two moong dal chillas, a katori of curd and a small katori of mint chutney", parts: [{ k: "chilla", x: 98, y: 82, r: 30 }, { k: "chilla", x: 124, y: 108, r: 28 }, { k: "katori", x: 166, y: 70, fill: "curd", r: 20 }, { k: "katori", x: 160, y: 120, fill: "chutney", r: 13 }] },
    planned: "Moong dal chilla ×2", planVersion: 2, match: "as-planned", status: "new", comments: [],
  },
  {
    id: "log-a2", patientId: "p-aditi", slot: "evening", eatenAt: L(12, "17:20"), loggedAt: L(12, "17:31"),
    text: "Sprouts chaat from home — ate it at my desk", source: "Patient app · photo",
    photo: { vessel: "bowl", alt: "Steel bowl of sprouts chaat with tomato and coriander", parts: [{ k: "sprouts", x: 120, y: 90, r: 46 }] },
    planned: "Green tea + sprouts chaat (packed)", planVersion: 2, match: "as-planned", status: "new", comments: [],
  },
  {
    id: "log-a3", patientId: "p-aditi", slot: "lunch", eatenAt: L(12, "13:45"), loggedAt: L(12, "14:02"),
    text: "Office canteen thali — rice, dal, cabbage sabzi, papad. Left half the rice.", source: "Patient app · photo",
    photo: { vessel: "tray", alt: "Canteen steel tray with rice, dal, cabbage sabzi and a papad", parts: [{ k: "rice", x: 78, y: 92, r: 34 }, { k: "katori", x: 152, y: 58, fill: "dal", r: 19 }, { k: "katori", x: 182, y: 104, fill: "cabbage", r: 19 }, { k: "papad", x: 138, y: 122, r: 20 }] },
    planned: "Multigrain roti ×2, dal, bhindi, salad (packed on office days)", planVersion: 2, match: "partly", status: "new", comments: [],
  },
  {
    id: "log-a4", patientId: "p-aditi", slot: "breakfast", eatenAt: L(12, "10:30"), loggedAt: L(12, "10:41"),
    text: "Skipped breakfast — early meeting. Had a chai at 10:30.", source: "Patient app · text only", photo: null,
    planned: "Moong dal chilla ×2", planVersion: 2, match: "skipped", status: "new", comments: [],
  },
  {
    id: "log-a5", patientId: "p-aditi", slot: "dinner", eatenAt: L(11, "20:40"), loggedAt: L(11, "21:05"),
    text: "Egg bhurji, 1 roti and clear soup", source: "Patient app · photo",
    photo: { vessel: "thali", alt: "Steel thali with egg bhurji, a multigrain roti and a katori of clear soup", parts: [{ k: "bhurji", x: 104, y: 74, r: 30 }, { k: "roti", x: 112, y: 120, r: 28 }, { k: "katori", x: 164, y: 92, fill: "soup", r: 21 }] },
    planned: "Egg bhurji + roti, soup, sabzi", planVersion: 2, match: "as-planned", status: "reviewed",
    reviewedBy: { by: "s-meera", at: L(12, "09:15") }, comments: [{ id: "c-a5", by: "s-meera", at: L(12, "09:15"), text: "Great — keep metformin with this meal." }],
  },
  {
    id: "log-a6", patientId: "p-aditi", slot: "dinner", eatenAt: L(10, "21:30"), loggedAt: L(10, "23:10"),
    text: "Pizza at a friend's birthday — 2 slices.", source: "Patient app · text only", photo: null,
    planned: "Egg bhurji + roti, soup, sabzi", planVersion: 2, match: "different", status: "reviewed",
    reviewedBy: { by: "s-meera", at: L(11, "10:02") }, comments: [{ id: "c-a6", by: "s-meera", at: L(11, "10:02"), text: "Completely fine occasionally. Start with a salad next time." }],
  },
  {
    id: "log-k1", patientId: "p-kabir", slot: "dinner", eatenAt: L(12, "21:45"), loggedAt: L(12, "22:05"),
    text: "Late dinner after office — 2 phulka, dal, bhindi", source: "Patient app · photo",
    photo: { vessel: "thali", alt: "Steel thali with two phulkas, a katori of dal and bhindi sabzi", parts: [{ k: "roti", x: 92, y: 84, r: 28 }, { k: "roti", x: 104, y: 112, r: 26 }, { k: "katori", x: 160, y: 72, fill: "dal", r: 20 }, { k: "katori", x: 162, y: 118, fill: "sabzi", r: 19 }] },
    planned: "Phulka, dal, bhindi, soup — by 19:30 on office days", planVersion: 4, match: "partly", status: "new", comments: [],
  },
  {
    id: "log-k2", patientId: "p-kabir", slot: "early", eatenAt: L(13, "06:40"), loggedAt: L(13, "06:52"),
    text: "Lemon water and 5 almonds", source: "Patient app · text only", photo: null,
    planned: "Warm lemon water + soaked almonds & walnuts", planVersion: 4, match: "as-planned", status: "new", comments: [],
  },
  {
    id: "log-i1", patientId: "p-ishita", slot: "midmorning", eatenAt: L(12, "10:50"), loggedAt: L(12, "11:20"),
    text: "Ragi malt and 2 dates in the staff room", source: "Patient app · photo",
    photo: { vessel: "none", alt: "A cup of ragi malt with two dates on the side", parts: [{ k: "cup", x: 108, y: 90, fill: "malt" }, { k: "dates", x: 170, y: 104 }] },
    planned: "Ragi malt + guava", planVersion: 2, match: "partly", status: "new", comments: [],
  },
  {
    id: "log-s2", patientId: "p-sameer", slot: "lunch", eatenAt: L(12, "13:15"), loggedAt: L(12, "13:40"),
    text: "Brown rice, rajma and salad", source: "Patient app · photo",
    photo: { vessel: "plate", alt: "Plate with brown rice, a katori of rajma and kachumber salad", parts: [{ k: "rice", x: 96, y: 96, r: 32 }, { k: "katori", x: 156, y: 78, fill: "rajma", r: 21 }, { k: "salad", x: 150, y: 124, r: 20 }] },
    planned: "Brown rice, rajma, salad, sabzi", planVersion: 2, match: "as-planned", status: "new", comments: [],
  },
  {
    id: "log-s3", patientId: "p-sameer", slot: "breakfast", eatenAt: L(11, "08:10"), loggedAt: L(11, "08:30"),
    text: "Besan chilla with hung curd", source: "Patient app · photo",
    photo: { vessel: "plate", alt: "Plate with two besan chillas and a katori of hung curd", parts: [{ k: "chilla", x: 104, y: 92, r: 32 }, { k: "chilla", x: 118, y: 112, r: 26 }, { k: "katori", x: 166, y: 82, fill: "curd", r: 20 }] },
    planned: "Besan chilla + hung curd", planVersion: 2, match: "as-planned", status: "new", comments: [],
  },
  {
    id: "log-s1", patientId: "p-sameer", slot: "evening", eatenAt: L(7, "17:30"), loggedAt: L(7, "19:02"),
    text: "Samosa ×2 with chai at a family visit", source: "Patient app · photo",
    photo: { vessel: "plate", alt: "Plate with two samosas, green chutney and a cup of chai", parts: [{ k: "samosa", x: 98, y: 98, rot: -12 }, { k: "samosa", x: 132, y: 110, rot: 18 }, { k: "katori", x: 112, y: 62, fill: "chutney", r: 12 }, { k: "cup", x: 186, y: 86, fill: "chai" }] },
    planned: "Buttermilk + roasted chana", planVersion: 2, match: "different", status: "flagged",
    flag: { reason: "Pattern to discuss at review", by: "s-rohan", at: L(9, "10:00") }, comments: [{ id: "c-s1", by: "s-rohan", at: L(9, "10:00"), text: "Third weekend in a row — let's plan visit-day snacks together." }],
  },
];

export const BARRIERS = ["Office canteen options", "Early meetings / time pressure", "Family or social meals", "Cravings", "Travel", "Cost of foods", "Low appetite", "No cooking help"];

/** Plan elements the reviewer checks against (what was followed — not a score). */
export const ADHERENCE_FOCUS: Record<string, string[]> = {
  "p-aditi": ["Breakfast within an hour of waking", "Protein at every main meal", "Packed snacks on office days", "Dinner by 20:30 with metformin", "No sugary drinks"],
  "p-kabir": ["Dinner by 19:30 on office days", "Oil 3 tsp/day", "Coffee 1 cup before noon", "Fruit or salad every day"],
  "p-sameer": ["No alcohol", "Weekend snacks planned ahead", "Whole-grain swaps", "Travel-day breakfast options"],
  "p-ishita": ["Iron tablet away from tea", "Small frequent meals", "Vitamin C with iron-rich meals", "2.5 L fluids"],
};

export const DEFAULT_FOCUS = ["Meals at the planned times", "Portions as agreed", "Protein at main meals", "Planned snacks"];

export interface AdherenceReview {
  id: string;
  patientId: string;
  by: string;
  at: string;
  followed: string[];
  barriers: string[];
  notes: string;
  changes: string;
  nextReview: string;
  source: string;
}

export const PAST_REVIEWS: AdherenceReview[] = [
  {
    id: "rv-aditi-1106", patientId: "p-aditi", by: "s-meera", at: L(6, "12:30"),
    followed: ["Protein at every main meal", "No sugary drinks"], barriers: ["Early meetings / time pressure", "Office canteen options"],
    notes: "Breakfast skipped on both office days.", changes: "Pack roasted chana for office days. Soak chilla batter the night before.", nextReview: "2026-11-20", source: "7 self-reported entries + consultation 6 Nov",
  },
  {
    id: "rv-kabir-1030", patientId: "p-kabir", by: "s-meera", at: "2026-10-30T11:00:00+05:30",
    followed: ["Oil 3 tsp/day", "Coffee 1 cup before noon", "Fruit or salad every day"], barriers: ["Early meetings / time pressure"],
    notes: "Dinner after 21:00 on two office days.", changes: "Eat dinner at the office before the commute on Mon/Wed/Thu.", nextReview: "2026-11-13", source: "11 self-reported entries",
  },
];

/* ------------------------------------------------------------------ follow-up entries (F6) */

/** How closely the patient followed the plan since the last visit — the nutritionist's call, not a score. */
export type Adherence = "good" | "partly" | "poor";
export const ADHERENCE_LABEL: Record<Adherence, string> = { good: "Mostly followed", partly: "Partly followed", poor: "Not followed" };

/**
 * One follow-up entry per visit (spec F6): weight, adherence and notes. Works on every plan —
 * on Core and Clinic it is the only adherence record (food logs are Pro, with the patient app).
 */
export interface FollowUpEntry {
  id: string;
  patientId: string;
  by: string;
  at: string;
  /** kg; null when not weighed at this visit */
  weightKg: number | null;
  adherence: Adherence;
  notes: string;
  /** IST date "YYYY-MM-DD" */
  nextReview: string;
}

export const FOLLOW_UPS: FollowUpEntry[] = [
  { id: "fu-aditi-1106", patientId: "p-aditi", by: "s-meera", at: L(6, "12:30"), weightKg: 68.4, adherence: "partly", notes: "Breakfast skipped on both office days. Agreed: pack roasted chana; soak chilla batter the night before.", nextReview: "2026-11-20" },
  { id: "fu-aditi-1016", patientId: "p-aditi", by: "s-meera", at: "2026-10-16T12:00:00+05:30", weightKg: 69.1, adherence: "partly", notes: "Sweet breakfasts were being skipped; canteen lunches on office days. Plan revised to v2.", nextReview: "2026-11-06" },
  { id: "fu-kabir-1030", patientId: "p-kabir", by: "s-meera", at: "2026-10-30T11:00:00+05:30", weightKg: 74.9, adherence: "good", notes: "Oil and coffee limits kept. Dinner after 21:00 on two office days — eat at the office before the commute.", nextReview: "2026-11-13" },
  { id: "fu-rajesh-1022", patientId: "p-rajesh", by: "s-rohan", at: "2026-10-22T10:00:00+05:30", weightKg: 81.0, adherence: "poor", notes: "Lunch rice portions large; sweetened tea twice a day. Plan revised to v2 with measured portions.", nextReview: "2026-11-13" },
  { id: "fu-sameer-1101", patientId: "p-sameer", by: "s-rohan", at: "2026-11-01T19:00:00+05:30", weightKg: 92.4, adherence: "good", notes: "Down 1.6 kg in 4 weeks. Weekend snacking is the main gap; travel-day breakfasts added in v2.", nextReview: "2026-11-26" },
  { id: "fu-ishita-1109", patientId: "p-ishita", by: "s-meera", at: "2026-11-09T10:40:00+05:30", weightKg: 63.2, adherence: "good", notes: "Nausea improved. Iron tablets taken 6 of 7 days. Small, frequent meals working.", nextReview: "2026-11-23" },
];
