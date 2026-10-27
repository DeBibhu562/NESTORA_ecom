# Nestora mock-data prototype (archived)

A frontend-only storefront prototype (mock `data/catalog.ts`, client-side cart, product modal) that was built in `apps/storefront`
before the real API-connected storefront. Moved here, not deleted, so designs can be reused:

- `CartDrawer.tsx`, `context/CartContext.tsx` → reference for **Phase 3** (cart drawer + tier milestones). Needs `lucide-react`.
- `TrackOrderModal.tsx` → reference for order tracking (Phase 5).
- `HeroBanner.tsx`, `MobileBottomNav.tsx`, `CategoryNav.tsx`, `FilterSidebar.tsx`, `ProductModal.tsx` → superseded by the real components in `apps/storefront/src/components`.

Not part of the pnpm workspace, lint, or typecheck.
`NestoraLogo.tsx` and `icon.svg` were kept in `apps/storefront` (brand assets).
