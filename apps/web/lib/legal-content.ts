// Shared content for /privacy and /terms — plain data, no JSX, so both the
// page components and (if ever needed) a plaintext export can read it.
//
// STATUS: first draft, not lawyer-reviewed. Bracketed placeholders
// ([Company legal name], [Jurisdiction]) need a real answer before this
// site takes real users — everything else is accurate to what the product
// actually does today (checked against apps/api's real integrations, not
// guessed) and should stay that way as features change.
import type { Lang } from "./i18n";

export type LegalSection = { heading: string; body: string[] };
export type LegalDoc = { title: string; updated: string; intro: string; sections: LegalSection[] };

const EFFECTIVE_DATE = "2026-08-13"; // bump this whenever either doc's content changes

export const PRIVACY: Record<Lang, LegalDoc> = {
  en: {
    title: "Privacy Policy",
    updated: `Last updated ${EFFECTIVE_DATE}`,
    intro:
      "This policy explains what OpenMontage Studio (\"we\", \"us\") collects when you use this site, why, and who we share it with. This is an early draft — not yet reviewed by a lawyer — written to accurately describe what the product does today.",
    sections: [
      {
        heading: "What we collect",
        body: [
          "Account info: your email address and password (hashed, never stored in plain text).",
          "Content you upload: videos, photos, and voice samples you submit to generate edited videos, C-roll clips, or voice clones.",
          "Content we generate for you: scripts, shot lists, post captions, and rendered video files.",
          "Profile info you provide: your industry/occupation and any brand-voice notes, used to personalize AI output.",
          "Basic usage data: which pages you visit and which jobs you run, needed to operate and debug the service.",
        ],
      },
      {
        heading: "Third-party services we send data to",
        body: [
          "Uploaded photos, videos, and text are sent to the AI providers that power each feature — this is unavoidable, it's how the feature works:",
          "• Google Gemini — script writing, content ideas, and photo review (including the safety check described below).",
          "• HeyGen — turns a photo into a talking digital-human video (C-roll feature only).",
          "• ElevenLabs — voice cloning and text-to-speech (voice-clone feature only).",
          "• Pexels / Pixabay — stock b-roll footage and background music search (not your content — these only receive search keywords).",
          "• Supabase — hosts our account database and file storage.",
          "We don't sell your data to anyone, and we don't use your uploads to train models beyond what's needed to generate your own output.",
        ],
      },
      {
        heading: "Automated photo safety check",
        body: [
          "Before a C-roll photo is sent to HeyGen, we run an automated check (via the same AI vision service) to screen out photos that shouldn't be used to generate a digital-human video — most importantly, photos where a minor is the main subject. If a photo fails this check, it's rejected before any job is created and never leaves this stage.",
          "This check can fail open (be skipped) if the vision service is temporarily unavailable — HeyGen's own content filter is a second layer in that case. We're telling you this so the check isn't mistaken for a guarantee.",
        ],
      },
      {
        heading: "How long we keep your data",
        body: [
          "Account info is kept until you delete your account. Uploaded and generated media is kept so you can access your job history; you can request deletion of specific jobs or your entire account at any time (see Contact below).",
        ],
      },
      {
        heading: "Your rights",
        body: [
          "You can request a copy of your data, ask us to delete your account and associated content, or correct inaccurate profile info, by contacting us at the address below.",
        ],
      },
      {
        heading: "Children",
        body: [
          "This service is not directed at, and should not be used by, anyone under 18. Do not upload photos, videos, or voice samples of minors for any feature on this site.",
        ],
      },
      {
        heading: "Cookies",
        body: [
          "We use a session cookie to keep you signed in, and a language-preference cookie to remember your 中文/EN choice. We don't use third-party advertising or tracking cookies.",
        ],
      },
      {
        heading: "Security",
        body: [
          "Passwords are hashed, not stored in plain text. Data is transmitted over HTTPS. No system is perfectly secure, and we can't guarantee absolute security.",
        ],
      },
      {
        heading: "Changes to this policy",
        body: ["If this policy changes materially, we'll update the date at the top of this page."],
      },
      {
        heading: "Contact",
        body: ["Questions or data requests: [legal@openmontage.video] — [Company legal name], [Jurisdiction]."],
      },
    ],
  },
  zh: {
    title: "私隱政策",
    updated: `最後更新：${EFFECTIVE_DATE}`,
    intro:
      "本政策說明 OpenMontage Studio（下稱「我們」）在你使用本網站時會收集甚麼資料、原因,以及會分享給誰。這是初稿——尚未經律師審閱——但內容如實描述產品目前的實際運作方式。",
    sections: [
      {
        heading: "我們收集甚麼",
        body: [
          "帳戶資料：你的電郵地址同密碼（經雜湊處理，從不以明文儲存）。",
          "你上載嘅內容：用嚟生成剪輯影片、C-roll 短片或聲音克隆嘅影片、相片、聲音樣本。",
          "我們為你生成嘅內容：劇本、拍攝分鏡、發帖文案，以及成品影片檔案。",
          "你提供嘅個人資料：你嘅行業/職業同品牌語氣設定，用嚟令 AI 產出更貼合你。",
          "基本使用數據：你瀏覽咗邊啲頁面、跑過邊啲任務——維運同排查問題所需。",
        ],
      },
      {
        heading: "我們會將資料傳送畀邊啲第三方服務",
        body: [
          "上載嘅相片、影片、文字會傳送畀支援每項功能嘅 AI 服務商——呢啲功能本身就係咁運作,無法避免：",
          "• Google Gemini —— 寫劇本、發帖文案，以及相片審查（見下面嘅安全檢查一段）。",
          "• HeyGen —— 將相片變成數字人開口講嘢嘅影片（只限 C-roll 功能）。",
          "• ElevenLabs —— 聲音克隆同文字轉語音（只限聲音克隆功能）。",
          "• Pexels / Pixabay —— 搜尋素材片段同背景音樂（唔會收到你嘅內容,只會收到搜尋關鍵字）。",
          "• Supabase —— 託管我哋嘅帳戶資料庫同檔案儲存。",
          "我哋唔會將你嘅資料賣畀任何人，亦唔會用你上載嘅內容去訓練模型（除咗為生成你自己嗰次成品所需）。",
        ],
      },
      {
        heading: "自動相片安全檢查",
        body: [
          "C-roll 相片傳送去 HeyGen 之前，我哋會用同一套 AI 視覺服務做自動檢查，篩走唔應該用嚟生成數字人影片嘅相片——最重要係主體為未成年人嘅相片。相片一旦未能通過檢查，就會喺建立任何任務之前被拒絕，唔會進入下一步。",
          "如果視覺服務暫時唔可用，呢個檢查可能會被跳過（fail-open）——呢種情況下 HeyGen 自己嘅內容過濾器係第二層防線。講呢一點係想你唔好將呢個檢查當成絕對保證。",
        ],
      },
      {
        heading: "資料保留多耐",
        body: [
          "帳戶資料會保留到你刪除帳戶為止。已上載/已生成嘅內容會保留，方便你隨時查返自己嘅任務記錄；你可以隨時要求刪除個別任務或者成個帳戶（見下面「聯絡我們」）。",
        ],
      },
      {
        heading: "你嘅權利",
        body: ["你可以聯絡下面嘅地址，要求索取你嘅資料副本、刪除帳戶及相關內容，或者更正錯誤嘅個人資料。"],
      },
      {
        heading: "未成年人",
        body: ["本服務唔係為未成年人（18歲以下）而設，亦唔應由佢哋使用。請唔好喺本網站任何功能上載涉及未成年人嘅相片、影片或者聲音樣本。"],
      },
      {
        heading: "Cookie",
        body: ["我哋用 session cookie 嚟保持你登入狀態，用語言偏好 cookie 記住你揀嘅 中文/EN。我哋唔會用第三方廣告或者追蹤 cookie。"],
      },
      {
        heading: "資料安全",
        body: ["密碼經雜湊處理，唔會以明文儲存。資料經 HTTPS 傳輸。冇任何系統係絕對安全，我哋唔能夠保證絕對安全。"],
      },
      {
        heading: "政策變更",
        body: ["如果呢份政策有重大變更，我哋會更新本頁頂部嘅日期。"],
      },
      {
        heading: "聯絡我們",
        body: ["查詢或者資料要求：[legal@openmontage.video] —— [公司法定名稱]，[司法管轄區]。"],
      },
    ],
  },
};

