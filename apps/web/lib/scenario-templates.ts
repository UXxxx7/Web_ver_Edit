// Personalizes the home dashboard's scenario gallery by the industry the
// user picked at signup (SignupForm.tsx's OCCUPATIONS chips, saved as
// free text into profile.role — see lib/data.ts's Profile type). Was
// collected at signup and then never used anywhere again; this is that
// data's first real payoff.
//
// Each scenario maps to exactly one of the 3 existing brainstorm tools
// (GenerationKind) — no new backend, this only changes what `direction`
// text gets pre-written before firing the same generateContentAction the
// manual ToolBar inputs already call.
import type { GenerationKind } from "./generation-types";
import type { Lang } from "./i18n";

export type IndustryKey = "insurance" | "real_estate" | "beauty" | "fitness" | "financial_planning";

// Mirrors SignupForm.tsx's OCCUPATIONS exactly — both language spellings
// map to the same canonical key, since profile.role stores whatever
// language the chip was clicked in (or free text the user typed instead).
const INDUSTRY_ALIASES: Record<IndustryKey, string[]> = {
  insurance: ["保險", "保险", "insurance"],
  real_estate: ["地產", "地产", "real estate"],
  beauty: ["美容", "beauty"],
  fitness: ["健身", "fitness"],
  financial_planning: ["財務策劃", "财务策划", "financial planning"],
};

export function matchIndustry(role: string): IndustryKey | null {
  const needle = role.trim().toLowerCase();
  if (!needle) return null;
  for (const [key, aliases] of Object.entries(INDUSTRY_ALIASES) as [IndustryKey, string[]][]) {
    if (aliases.some((a) => needle === a.toLowerCase())) return key;
  }
  return null;
}

type Scenario = {
  id: string;
  kind: GenerationKind;
  icon: string;
  color: string; // matches /welcome's STEP_COLORS treatment — icon chip background/foreground, no image asset needed
  title: Record<Lang, string>;
  caption: Record<Lang, string>;
  // One hand-written direction per known industry (concrete, not generic —
  // reads like something a real agent in that industry would actually
  // type), plus a {role} fallback template for custom/unrecognized roles.
  templates: Record<IndustryKey, Record<Lang, string>>;
  fallback: Record<Lang, string>; // {role} placeholder, substituted at render time
};

