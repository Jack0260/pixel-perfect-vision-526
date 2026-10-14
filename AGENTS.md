<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## SOVEREIGN architecture
- Pure domain logic (federation, crypto, contracts, economics, compliance) lives in src/domain with no React imports, so it can be unit-tested and later moved behind server functions unchanged.
- Simulation state lives in one client-side provider (src/lib/grid-store.tsx); every state change also appends to the hash-chained audit log so audit coverage stays complete.
- Every route declares its "Decision:" line and a Subsystem spec (purpose, users, inputs, outputs, failure modes, metrics), as the product brief requires.
- Colours come only from theme tokens in src/styles.css, switched via html[data-theme], so all themes stay consistent.
