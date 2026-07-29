# Lens: accessibility

## Mission

The touched UI is operable by keyboard and assistive technology, not only by a sighted mouse user.

## Check

- Semantics first: native elements (`button`, `a`, `label`, headings, lists) over `div`/`span` with handlers; ARIA only where semantics cannot express it, and then correct (role, state, name).
- Keyboard: every interaction reachable and operable; visible focus; logical tab order; no traps.
- Focus management: dialogs trap and restore focus; route/content changes move focus sensibly.
- Names and labels: inputs labelled, icon-only buttons named, images with meaningful alt (or empty alt when decorative).
- New colors meet contrast against their backgrounds; state never conveyed by color alone.
- Motion respects `prefers-reduced-motion` where the project handles it.
- Async updates (toasts, validation errors, loading) announced where the project has an announcement pattern.

## Not yours

- Non-UI code — reply `no findings` rather than stretching.
- Visual design taste; copywriting.
- Component conventions written in the docs → `project-standards`.

## Severity guide

`blocking`: a flow in the diff is unusable by keyboard or screen reader, or loses information (unlabelled control, color-only state). `nit`: enhancement beyond the project's current accessibility bar.
