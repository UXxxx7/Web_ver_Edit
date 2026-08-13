/**
 * Shared visual tokens for the xiaojin-editorial composition family.
 * Ported from VeLL-lab/video-studio's `motion/vell-renewal-reminder/src/theme.ts`,
 * generalized to support both color modes documented in that project's
 * CLAUDE-xiaojin-editorial.md (warm/dark), instead of one hardcoded palette.
 */
import { Easing } from "remotion";

export const W = 1080;
export const H = 1920;
export const FPS = 30;

export type ColorMode = "warm" | "dark";

export interface XiaojinPalette {
  bg: string;
  bgDeep: string;
  card: string;
  cardAlt: string;
  ink: string;
  inkSoft: string;
  accent: string;
  accentAlt: string;
  good: string;
  bad: string;
  line: string;
  shadow: string;
  captionBg: string;
  captionText: string;
  captionHighlight: string;
}

// "warm" mode rebrand (2026-08-12): the cream/terracotta identity read as
// earthy/bland and is being replaced in place, not added alongside as a new
// key — every existing caller/default already asks for "warm", so redefining
// its values (not its key) rebrands every video with zero interface changes
// and zero schema/contract updates. New identity: light graph-paper grid
// canvas (bg/bgDeep are multi-layer CSS gradients, not flat colors — a thin
// gray ruled grid over a near-white paper tone, not a solid fill), near-black
// cool-neutral ink instead of warm brown, indigo primary accent instead of
// terracotta, orange kept only as a secondary punch color (accentAlt).
const GRID_LINE = "rgba(20,20,24,0.09)";
const GRID_LINE_DEEP = "rgba(20,20,24,0.14)";
const GRID_CELL = 88;
// Dark mode never got the grid-paper treatment above — it stayed a flat solid
// fill (#0D1117/#090C10), so any section overriding to dark (e.g. SectionLayer's
// `warn` takeovers) visibly broke the brand identity's "everything is grid
// canvas" rule. Same construction, light lines on the dark base instead of
// dark lines on the light one.
const GRID_LINE_ON_DARK = "rgba(255,255,255,0.05)";
const GRID_LINE_ON_DARK_DEEP = "rgba(255,255,255,0.08)";

export const PALETTES: Record<ColorMode, XiaojinPalette> = {
  warm: {
    bg: `linear-gradient(${GRID_LINE} 1px, transparent 1px) 0 0 / ${GRID_CELL}px ${GRID_CELL}px, linear-gradient(90deg, ${GRID_LINE} 1px, transparent 1px) 0 0 / ${GRID_CELL}px ${GRID_CELL}px, #FAFAF8`,
    bgDeep: `linear-gradient(${GRID_LINE_DEEP} 1px, transparent 1px) 0 0 / ${GRID_CELL}px ${GRID_CELL}px, linear-gradient(90deg, ${GRID_LINE_DEEP} 1px, transparent 1px) 0 0 / ${GRID_CELL}px ${GRID_CELL}px, #F0F0EC`,
    card: "#FFFFFF",
    cardAlt: "#F5F5F2",
    ink: "#181A1B",
    inkSoft: "#6B6F76",
    accent: "#4F46E5", // indigo — replaces terracotta as the primary identity color
    accentAlt: "#FF6B35", // vivid orange — secondary punch color only, not dominant
    good: "#4F9D69",
    bad: "#CF5448",
    line: "rgba(20,20,24,0.10)",
    shadow: "rgba(20,20,26,0.18)",
    captionBg: "rgba(0,0,0,0.55)",
    captionText: "#FFFFFF",
    captionHighlight: "#4F46E5",
  },
  dark: {
    bg: `linear-gradient(${GRID_LINE_ON_DARK} 1px, transparent 1px) 0 0 / ${GRID_CELL}px ${GRID_CELL}px, linear-gradient(90deg, ${GRID_LINE_ON_DARK} 1px, transparent 1px) 0 0 / ${GRID_CELL}px ${GRID_CELL}px, #0D1117`,
    bgDeep: `linear-gradient(${GRID_LINE_ON_DARK_DEEP} 1px, transparent 1px) 0 0 / ${GRID_CELL}px ${GRID_CELL}px, linear-gradient(90deg, ${GRID_LINE_ON_DARK_DEEP} 1px, transparent 1px) 0 0 / ${GRID_CELL}px ${GRID_CELL}px, #090C10`,
    card: "#161B22",
    cardAlt: "#1C2129",
    ink: "#F0F2F5",
    inkSoft: "#9AA4B2",
    accent: "#4D9EFF",
    accentAlt: "#7CB8FF",
    good: "#4F9D69",
    bad: "#E0554A",
    line: "rgba(255,255,255,0.10)",
    shadow: "rgba(0,0,0,0.45)",
    captionBg: "transparent",
    captionText: "#4D9EFF",
    captionHighlight: "#7CB8FF",
  },
};

// Pinned chrome zones — these never move, and other elements must respect
// them (see CLAUDE-v2.md's pre-render checklist this ports from).
export const NAV = { h: 88 };
export const COMPLIANCE = { y: 1824, h: 88 };
// Lighter, non-regulatory equivalent of COMPLIANCE — used by BrandBar for
// content that isn't under a disclosure requirement (ported from
// video-studio's chris-quote/iman-watches/retirement-fund theme.ts, which
// all use this exact zone for their BrandBar).
export const BRAND = { y: 1848, h: 64 };
export const PROGRESS = { y: 1912, h: 8 };
export const CAPTION_BOTTOM = 90;

// Apple-style easing — smooth, no overshoot. Used for all card travel.
export const APPLE = Easing.bezier(0.25, 0.1, 0.25, 1.0);

export const RAINBOW =
  "linear-gradient(90deg,#E0552F,#E8A13C,#5FA86B,#4D9EFF,#8C6BD8)";
