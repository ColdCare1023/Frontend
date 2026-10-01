# ColdCare frontend visual system

## Product direction

ColdCare is a thermal-supervision instrument for pharmacy teams. The web app keeps operational information dense and easy to scan while sharing the landing page's palette, typography and thermal motifs.

## Tokens

- Primary blue `#0B5CFF`: actions, active navigation and selected data.
- Secondary cyan `#00D1FF`: safe-range arcs and cold-state signals.
- Accent pink `#FF7AA2`: elevated-temperature signals.
- Deep navy `#0F172A`, cool background `#F4F7FB`, white surfaces `#FFFFFF`.
- Inter Variable throughout; tabular numerals for readings and times.
- Shared status tones: normal `#07546A`, warning `#A8385E`, critical `#982C50`, with pale tints and clear text labels.
- Shared radii: controls 10px, cards 12px, dialogs 16px. Motion uses 160/240ms and `cubic-bezier(0.16, 1, 0.3, 1)`.

## Composition

- Full-screen 55/45 authentication layout: photographic pharmacy context and white forms; compact mobile header. Registration includes contact, establishment and password fields with explicit frontend-only demo feedback. Demo roles stay visible on the login screen.
- White 240px navigation with integrated profile, pale blue active route and 56px header.
- Primary dashboard combines actual temperature, reference scale, door and connectivity. Ambient temperature and humidity sit beside the main reading; history and incidents follow.
- Flat compact filter bars; reports and model evaluation use horizontal configuration. Device and user actions live in labeled keyboard-accessible menus.

## Instrument patterns

- Give temperature, 2–8 °C reference range, freshness and connection status first reading priority.
- Use the linear reference scale for measured temperature; reserve the thermal arc for brand artwork; connect actual samples with straight segments in graphs.
- Keep primary temperature summaries distinct from supporting measures. Avoid nesting generic cards and repeated icon tiles.
- Keep the cyan-to-pink thermal arc and blue thermometer in the ColdCare brand mark. Show current temperature with a compact thermometer icon beside the reading; keep Lucide for utility actions and route navigation.
- Preserve real workflow, role access, data meaning and error states. Demo readings remain visibly illustrative.

## Interaction and access

- Keep route navigation, tables, filters and dialogs keyboard-operable. Maintain visible focus and semantic labels.
- Keep data status distinguishable through text and structure as well as color.
- Keep layouts useful from 320px up, with no horizontal page overflow and primary touch targets at least 44px.
- Motion should clarify entry or state changes; reduced-motion settings suppress nonessential animation.
- Keep charts lazy-loaded by route and use the existing localized product copy.
- Keep public account routes synchronous after login click. Protected lazy routes retain the app shell and show content-shaped loading placeholders.

## Product constraints

- This is an academic prototype for pharmacies and boticas in Lima Metropolitana.
- The 2–8 °C bracket is a reference range, not a certification claim.
- Demo mode uses illustrative readings. Never claim clinical validation, guaranteed cold-chain integrity, savings or field results.
- Disconnected devices show their actual connection state; readings are not stored locally for later synchronization.

## Responsive data presentation

- At widths below 640px, users, devices and alerts render labeled rows with visible actions. Dense historical and audit records retain keyboard scroll.
- Show scroll guidance only when the actual table exceeds its region.
- Secondary cards use flat white surfaces. Reserve elevation for primary instruments, dialogs and transient layers.
- A zero incident count uses neutral text; only an existing incident uses a warning tone.
