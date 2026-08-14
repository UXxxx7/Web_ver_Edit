// Client-side validation for Arm B overrides — mirrors state/validation.ts's
// shape (ajv, field-level lookup table) but validates the EFFECTIVE
// (contentDefaults + overrides) value per element, not the raw override
// patch. The patch is deliberately partial (only fields a human touched);
// the schema's `required` list is about the authored default, already
// satisfied before any override exists.

import Ajv2020, { type ErrorObject } from "ajv/dist/2020";
import manifestSchema from "../../../contracts/authored_manifest.schema.json";
import type { ManifestElement } from "./authoredHitTest";
import { schemaForElement } from "./authoredKindSchemas";

const ajv = new Ajv2020({ allErrors: true, strict: false });

const defs = (manifestSchema as { $defs: Record<string, object> }).$defs;

const KIND_DEF: Record<ManifestElement["kind"], object> = {
  text_block: defs.textBlockFields,
  stat_card: defs.statCardFields,
  image_swap: defs.imageSwapFields,
  broll_window: defs.brollWindowFields,
};

const kindValidators: Record<ManifestElement["kind"], ReturnType<typeof ajv.compile>> = {
  text_block: ajv.compile(KIND_DEF.text_block),
  stat_card: ajv.compile(KIND_DEF.stat_card),
  image_swap: ajv.compile(KIND_DEF.image_swap),
  broll_window: ajv.compile(KIND_DEF.broll_window),
};

// A recovered element's real content fields are whatever recoverManifest.ts's
// source-scan actually found on it (see authoredKindSchemas.ts's own
// schemaForElement doc comment) — not one of the 4 fixed KIND_DEF shapes
// above, which assume a server-authored manifest.json's "text" / "headline"
// + "value" / "src" convention. Validating a recovered element against the
// wrong fixed shape is exactly what produced "must have required property
// 'text'" on every recovered element regardless of its actual fields (a
// confirmed real bug, 2026-08-14) — reuse the SAME dynamic schema the
// Inspector form already renders from, so what's editable and what's
// validated never disagree. Cached by schema shape (stable per element
// unless its field set changes) so this doesn't recompile an AJV validator
// on every render.
const recoveredValidatorCache = new Map<string, ReturnType<typeof ajv.compile>>();
function validatorFor(el: ManifestElement): ReturnType<typeof ajv.compile> {
  if (!el.recovered) return kindValidators[el.kind];
  const schema = schemaForElement(el);
  const key = JSON.stringify(schema);
  let v = recoveredValidatorCache.get(key);
  if (!v) {
    v = ajv.compile(schema);
    recoveredValidatorCache.set(key, v);
  }
  return v;
}

const NATIVE_W = 1080;
const NATIVE_H = 1920;

export type AuthoredFieldError = {
  id: string;
  /** null for element-level errors (e.g. geometry) not tied to one input. */
  field: string | null;
  message: string;
};

export type AuthoredValidationResult = {
  valid: boolean;
  errors: AuthoredFieldError[];
};

function fieldNameFromError(err: ErrorObject): string | null {
  const parts = (err.instancePath || "").split("/").filter(Boolean);
  if (parts.length > 0) return parts[0];
  if (err.keyword === "required") {
    const missing = (err.params as { missingProperty?: string }).missingProperty;
    if (missing) return missing;
  }
  return null;
}

/**
 * `effectiveValues[id]` must already be `{ ...contentDefaults(el), ...overrides[id] }`
 * — the same merge AuthoredEditor.tsx's Inspector feeds ObjectField's `value`
 * prop, generalized to every element (not just the selected one), so a bad
 * value on an element the user isn't currently looking at still blocks Save.
 */
export function validateAuthored(
  manifest: ManifestElement[],
  effectiveValues: Record<string, Record<string, unknown>>,
  durationInFrames: number
): AuthoredValidationResult {
  const errors: AuthoredFieldError[] = [];

  for (const el of manifest) {
    const value = effectiveValues[el.id] || {};

    const validate = validatorFor(el);
    if (!validate(value)) {
      for (const err of validate.errors || []) {
        errors.push({ id: el.id, field: fieldNameFromError(err), message: err.message || "Invalid value." });
      }
    }

    // Bounds the JSON schema can't express — geometry inside the canvas,
    // and mountFrame/endFrame both sane and within the scene's own runtime.
    const x = Number(value.x ?? el.x);
    const y = Number(value.y ?? el.y);
    const w = Number(value.w ?? el.w);
    const h = Number(value.h ?? el.h);
    if (x < 0 || y < 0 || x + w > NATIVE_W || y + h > NATIVE_H) {
      errors.push({ id: el.id, field: "x", message: `Off-canvas — must fit inside ${NATIVE_W}×${NATIVE_H}.` });
    }

    const mountFrame = Number(value.mountFrame ?? el.mountFrame ?? 0);
    if (mountFrame < 0 || mountFrame > durationInFrames) {
      errors.push({ id: el.id, field: "mountFrame", message: `Must be between 0 and ${durationInFrames}.` });
    }
    const rawEnd = value.endFrame ?? el.endFrame;
    if (rawEnd != null) {
      const endFrame = Number(rawEnd);
      if (endFrame > durationInFrames) {
        errors.push({ id: el.id, field: "endFrame", message: `Must be at most ${durationInFrames}.` });
      }
      if (endFrame <= mountFrame) {
        errors.push({ id: el.id, field: "endFrame", message: "Must be after the start frame." });
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/** Field/item lookup table, same shape as state/validation.ts's errorIndex. */
export function authoredErrorIndex(errors: AuthoredFieldError[]) {
  const byField = new Map<string, string>();
  const byItem = new Set<string>();
  for (const e of errors) {
    byItem.add(e.id);
    if (e.field) {
      const key = `${e.id}/${e.field}`;
      if (!byField.has(key)) byField.set(key, e.message);
    }
  }
  return {
    forField: (id: string, field: string): string | undefined => byField.get(`${id}/${field}`),
    forItem: (id: string): boolean => byItem.has(id),
  };
}
