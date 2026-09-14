# Interaction design audit

Reviewed 2026-09-14. Scope: book discovery, hover, opening, reading, dismissal, keyboard access, and mobile behavior. Source review plus live desktop and 390 × 844 browser inspection of books.cynthia.land. Timings below are configured animation/timer values, not a measured end-to-end latency benchmark. The findings below describe the original implementation; the follow-up records the shipped changes.

## Verdict

The postage-stamp presentation has a coherent visual identity; it does not read as a generic template. The interaction anti-pattern is excessive choreography around a simple reading action. The visual treatment can stay while the response becomes much more direct.

Nine findings: one critical, four high, four medium. Prioritize opening responsiveness, hit-area correctness, and keyboard access. No overall numeric score: this was a focused interaction audit, not a complete WCAG or performance certification.

## Critical

### 1. Books cannot be opened with the keyboard

- Location: `components/Canvas.tsx:386–410`.
- Category: accessibility.
- Evidence: clickable `.tile` elements are divs without links, tab stops, or keyboard handlers. Live DOM confirmed no tile links/tab stops; the accessibility tree exposes repeated images rather than navigation controls. `role="application"` supplies no keyboard interaction model.
- Impact: the site's core action is inaccessible to keyboard users. Repeated offscreen copies also clutter the accessibility tree. Relevant criterion: WCAG 2.1.1 Keyboard.
- Recommendation: expose real book links and a logical, nonduplicated keyboard browsing path; bring the focused book into view. Avoid making every repeated canvas copy a tab stop. Remove application semantics unless a complete keyboard model is implemented.
- Suggested skill: `/harden`.

## High

### 2. Opening depends on navigation despite already having the book data

- Location: `components/Canvas.tsx:372–380`, `app/@drawer/(.)book/[slug]/page.tsx:5–14`, `app/page.tsx:9–15`.
- Category: performance / interaction feedback.
- Evidence: click calls `router.push` immediately, with no route prefetch or pending state. The intercepted server route resolves the book before mounting the drawer. The canvas already receives the complete Book objects. A live click returned an intermediate canvas state before the dialog appeared; exact request latency was not measured. Are.na fetches are cached, so this is not evidence of an external API round trip on every click.
- Impact: the user receives no clear confirmation while navigation resolves and can reasonably think the click failed.
- Recommendation: open the reading panel immediately from the selected in-memory book, while preserving URL, direct-link, Back, and Forward behavior. This requires deliberate route/state integration. A smaller alternative is intent prefetch plus immediate pending feedback; it reduces rather than removes dependence on navigation latency.
- Suggested skill: `/optimize`.

### 3. The reading content arrives long after the panel

- Location: `app/globals.css:319`, `app/globals.css:479–510`.
- Category: performance / motion.
- Evidence: the panel enters in 190 ms, but each detail child animates for 460 ms with delays of 90–330 ms. Live computed styles confirmed those values. The title finishes at 610 ms, synopsis at 670 ms, and fifth child at 790 ms after animation start.
- Impact: a mostly arrived drawer continues to look unfinished. Making the panel faster alone will not remove this feeling.
- Recommendation: remove the child stagger and show reading content with the panel. Use a single roughly 160–200 ms panel entrance, with no delayed title or synopsis.
- Suggested skill: `/animate`.

### 4. The enlarged hover book does not own its visible hit area

- Location: `components/Canvas.tsx:342–369`, `components/Canvas.tsx:451–477`, `app/globals.css:232–241`.
- Category: interaction correctness.
- Evidence: hover draws a separate 1.52× overlay with `pointer-events: none`; the original invisible tile remains the click target. Hover leave is still attached to the original tile.
- Impact: moving toward the enlarged edges can dismiss the preview, and clicking that visually apparent area can miss the book. This can feel like lag even when no navigation begins.
- Recommendation: make the visible cover and interactive surface agree. Prefer transforming the actual interactive link, or explicitly manage a matching overlay hit area without hover churn or accidental click-through. Verify edge clicks and drag cancellation.
- Suggested skill: `/harden`.

### 5. Drawer accessibility is incomplete, particularly on mobile

- Location: `components/Drawer.tsx:69–86`, `app/globals.css:397–400`.
- Category: accessibility / responsive interaction.
- Evidence: the dialog declares `aria-modal` but has no focus entry, containment, restoration, or background inertness. Live opening left `document.activeElement` at BODY. At 390 px width, the close button is `display: none`; the remaining 30 px grab region has touch handlers but no button semantics. Scrim click and Escape are implemented.
- Impact: keyboard/screen-reader users do not reliably enter a modal interaction; mobile users lose a discoverable, accessible close control.
- Recommendation: retain an accessible close button at every breakpoint, and use a dialog implementation with focus entry, containment, restoration, and inert background. Keep swipe dismissal as an additional action. Relevant criteria include WCAG 2.1.1 and 2.4.3; this is not a complete conformance determination.
- Suggested skill: `/harden`.

## Medium

### 6. Closing waits 380 ms and is not protected against repeated dismissal

- Location: `components/Drawer.tsx:34–38`, `app/globals.css:312`.
- Category: interaction reliability.
- Evidence: each call to close schedules an independent `router.back()` after 380 ms; the timer is neither tracked nor cancelled. Escape and scrim clicks remain active during exit.
- Impact: every close delays the next selection; repeated close requests risk multiple history traversals. The latter is a source-level risk, not a reproduced history incident.
- Recommendation: make close idempotent, shorten exit to approximately 140–180 ms, and clean up a single completion callback/timer. Verify repeated Escape, repeated scrim clicks, browser Back, and reopening.
- Suggested skill: `/harden`.

