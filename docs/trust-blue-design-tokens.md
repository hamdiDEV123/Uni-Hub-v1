# Trust Blue Design Tokens

This file is the single source of truth for the Uni-Hub visual language.

## Color Tokens

- `--background`: App background (`#F8FAFC`)
- `--foreground`: Main text (`#0F172A`)
- `--card`: Surface (`#FFFFFF`)
- `--primary`: Brand trust blue (`#3B82F6`)
- `--secondary`: Neutral soft surface (`#F1F5F9`)
- `--muted`: Low-emphasis surface (`#F1F5F9`)
- `--muted-foreground`: Secondary text (`#64748B`)
- `--accent`: High contrast accent (`#0F172A`)
- `--destructive`: Error (`#EF4444`)
- `--success`: Success (`#22C55E`)
- `--warning`: Warning (`#F59E0B`)
- `--border` / `--input`: Border + form control line (`#E2E8F0`)
- `--ring`: Focus ring (`#3B82F6`)

## Sidebar Tokens

- `--sidebar-background`: `#FFFFFF`
- `--sidebar-foreground`: `#0F172A`
- `--sidebar-primary`: `#3B82F6`
- `--sidebar-accent`: `#F1F5F9`
- `--sidebar-border`: `#E2E8F0`

## Radius Tokens

- `--radius`: `0.75rem`
- `--radius-lg`: `1rem`
- `--radius-xl`: `1.25rem`

## Spacing Tokens

- `--space-1`: `0.25rem`
- `--space-2`: `0.5rem`
- `--space-3`: `0.75rem`
- `--space-4`: `1rem`
- `--space-6`: `1.5rem`
- `--space-8`: `2rem`

## Shadow Tokens

- `--shadow-hard-sm`: `2px 2px 0px hsl(var(--ring))`
- `--shadow-hard`: `4px 4px 0px hsl(var(--ring))`
- `--shadow-hard-lg`: `6px 6px 0px hsl(var(--ring))`
- `--shadow-soft`: `0 10px 30px hsl(var(--primary) / 0.15)`

## Motion Tokens

- `--motion-fast`: `150ms`
- `--motion-base`: `220ms`
- `--motion-slow`: `320ms`

## Tailwind Mappings

`tailwind.config.ts` maps all tokens to utility-friendly names:

- Colors: `bg-primary`, `text-foreground`, `border-border`, `bg-success`, `bg-warning`
- Shadows: `shadow-hard`, `shadow-hard-lg`, `shadow-soft`
- Radius: `rounded-xl`, `rounded-2xl`
- Motion: `duration-fast`, `duration-base`, `duration-slow`

## Usage Rules

1. Always consume brand values via tokens, not hardcoded hex values.
2. Use `primary` only for key actions and active states.
3. Keep surfaces neutral (`background` / `card`) and text high-contrast (`foreground`).
4. Prefer `shadow-hard` for clickable components and `shadow-soft` for depth layering.
5. Keep interactions consistent with motion tokens.

## Color Guardrails (No-Patchwork Policy)

### Forbidden in app/page UI code

- Hardcoded color utilities such as `text-slate-*`, `text-gray-*`, `bg-white`, `border-white`, `text-white`.
- Direct hex/rgb values inside JSX/Tailwind class strings for screens/components.
- One-off gradient/color accents that do not map to the Trust Blue token system.

### Required approach

- Use semantic token utilities only: `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `text-primary`, `bg-success`, `bg-warning`, `bg-destructive`.
- For emphasis states, use token opacity variants (example: `bg-primary/10`, `border-primary/20`) instead of ad-hoc colors.
- Keep visual hierarchy through tokens first, then spacing/radius/shadow.

### Allowed exceptions (intentional)

- `src/components/Logo.tsx`: brand-accurate SVG palette literals are allowed because this file renders the official logo artwork.
- `src/components/ui/chart.tsx`: Recharts selector filters like `stroke='#ccc'` and `stroke='#fff'` are allowed for library-level targeting.

### PR checklist (must pass)

1. No new hardcoded color classes in `src/pages/**` and `src/components/**` (except documented exceptions).
2. New UI surfaces use semantic token classes only.
3. Hover/active/disabled states remain within token palette.
4. `npm.cmd run test -- --run` passes.
5. `npm.cmd run build` succeeds (non-blocking `Browserslist` warning is acceptable).
