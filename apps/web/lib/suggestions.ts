// Clickable example "directions" shown under each brainstorm tool's input,
// so a non-technical user never has to type from a blank box. Matched
// against the free-text profile.role field (see lib/data.ts) by keyword —
// same suggestion set feeds all 3 tools (video script / shot list / content
// idea) since a "direction" is a topic, not a tool-specific instruction.
//
// Prototype data for now: hand-picked per industry. Real version should
// pull this from live search (apps/api's web_search.py already does
// Gemini search-grounding for content_idea) keyed off the same industry
// match, so "what's trending in insurance this week" stays current instead
// of going stale like a hardcoded list would.

export type Suggestion = { label: string; text: string };

const INDUSTRY_SUGGESTIONS: { match: RegExp; suggestions: Suggestion[] }[] = [
  {
    match: /保險|insurance/i,
    suggestions: [
      { label: "20% 稅務新聞", text: "傳聞話內地客戶嚟香港買保險要加徵20%稅，點樣同客戶解答先啱？" },
      { label: "分紅 vs 保證回報", text: "分紅實現率同保證回報有咩分別？一分鐘同客戶講清楚" },
      { label: "經紀日常", text: "分享我做保險經紀嘅一日，點解呢行啱新人入行" },
      { label: "理賠常見問題", text: "客戶最常問：香港保單身故理賠要幾耐先批到錢？" },
    ],
  },
];

const DEFAULT_SUGGESTIONS: Suggestion[] = [
  { label: "客戶好評", text: "分享一個真實客戶好評 / 成功故事" },
  { label: "招聘計劃", text: "介紹公司最新招聘計劃，吸引新人加入" },
  { label: "常見問題", text: "解答返客戶最常問嘅一條問題" },
  { label: "最新優惠", text: "宣傳緊嘅優惠或者活動，一條片講清楚" },
];

export function getSuggestions(role: string): Suggestion[] {
  const found = INDUSTRY_SUGGESTIONS.find((entry) => entry.match.test(role));
  return found ? found.suggestions : DEFAULT_SUGGESTIONS;
}