### 7. Hover dismissal and drawer blur overlap awkwardly

- Location: `components/Canvas.tsx:325–330`, `components/Canvas.tsx:386–388`, `app/globals.css:68–88`.
- Category: motion / rendering performance.
- Evidence: clearFocus leaves the `focusing` class active until the 280 ms removal timer. The field then takes another 260 ms to clear its filter. Meanwhile drawer opening applies a separate 380 ms, 9 px blur to the whole canvas.
- Impact: hover exit can take about 540 ms for the background to settle, and opening layers two blur transitions. Large filtered stamp layers are a rendering-cost risk; no GPU/frame-time profile was taken.
- Recommendation: separate hover exit state from overlay lifetime, clear hover immediately on selection, and coordinate one background treatment with the panel. Prefer a restrained scrim if profiling shows blur costs.
- Suggested skill: `/animate` or `/optimize`.

### 8. The initial loader imposes artificial waiting

- Location: `components/LoadingScreen.tsx:7–10`, `components/LoadingScreen.tsx:19–41`, `app/globals.css:628`.
- Category: perceived performance.
- Evidence: minimum 1,000 ms loader, waiting for every cover with a 4,500 ms cap, followed by a 620 ms fade. Pointer blocking ends when the fade starts, not when it finishes.
- Impact: even a ready canvas is covered for at least a second. Offscreen cover loading can hold up initial exploration.
- Recommendation: remove the mandatory dwell; reveal when the initial viewport is usable and let other covers load progressively. Only display a loader if loading lasts long enough to need feedback.
- Suggested skill: `/optimize`.

### 9. Reduced motion and magnification are only partially supported

- Location: `app/globals.css:672–689`, `app/layout.tsx:38–44`.
- Category: accessibility.
- Evidence: reduced-motion overrides omit drawer transitions, canvas drawer blur, and loader fade. The JS close timer still waits 380 ms. Viewport configuration requests disabled user scaling.
- Impact: users requesting less motion still receive large panel movement; disabled zoom can hinder reading on browsers that honor it.
- Recommendation: cover all major motion and timer paths with reduced-motion behavior; allow user zoom. Check actual target browsers since viewport zoom restrictions are not uniformly enforced.
- Suggested skill: `/harden`.

## What to preserve

The stamp identity, warm paper palette, and drawer that preserves browsing context work well together. Drag activation already uses a movement threshold and delays pointer capture until a real drag, avoiding a common click-retargeting bug. The 190 ms panel entrance is already suitably short; its delayed contents are the larger problem. Escape dismissal, descriptive cover alt text, and full-page shareable book routes are useful foundations.

## Implementation priority and verification

1. Make selection respond immediately using existing data; remove detail stagger; align visible and clickable cover bounds. Preserve direct URLs and browser history.
2. Add accessible book navigation and modal focus handling; keep mobile Close; make dismissal idempotent.
3. Simplify blur transitions, eliminate forced loader time, and finish reduced-motion/zoom support.

Verify cold and warm first clicks, rapid movement between books, clicks on enlarged edges, click-versus-drag, repeated dismissal, browser Back/Forward, direct links, keyboard-only use, and mobile reading/dismissal. Measure click-to-first-feedback and click-to-readable-content on a production build with ordinary and throttled networking; do not use development compilation time as a production benchmark.


## Implementation follow-up

All nine findings addressed locally on 2026-09-14:

1. Real links, one tab stop per book, focused-book positioning, and no application role. Canvas clipping prevents the browser from scrolling the recycled tile pool on focus.
2. Selection renders the existing book data immediately. Native history preserves the canvas while updating the URL; popstate restores Back/Forward selection.
3. Removed all detail content staggering. The panel alone enters over 260 ms for pointer actions; keyboard entry is immediate.
4. Covers have a 50% dark overlay that clears on hover or keyboard focus. The real link scales to 1.12×; there is no detached hover clone. Pointer activation does not trigger keyboard repositioning.
5. Native modal dialog supplies background inertness and focus containment; focus explicitly restores on unmount. A 44 px Close button remains available on mobile.
6. Pointer dismissal runs a 200 ms exit and waits for actual transition completion, guarded against duplicate calls. Keyboard dismissal is immediate; no history timer remains.
7. Removed hover/background blur choreography in favor of a modal scrim that fades with the sheet.
8. Removed the blocking loader and its unused components. Covers load progressively and report their aspect ratio when loaded.
9. Reduced motion replaces panel movement with a gentle fade, disables link/button transitions, and suppresses pan inertia. Removed viewport zoom restrictions and allowed pinch zoom on the canvas.

Validation: production build including TypeScript passed. Browser checks at desktop and 390 × 844 covered pointer opening, keyboard opening/next book, visible focused-book positioning, modal focus entry/containment/restoration, Back/Forward, repeated Escape, mobile Close, backdrop dismissal, drag without navigation, and refresh into a standalone book page. Mobile dialog content had no horizontal overflow. CSS and source review covered reduced-motion behavior; physical-device pinch/swipe gestures and an OS-level reduced-motion run were not exercised. No measured latency percentile or network-throttled benchmark is claimed.
