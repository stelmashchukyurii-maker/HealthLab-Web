# FLORIVO CHAT — MICROSCOPE / STEP CALIBRATION CHECKPOINT — 2026-09-14

Status: CHECKPOINT / CURRENT WEB STATE
Repo: stelmashchukyurii-maker/HealthLab-Web
Branch: main

## Scope completed in this workstream

### 1. HealthLab microscope tab
- Added a second signed-in Florivo tab represented by microscope icon `🔬` alongside chat `💬`.
- Chat and HealthLab panes switch without replacing the existing chat implementation.
- Composer and attachment preview are hidden while the HealthLab/microscope pane is active.
- HealthLab work is additive-only; existing chat remains available.

### 2. Step calibration UI in microscope pane
Added `Калібровка кроків` with three conceptual areas:
- `WHOOP · загальне` — currently temporary manual WHOOP total input until native/local bridge is connected.
- `Контрольна точка` — manual step count + time, latest entered value, and reserved `AI оцінка` field.
- `WHOOP − контрольна точка` — current difference between WHOOP total and latest manual checkpoint.

Today’s manual checkpoints are shown newest-first (up to 8).

### 3. Current calibration storage
- Browser localStorage key: `florivo-step-calibration-v1`.
- Per Europe/Oslo day record currently contains:
  - `whoop_total`
  - `checkpoints[]`
  - `ai_estimate`
- Checkpoint contains `time`, `steps`, `saved_at`.
- `ai_estimate` is currently not calculated.
- This is temporary browser-local calibration storage; future canonical HealthLab local storage/bridge is a separate task.

### 4. Current-time behavior for manual checkpoint
Changed manual checkpoint time behavior so that when the user starts entering/changing the manual step count, the time field is refreshed to the CURRENT Europe/Oslo time.

Relevant commit:
- `4d203b310795b198810970ad9e7366a0bbd3c547` — current-time refresh logic.

### 5. Small app refresh control
Added small `↻` button in the Florivo top bar for forcing a fresh application reload/check after a new web version.

Initial refresh-button commit:
- `ed5e7a55b180a9df7bacf7e10af210cbfc464aa7`

The handler asks service-worker registrations to update and then reloads the current URL with a timestamp query parameter.

### 6. v0.3.7 cache/version update
After current-time checkpoint change:
- `4ea6822693d0a2c550b7a136046739cdabb2c69f` — service-worker/cache update.
- `4d5de088c849dbefb772435d39dcf7b28549b95c` — UI/version update to v0.3.7.

### 7. Physical UI finding: chat/microscope tabs hidden under top header
Physical phone screenshot on 2026-09-14 showed `💬 / 🔬` partially/fully hidden behind the enlarged sticky top header (Morning control/settings/logout area).

Root cause: `.view-tabs` used a fixed sticky `top` offset while the real topbar height had become larger/dynamic.

Fix: make the tab sticky offset follow the actual current topbar height rather than a stale fixed height.

Relevant commits:
- `54cb9405c8d03bc88433fbf26989abc0196e09d4` — dynamic topbar/tab positioning fix.
- `5c1ab560c6fe3a6201ba988f6462b21c75f589be` — follow-up cache/UI version update to v0.3.8.

Physical re-check after refresh was requested; user responded `Добре`, so the immediate visible issue is treated as user-accepted, but do not infer broader PHYSICAL_PASS for unrelated Florivo/HealthLab functions.

## Current web version
Florivo Chat current checkpoint version after these changes: `v0.3.8`.

## Architecture decisions discussed but NOT implemented here

### Universal HealthLab Bridge
Do NOT create a separate bridge per APK version or per individual metric. Intended future architecture:

`Physical/local data -> Canonical Local HealthLab Store/Repository -> versioned HealthLab Bridge API -> Florivo / charts / AI`

Bridge should use stable canonical metric IDs and remain compatible across Android app versions where possible. Introduce Bridge v2 only for genuinely incompatible contract changes.

Candidate API shape:
- `getCapabilities()`
- `getSnapshot()`
- `queryMetrics(...)` / `getSeries(...)`
- event queries/subscriptions
- device status
- explicit whitelisted device actions

Do not expose arbitrary SQL/table access or arbitrary Android API access to web JS.

### Local database/storage
Preferred direction:
- live canonical DB remains in app-private storage;
- bridge/repository is controlled access layer;
- optional user-visible archive/export/backup can live in a SAF-selected HealthLab folder;
- do not make a publicly shared SQLite DB the live multi-client working database.

### Dense streams
Polar ECG/ACC and other high-frequency data should not be transported as giant JSON payloads. Future bridge should support chunking/streaming/binary-capable transport or native downsampling appropriate to chart resolution.

## Planned Work audit before bridge implementation
A separate ChatGPT Work task is planned to perform full data inventory/evolution audit BEFORE implementing the final bridge.

It should compare evidence-backed original NOOP architecture with CURRENT HealthLab, including current v8.2.13/v8.2.14 development state, and produce:
A. ORIGINAL_NOOP_INVENTORY
B. CURRENT_HEALTHLAB_INVENTORY
C. NOOP_TO_CURRENT_DIFF
D. DATA_LINEAGE_MAP
E. DUPLICATION_AND_FRAGMENTATION_REPORT
F. CANONICAL_DATA_MODEL_PROPOSAL
G. HEALTHLAB_BRIDGE_V1_DRAFT
H. UNKNOWN/MISSING_EVIDENCE_LIST

Planned canonical report path:
`protocols/HEALTHLAB_FULL_DATA_INVENTORY_AUDIT_2026-09-14.md`

Planned machine-readable outputs where practical:
- `control/HEALTHLAB_DATA_INVENTORY_2026-09-14.json`
- `control/HEALTHLAB_DATA_LINEAGE_2026-09-14.json`

Work audit must be READ / INVENTORY / ANALYZE / DESIGN only at that stage: no production DB migration/deletion and no bridge implementation before review.

## Android context received in this conversation
User supplied continuation protocol `HEALTHLAB-NEXT-V8213-V8214-PHYSICAL-DIAGNOSTICS-2026-09-14` for awareness only; it was NOT executed in this chat.

Important context from that protocol:
- repo `stelmashchukyurii-maker/HealthLab`
- working branch `healthlab-v8212-local-data-bridge`
- v8.2.13 and v8.2.14 are under physical phone testing
- v8.2.14 is the current newest candidate in that protocol
- v8.2.6 remains frozen emergency GOLDEN
- v8.2.13/v8.2.14 are not GOLDEN until PHYSICAL_PASS
- v8.2.14 diagnostics button creates a diagnostic ZIP through Android Save/CreateDocument; it does not directly send data to ChatGPT
- Android release archive rule: HealthLab / APP = APK ONLY — NEVER ZIP
- global privacy/security remains `CRITICAL_OPEN`

Do not execute the physical-diagnostics continuation merely because it is recorded here; this section is continuity context only.

## Do not infer
- Do not claim WHOOP total is already auto-read locally; it is still temporary manual input in this web checkpoint.
- Do not claim AI step estimate exists; it is reserved only.
- Do not claim the universal native bridge is implemented.
- Do not claim v8.2.14 is GOLDEN.
- Do not claim global privacy/security is resolved.
- Do not automatically overwrite the CURRENT HealthLab master from this checkpoint without a separate master-update step/decision.