export const SCENARIOS: Scenario[] = [
  {
    id: "recruiting_pitch",
    kind: "video_script",
    icon: "🎯",
    color: "#3E63FF",
    title: { zh: "招聘話術", en: "Recruiting pitch" },
    caption: { zh: "講清楚點解要入行", en: "Why someone should join you" },
    templates: {
      insurance: {
        zh: "一條招聘影片嘅口播文案，講畀想入保險行業嘅人聽：呢行點賺錢、日常做啲乜、同埋點解而家係好時機入行。誠實啲，唔好淨係吹自由時間彈性。",
        en: "A recruiting video script for people considering the insurance industry — how the income actually works, what a typical day looks like, and why now's a good time to join. Be honest, not just \"flexible hours\" clichés.",
      },
      real_estate: {
        zh: "一條招聘影片嘅口播文案，講畀想入地產行嘅新人聽：頭半年會點、邊度搵客源、公司會點支援新人。唔好齋講「高佣金」，講返實際嘅路徑。",
        en: "A recruiting video script for new real-estate agents — what the first six months actually look like, where leads come from, and how the team supports new hires. Skip the \"high commission\" cliché, focus on the real path.",
      },
      beauty: {
        zh: "一條招聘影片嘅口播文案，畀想入美容行業嘅人：學嘢嘅過程、點樣一步步儲返自己嘅客源、呢行嘅發展空間。想突出「有系統咁教」呢一點。",
        en: "A recruiting video script for people considering a beauty-industry career — the training process, how you build up your own client base, and where it can lead. Emphasize the structured training, not just \"passion for beauty\".",
      },
      fitness: {
        zh: "一條招聘影片嘅口播文案，講畀想做健身教練嘅人聽：考牌流程、頭幾個月點搵學員、教練呢份工實際係點做。想真實啲，唔好淨係講「改變人生」。",
        en: "A recruiting video script for people considering becoming a fitness coach — the certification path, how the first few months of building clients actually go, what the day-to-day work is like. Keep it real, not just \"change lives\" language.",
      },
      financial_planning: {
        zh: "一條招聘影片嘅口播文案，畀想入財務策劃行業嘅人：呢份工實際做啲乜、點考牌、點樣建立自己嘅客戶基礎。想強調專業性同埋長遠發展。",
        en: "A recruiting video script for people considering financial planning as a career — what the job actually involves day to day, the licensing path, and how you build a client base over time. Emphasize the professional, long-term nature of it.",
      },
    },
    fallback: {
      zh: "一條招聘影片嘅口播文案，講畀想入{role}行業嘅人聽：呢行點賺錢、日常做啲乜、點解而家係好時機入行。誠實啲，唔好淨係吹福利。",
      en: "A recruiting video script for people considering a career in {role} — how it actually works day to day, and why now's a good time to join. Be honest, not just generic perks.",
    },
  },
  {
    id: "my_story",
    kind: "video_script",
    icon: "✨",
    color: "#8B5CF6",
    title: { zh: "入行故事", en: "My story" },
    caption: { zh: "個人品牌，講你點解做呢行", en: "Personal branding — why you do this" },
    templates: {
      insurance: {
        zh: "一條個人品牌影片嘅口播文案，講我自己點解入咗保險呢行，同埋而家最有滿足感嘅一單case係點嘅（唔講客戶資料，講心路歷程）。",
        en: "A personal-branding video script about why I got into insurance, and the most fulfilling client story I've had (no identifying details — just the journey).",
      },
      real_estate: {
        zh: "一條個人品牌影片嘅口播文案，講我自己做地產經紀嘅初衷，同埋幫過一個客搵到心水單位嘅過程（唔講客戶資料）。",
        en: "A personal-branding video script about why I became a real-estate agent, and the story of helping a client find the right home (no identifying details).",
      },
      beauty: {
        zh: "一條個人品牌影片嘅口播文案，講我點解揀咗美容呢行，同埋一個令我印象最深嘅客人蛻變故事（唔講客戶資料）。",
        en: "A personal-branding video script about why I chose the beauty industry, and a client transformation story that stuck with me (no identifying details).",
      },
      fitness: {
        zh: "一條個人品牌影片嘅口播文案，講我自己點解做健身教練，同埋一個學員嘅堅持故事點樣激勵到我（唔講學員資料）。",
        en: "A personal-branding video script about why I became a fitness coach, and a client's persistence story that inspired me (no identifying details).",
      },
      financial_planning: {
        zh: "一條個人品牌影片嘅口播文案，講我點解入咗財務策劃行業，同埋一個幫客戶達成財務目標嘅故事（唔講客戶資料）。",
        en: "A personal-branding video script about why I got into financial planning, and a story of helping a client reach a financial goal (no identifying details).",
      },
    },
    fallback: {
      zh: "一條個人品牌影片嘅口播文案，講我點解做{role}呢行，同埋一件令我印象最深嘅工作故事（唔講客戶資料）。",
      en: "A personal-branding video script about why I got into {role}, and a memorable story from the work (no identifying details).",
    },
  },
  {
    id: "client_win",
    kind: "video_script",
    icon: "🏆",
    color: "#22C55E",
    title: { zh: "客戶見證", en: "Client win" },
    caption: { zh: "分享一次成功案例", en: "Share a recent success" },
    templates: {
      insurance: {
        zh: "一條分享成功案例嘅口播文案：講一個客戶點樣因為早買咗合適嘅保障，喺意外/患病時得到實際幫助（唔講真實客戶資料，用泛化情境）。",
        en: "A client-win video script: how a client's timely coverage made a real difference when something unexpected happened — using a generic, non-identifying scenario.",
      },
      real_estate: {
        zh: "一條分享成功案例嘅口播文案：講點樣幫一個客戶喺預算內搵到啱心水嘅單位，仲順利上會（唔講真實客戶資料，用泛化情境）。",
        en: "A client-win video script: how I helped a client find the right home within budget and get through financing smoothly — using a generic, non-identifying scenario.",
      },
      beauty: {
        zh: "一條分享成功案例嘅口播文案：講一個客人嘅蛻變過程，由第一次見面到而家嘅轉變（唔講真實客戶資料，用泛化情境）。",
        en: "A client-win video script: a client's transformation journey from first visit to now — using a generic, non-identifying scenario.",
      },
      fitness: {
        zh: "一條分享成功案例嘅口播文案：講一個學員點樣一步步達成健身目標（唔講真實學員資料，用泛化情境）。",
        en: "A client-win video script: how a client hit their fitness goal step by step — using a generic, non-identifying scenario.",
      },
      financial_planning: {
        zh: "一條分享成功案例嘅口播文案：講一個客戶點樣透過長遠規劃達成財務目標（唔講真實客戶資料，用泛化情境）。",
        en: "A client-win video script: how a client reached a financial goal through long-term planning — using a generic, non-identifying scenario.",
      },
    },
    fallback: {
      zh: "一條分享成功案例嘅口播文案：講一個{role}客戶嘅正面結果（唔講真實客戶資料，用泛化情境）。",
      en: "A client-win video script for {role}: a positive outcome for a client — using a generic, non-identifying scenario.",
    },
  },
  {
    id: "shoot_day",
    kind: "shooting_script",
    icon: "🎬",
    color: "#F59E0B",
    title: { zh: "拍攝清單", en: "Shoot day plan" },
    caption: { zh: "一日內拍得晒嘅分鏡", en: "Shots you can get in one day" },
    templates: {
      insurance: {
        zh: "一個一日之內拍得晒嘅分鏡清單：辦公室日常、同客戶會面（模擬）、寫字樓外景，用嚟做招聘/品牌影片素材。",
        en: "A one-day shot list: office daily life, a simulated client meeting, an exterior office shot — footage for a recruiting/brand video.",
      },
      real_estate: {
        zh: "一個一日之內拍得晒嘅分鏡清單：帶客睇樓（模擬）、辦公室、樓盤外觀，用嚟做地產招聘/品牌影片素材。",
        en: "A one-day shot list: a simulated property viewing, office scenes, building exteriors — footage for a real-estate recruiting/brand video.",
      },
      beauty: {
        zh: "一個一日之內拍得晒嘅分鏡清單：療程過程（模擬）、店舖環境、產品特寫，用嚟做美容品牌影片素材。",
        en: "A one-day shot list: a simulated treatment, salon environment, product close-ups — footage for a beauty brand video.",
      },
      fitness: {
        zh: "一個一日之內拍得晒嘅分鏡清單：訓練過程、健身室環境、教練同學員互動，用嚟做健身品牌影片素材。",
        en: "A one-day shot list: a training session, gym environment, coach-client interaction — footage for a fitness brand video.",
      },
      financial_planning: {
        zh: "一個一日之內拍得晒嘅分鏡清單：辦公室、同客戶做規劃會面（模擬）、寫字樓外景，用嚟做財務策劃品牌影片素材。",
        en: "A one-day shot list: office scenes, a simulated planning meeting, exterior office shots — footage for a financial-planning brand video.",
      },
    },
    fallback: {
      zh: "一個一日之內拍得晒嘅分鏡清單，適合{role}行業嘅招聘/品牌影片素材。",
      en: "A one-day shot list for a recruiting/brand video, suited to the {role} industry.",
    },
  },
  {
    id: "hot_take",
    kind: "content_idea",
    icon: "🔥",
    color: "#EF4444",
    title: { zh: "行業熱點", en: "Industry hot take" },
    caption: { zh: "回應最新政策/趨勢", en: "React to a current trend" },
    templates: {
      insurance: { zh: "一個發帖文案，回應最新嘅自願醫保/保險政策動態，畀客戶睇完覺得有用。", en: "A sample post reacting to a recent insurance policy or industry development — useful and specific for clients reading it." },
      real_estate: { zh: "一個發帖文案，回應最新嘅樓市政策/按揭利率動態，畀客戶睇完覺得有用。", en: "A sample post reacting to a recent property-market policy or mortgage-rate development — useful and specific for clients reading it." },
      beauty: { zh: "一個發帖文案，回應最新嘅美容行業趨勢或者季節性話題。", en: "A sample post reacting to a current beauty-industry trend or seasonal topic." },
      fitness: { zh: "一個發帖文案，回應最新嘅健身趨勢或者常見嘅健身迷思。", en: "A sample post reacting to a current fitness trend or a common fitness myth." },
      financial_planning: { zh: "一個發帖文案，回應最新嘅財經政策或者市場動態，畀客戶睇完覺得有用。", en: "A sample post reacting to a recent financial-policy or market development — useful and specific for clients reading it." },
    },
    fallback: {
      zh: "一個發帖文案，回應{role}行業最新嘅政策或者趨勢動態。",
      en: "A sample post reacting to a recent policy or trend development in {role}.",
    },
  },
  {
    id: "faq",
    kind: "content_idea",
    icon: "💬",
    color: "#06B6D4",
    title: { zh: "常見問題解答", en: "FAQ post" },
    caption: { zh: "解答客戶最常問嘅嘢", en: "Answer what clients ask most" },
    templates: {
      insurance: { zh: "一個發帖文案，解答客戶最常問嘅一條保險問題（例如：「幾時應該開始買保險？」）。", en: "A sample post answering the question clients ask most often (e.g. \"when should I start buying insurance?\")." },
      real_estate: { zh: "一個發帖文案，解答客戶最常問嘅一條買樓問題（例如：「首期要儲幾多先夠？」）。", en: "A sample post answering the question clients ask most often (e.g. \"how much deposit do I actually need?\")." },
      beauty: { zh: "一個發帖文案，解答客戶最常問嘅一條美容問題（例如：「呢個療程要做幾多次先見效？」）。", en: "A sample post answering the question clients ask most often (e.g. \"how many sessions before I see results?\")." },
      fitness: { zh: "一個發帖文案，解答學員最常問嘅一條健身問題（例如：「想瘦身應該做cardio定重訓？」）。", en: "A sample post answering the question clients ask most often (e.g. \"cardio or weights for weight loss?\")." },
      financial_planning: { zh: "一個發帖文案，解答客戶最常問嘅一條理財問題（例如：「幾多歲應該開始儲退休金？」）。", en: "A sample post answering the question clients ask most often (e.g. \"what age should I start saving for retirement?\")." },
    },
    fallback: {
      zh: "一個發帖文案，解答{role}行業客戶最常問嘅一條問題。",
      en: "A sample post answering the question clients in {role} ask most often.",
    },
  },
];

export function scenarioDirection(scenario: Scenario, role: string, lang: Lang): string {
  const industry = matchIndustry(role);
  if (industry) return scenario.templates[industry][lang];
  const trimmedRole = role.trim();
  if (!trimmedRole) return scenario.fallback[lang].replace("{role}", lang === "zh" ? "呢個" : "your");
  return scenario.fallback[lang].replace("{role}", trimmedRole);
}
