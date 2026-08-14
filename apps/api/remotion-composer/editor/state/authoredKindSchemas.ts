import type { ManifestElement } from "./authoredHitTest";
import type { JSONSchema } from "../SchemaForm";

// Mirrors contracts/authored_manifest.schema.json's $defs — the editable
// per-kind CONTENT fields (x/y/w/h are appended to every kind below since
// those are universal, not kind-specific, per the schema's own top-level
// `element` shape). mountFrame/endFrame are ALSO appended to every kind —
// originally excluded here over desync-risk concerns, but both are already
// committed by the timeline's drag-to-retime (AuthoredTimeline.tsx) and
// confirmed working; these just give the same values numeric-precision
// fields alongside the drag. `isFrameField` (fieldHints.ts) already matches
// `.*Frame$`, so SchemaForm renders them with the same FrameInput widget
// Arm A uses for its own frame fields — no SchemaForm change needed.
//
// Extracted from AuthoredEditor.tsx (Phase 5, phone shell) so
// AuthoredInspectorBody.tsx can share it without a circular import between
// the desktop shell and the inspector content it now also hosts inside a
// PhoneSheet.
export const KIND_SCHEMAS: Record<ManifestElement["kind"], JSONSchema> = {
  text_block: {
    type: "object",
    required: ["text"],
    properties: {
      text: { type: "string", maxLength: 200 },
      color: { type: "string" },
      x: { type: "number" }, y: { type: "number" }, w: { type: "number" }, h: { type: "number" },
      mountFrame: { type: "integer", minimum: 0 }, endFrame: { type: "integer", minimum: 0 },
    },
  },
  stat_card: {
    type: "object",
    required: ["headline", "value"],
    properties: {
      headline: { type: "string", maxLength: 80 },
      value: { type: "string" },
      color: { type: "string" },
      x: { type: "number" }, y: { type: "number" }, w: { type: "number" }, h: { type: "number" },
      mountFrame: { type: "integer", minimum: 0 }, endFrame: { type: "integer", minimum: 0 },
    },
  },
  image_swap: {
    type: "object",
    required: ["src"],
    properties: {
      src: { type: "string" },
      x: { type: "number" }, y: { type: "number" }, w: { type: "number" }, h: { type: "number" },
      mountFrame: { type: "integer", minimum: 0 }, endFrame: { type: "integer", minimum: 0 },
    },
  },
  broll_window: {
    type: "object",
    required: ["src"],
    properties: {
      src: { type: "string" },
      label: { type: "string", maxLength: 60 },
      x: { type: "number" }, y: { type: "number" }, w: { type: "number" }, h: { type: "number" },
      mountFrame: { type: "integer", minimum: 0 }, endFrame: { type: "integer", minimum: 0 },
    },
  },
};

export const KIND_LABEL: Record<ManifestElement["kind"], string> = {
  text_block: "Text block",
  stat_card: "Stat card",
  image_swap: "Image",
  broll_window: "B-roll window",
};

/** Structural/geometry keys every ManifestElement carries that are never
 *  themselves an editable CONTENT field — see the type's own field comments
 *  in authoredHitTest.ts. Used to separate a recovered element's real
 *  content fields (whatever recoverManifest.ts's regex-scan actually found)
 *  from its bookkeeping ones. */
const STRUCTURAL_KEYS = new Set(["id", "kind", "layer", "x", "y", "w", "h", "mountFrame", "endFrame", "recovered"]);

/**
 * A `recovered` element (see state/recoverManifest.ts) was synthesized from
 * ids the scene reads via `overrides?.[id]?.field` but that the server's
 * manifest.json never listed — its x/y/w/h are placeholders, not real
 * geometry, because 0 of 18 real generated scenes read position/size from
 * overrides at all. Strip those fields from the schema entirely rather than
 * show a drag/resize control that would silently do nothing.
 *
 * Its CONTENT fields are ALSO not one of the 4 fixed per-kind shapes below —
 * those assume a server-authored manifest.json using the "text" / "headline"
 * + "value" / "src" + "label" convention non-recovered elements follow. A
 * real scene's recovered card can have any field names at all (confirmed:
 * a 14-field terminal-mockup card with title/subtitle/command/line1-3/
 * node1-4/... none matching any KIND_SCHEMAS shape), so KIND_SCHEMAS'
 * `required: ["text"]` (etc.) failed validation on every one of them even
 * though the fields were genuinely present, just under different names —
 * and none of those real fields ever got an input rendered at all. Build
 * the schema from what recovery actually found on `el` instead of guessing
 * which fixed template it should have been.
 */
export function schemaForElement(el: ManifestElement): JSONSchema {
  if (el.recovered) {
    const properties: Record<string, JSONSchema> = {
      mountFrame: { type: "integer", minimum: 0 },
      endFrame: { type: "integer", minimum: 0 },
    };
    const required: string[] = [];
    for (const key of Object.keys(el)) {
      if (STRUCTURAL_KEYS.has(key)) continue;
      properties[key] = typeof el[key] === "number" ? { type: "number" } : { type: "string", maxLength: 200 };
      required.push(key);
    }
    return { type: "object", required, properties };
  }
  return KIND_SCHEMAS[el.kind];
}

export function contentDefaults(el: ManifestElement): Record<string, unknown> {
  const out: Record<string, unknown> = el.recovered ? {} : { x: el.x, y: el.y, w: el.w, h: el.h };
  const fieldNames = Object.keys(schemaForElement(el).properties || {});
  for (const name of fieldNames) {
    if (!(name in out)) out[name] = el[name];
  }
  return out;
}