export const TERMS: Record<Lang, LegalDoc> = {
  en: {
    title: "Terms of Service",
    updated: `Last updated ${EFFECTIVE_DATE}`,
    intro:
      "These terms govern your use of OpenMontage Studio. This is an early draft — not yet reviewed by a lawyer.",
    sections: [
      {
        heading: "The service",
        body: [
          "OpenMontage Studio lets you generate scripts, content ideas, and edited videos (including AI voice clones and digital-human C-roll clips) from photos, videos, and text you provide.",
        ],
      },
      {
        heading: "Your account",
        body: [
          "You're responsible for the accuracy of the info you provide and for keeping your login credentials secure. You must be 18 or older to create an account.",
        ],
      },
      {
        heading: "Acceptable use — content you upload",
        body: [
          "You may only upload content you have the right to use, and only of yourself or people who've consented (especially for voice cloning and C-roll, which recreate someone's likeness or voice).",
          "You may not upload: content depicting minors in any capacity, sexual or nude content, content that infringes someone else's rights (including likeness/voice rights), or anything illegal.",
          "We run an automated safety check on C-roll photos before they're processed (see Privacy Policy) and may reject or remove content that violates this section, with or without notice.",
        ],
      },
      {
        heading: "Your content, our license to use it",
        body: [
          "You keep ownership of what you upload and what's generated for you. You grant us a license to process, store, and transmit it to the third-party AI services listed in the Privacy Policy, solely to provide the service to you.",
        ],
      },
      {
        heading: "AI-generated output",
        body: [
          "Scripts, captions, and video edits are AI-generated and can be inaccurate, generic, or need revision. Review everything before publishing it — we're not responsible for how you use generated content.",
        ],
      },
      {
        heading: "Availability & fees",
        body: [
          "The service is currently offered [free / in beta — update once pricing is decided]. We may introduce paid plans in the future with advance notice.",
        ],
      },
      {
        heading: "Termination",
        body: [
          "You can stop using the service and delete your account at any time. We may suspend or terminate accounts that violate the acceptable-use section above.",
        ],
      },
      {
        heading: "Disclaimers & limitation of liability",
        body: [
          "The service is provided \"as is\", without warranties of any kind. To the extent permitted by law, we're not liable for indirect, incidental, or consequential damages arising from your use of the service.",
        ],
      },
      {
        heading: "Governing law",
        body: ["These terms are governed by the laws of [Jurisdiction — to be confirmed]."],
      },
      {
        heading: "Changes to these terms",
        body: ["If these terms change materially, we'll update the date at the top of this page."],
      },
      {
        heading: "Contact",
        body: ["Questions: [legal@openmontage.video] — [Company legal name], [Jurisdiction]."],
      },
    ],
  },
  zh: {
    title: "服務條款",
    updated: `最後更新：${EFFECTIVE_DATE}`,
    intro: "本條款規範你使用 OpenMontage Studio 嘅方式。呢份係初稿——尚未經律師審閱。",
    sections: [
      {
        heading: "服務內容",
        body: ["OpenMontage Studio 可以憑你提供嘅相片、影片同文字，生成劇本、內容構思，同埋剪輯完成嘅影片（包括 AI 聲音克隆同數字人 C-roll 短片）。"],
      },
      {
        heading: "你嘅帳戶",
        body: ["你要對自己提供嘅資料準確性負責，亦要保管好自己嘅登入資料。你要年滿18歲先可以開帳戶。"],
      },
      {
        heading: "可接受嘅使用方式——你上載嘅內容",
        body: [
          "你只可以上載你有權使用嘅內容，而且只限於你自己或者已經取得同意嘅人（特別係聲音克隆同 C-roll，呢啲功能會重現某人嘅樣貌或聲音）。",
          "唔可以上載：任何形式涉及未成年人嘅內容、色情或裸露內容、侵犯他人權利（包括肖像權/聲音權）嘅內容，或者任何違法內容。",
          "我哋會喺 C-roll 相片處理之前執行自動安全檢查（見私隱政策），對於違反呢一段嘅內容，我哋可以不經通知拒絕或者移除。",
        ],
      },
      {
        heading: "你嘅內容，我哋使用嘅授權",
        body: ["你上載嘅內容同為你生成嘅成品，擁有權仍然係你嘅。你授權我哋處理、儲存同傳送呢啲內容畀私隱政策入面提到嘅第三方 AI 服務，僅限用嚟為你提供服務。"],
      },
      {
        heading: "AI 生成嘅成品",
        body: ["劇本、字幕、剪輯成品都係 AI 生成，有可能唔準確、太籠統，或者需要修改。發佈之前請自己覆核一次——你點樣使用生成出嚟嘅內容，我哋概不負責。"],
      },
      {
        heading: "服務提供同收費",
        body: ["服務目前係[免費／beta 測試階段——定價確定後更新]提供。日後如果推出收費方案，會提前通知。"],
      },
      {
        heading: "終止服務",
        body: ["你可以隨時停用服務同刪除帳戶。對於違反上面「可接受嘅使用方式」一段嘅帳戶，我哋可以暫停或者終止。"],
      },
      {
        heading: "免責聲明同責任限制",
        body: ["本服務按「現狀」提供，不作任何形式嘅保證。喺法律容許嘅範圍內，我哋對因你使用本服務而產生嘅間接、附帶或者衍生性損失概不負責。"],
      },
      {
        heading: "適用法律",
        body: ["本條款受[司法管轄區——待確認]法律管轄。"],
      },
      {
        heading: "條款變更",
        body: ["如果本條款有重大變更，我哋會更新本頁頂部嘅日期。"],
      },
      {
        heading: "聯絡我們",
        body: ["查詢：[legal@openmontage.video] —— [公司法定名稱]，[司法管轄區]。"],
      },
    ],
  },
};
