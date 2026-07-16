# Design QA — conectores do bloco de opções

- Source visual truth: `C:/Users/fabri/AppData/Local/Temp/codex-clipboard-dc83c8b1-7a54-4bcc-a2e2-4722e6b8b0fb.png`
- Implementation screenshot: `C:/Users/fabri/Desktop/Dialogy-apps/Conexão/nexusflow/.artifacts/option-handle-after-full.png`
- Focused comparison: `C:/Users/fabri/Desktop/Dialogy-apps/Conexão/nexusflow/.artifacts/option-handle-comparison.png`
- Viewport: 1920 × 911
- State: authenticated flow editor, option node with five configured options, 100% canvas zoom

## Full-view comparison evidence

The rendered flow was inspected in the authenticated browser session. All five option handles are centered vertically on their corresponding input row. Each handle center coincides with the node's right border, leaving half of the dot inside and half outside. Existing edges remain attached to the center of each handle.

## Focused region comparison evidence

The focused side-by-side comparison isolates the option node from the supplied reference and the updated implementation. It confirms the requested horizontal correction from the padded content boundary to the outer card boundary and the vertical correction from below the row to its exact center.

## Required fidelity surfaces

- Fonts and typography: unchanged; no typography regression introduced.
- Spacing and layout rhythm: option rows retain their spacing; handles now align to each row center and the outer card edge.
- Colors and visual tokens: existing indigo handle and cyan edge tokens preserved.
- Image quality and asset fidelity: no raster or custom visual assets were introduced; browser capture is sharp enough to verify the connector geometry.
- Copy and content: unchanged.

## Findings

No actionable P0, P1, or P2 differences remain for the requested connector alignment.

## Comparison history

- Earlier P1: handles were positioned relative to the padded body, approximately 20 px inside the card edge, and approximately 6 px below the row center.
- Fix: moved each handle into the option row positioning context, centered it with `top-1/2` plus `-translate-y-1/2`, and compensated for the 20 px body padding plus the 6 px handle radius.
- Post-fix evidence: the focused comparison shows all five handles centered on the card border and on their respective rows; connected edges meet the dot centers.

## Primary interactions and console

- Existing option values remained rendered after reload.
- Existing connected edges remained attached.
- No interaction behavior was changed by the positioning-only edit.

final result: passed
