# apps/api — FastAPI + the video pipeline. Needs three separate runtimes in
# one image: Python (the app itself), ffmpeg (every video op handler shells
# out to it), and Node+headless Chrome (remotion-composer/ renders the
# animated-explainer compositions via `npx remotion render`, and the
# apply_style op handler bundles/renders through it too — see
# app/remotion_bundle.py). Debian, not Alpine: Remotion's own Docker guide
# (https://www.remotion.dev/docs/docker) explicitly recommends Debian
# because the packages it needs for headless Chrome are better-tested there.
FROM node:22-bookworm-slim

# System deps: ffmpeg for the pipeline, the rest is Remotion's own documented
# Chrome dependency list (headless Chrome fails to launch without these —
# not obvious from the error messages if they're missing).
# python3 (no version pin) — bookworm ships 3.11, not 3.12; nothing in this
# codebase uses 3.12-only syntax (from __future__ import annotations is used
# throughout specifically for broad-version compatibility).
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 python3-venv python3-pip \
    libnss3 libdbus-1-3 libatk1.0-0 libgbm-dev libasound2 \
    libxrandr2 libxkbcommon-dev libxfixes3 libxcomposite1 libxdamage1 \
    libatk-bridge2.0-0 libpango-1.0-0 libcairo2 libcups2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Python deps first (own layer — changes far less often than app code).
# requirements-optional.txt (whisperx/torch, ~2GB+) is deliberately NOT
# installed: this pipeline degrades gracefully without it (worse caption
# sync, never an error — see that file's own header), and a 2GB Droplet
# doesn't have room for torch anyway.
COPY requirements.txt ./
RUN python3 -m venv /app/.venv \
    && /app/.venv/bin/pip install --no-cache-dir -U pip \
    && /app/.venv/bin/pip install --no-cache-dir -r requirements.txt
ENV PATH="/app/.venv/bin:${PATH}"

# Remotion deps — separate layer, own package.json.
COPY remotion-composer/package.json remotion-composer/package*.json ./remotion-composer/
RUN cd remotion-composer && npm install
# Pre-download headless Chrome at build time (not on the first real render —
# avoids a slow/fragile first request and lets the build itself fail loudly
# if a Chrome dependency is missing, instead of a job failing silently later).
RUN cd remotion-composer && npx remotion browser ensure

COPY . .

EXPOSE 8001
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
