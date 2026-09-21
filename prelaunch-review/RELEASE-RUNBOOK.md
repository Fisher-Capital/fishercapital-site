# Release runbook - Alberta campaign

Current decision: DO NOT LAUNCH. This is a review package and source candidate, not an activated system.

## Preserve the approved baseline

Use this package revision PB-AB-2026-09-21-R1 and its MANIFEST.sha256. Original website source read at commit 36ef55e497e2e81921bd6e8679394960c22470b8; it was clean and was not edited. Compare the current source with website-source-baseline.json before applying site-changes.patch. The complete website-candidate directory includes supporting assets and review-only routes; it must not be deployed as-is.

## Finalize copy and source

1. Close BROKER-DECISIONS.md and PROCESSING-REGISTER.md. Replace every bracketed identity/privacy fact consistently in ads, form, website, booking, Page and correspondence. Keep Ontario identity and Level 1 service boundaries specific to Ontario.
2. Remove review banners/notes only from the finalized public files, including website-candidate privacy pages. Point the Alberta website booking CTA to the confirmed Alberta event instead of booking-review.html. Remove review-only pages/links from the public build. Retain a copy of the broker-reviewed revision.
3. Finalize the existing /privacy-policy/ page and /alberta-privacy/ notice together. The Meta form currently links to /privacy-policy/; that page must clearly direct Alberta users to the applicable completed notice. Do not deploy a notice claiming an untested workflow is operational.
4. Apply the factual/calculator corrections, homepage Alberta link, privacy changes and disabled-Pixel notice guard. Leave the actual Pixel disabled. Test website links, mobile layouts, calendar, apex/www HTTPS and existing Ontario routes. New Alberta pages contain no chatbot or embedded tracking.

## Complete Meta and lead delivery

5. Make FisherCapital available to the ad account and replace the wrong Page/Instagram identity in the saved ad draft. Check the Page's own terms, business details and billing. Do not accept terms, add payment details or publish merely to remove an error without the account owner's involvement where required.
6. Finalize the saved Alberta form with approved identity/privacy and booking links. Record the final form ID. Attach revised A/B assets and copy, review each actual placement, preserve Housing/Financial products categories and Alberta-only targeting. Keep OFF until steps below pass.
7. Finish saved Make scenario 6355336. It currently has only the recovered Facebook Lead Ads scaffold; it is NOT a complete Zoho integration. Bind the finalized FisherCapital form, map actual returned fields, implement event ledger and human exception handling, and inspect exact Zoho picklists and owner. Use AUTOMATION-BUILD.md. Keep it inactive during preparation; do not touch the active Tally scenario.
8. With a clearly identified authorized test enquiry, verify Meta -> Make -> Zoho -> owner task. Replay the same lead ID: no duplicate record/task. Submit a distinct event for the same contact: preserve the new enquiry and existing progression. Exercise failure after CRM creation, retry, conflicting matches, non-owner/other-province handling, STOP, reply suppression and booking/cancellation time zones. Record results and remove/label test records through the normal recoverable process.
9. Confirm privacy copy now matches actual processing, obtain final broker review of completed assets, reset the start date and confirm the $33/day average media budget and account readiness. Enable intake before ads. Publish only with the user's release instruction.

## Launch observation and rollback

Reconcile submissions against processed lead IDs. Check valid contact details, held relevant conversations, viable applications and spend. Meta may distribute spend unevenly between the ads. If leads fail routing, the wrong identity/location is present, or placeholders appear, pause the Alberta campaign immediately and correct the issue before resuming. Preserve failure evidence without exporting borrower details. To roll back website edits, restore only the changed files from the recorded source revision after checking for newer unrelated work. Do not reset the whole repository or disable the existing Ontario/Tally workflow as a campaign rollback.

## Test record

Case | Expected result | Actual/evidence | Owner/date
---|---|---|---
Permitted lead | Correct owner, all answers, consent/version, attribution, one task | NOT RUN | Pending
Duplicate event | No extra enquiry/task | NOT RUN | Pending
New event/existing contact | New dated note, progression retained | NOT RUN | Pending
Failure/retry | Reconciles exact event; no duplicate creation | NOT RUN | Pending
Scope exception | Human review, no automated loan decision | NOT RUN | Pending
STOP/reply | Appropriate contact suppression and history | NOT RUN | Pending
Booking/cancel/reschedule | Correct time zone and task/stage handling | NOT RUN | Pending
Website/placements | Correct identity, links, crops and privacy | PARTIAL LOCAL CHECKS ONLY | See verification
