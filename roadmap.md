# Seating industry search

## Bar search correction
- [ ] Share expanded bar terms and exact name qualification across candidate retrieval and response paths.
- [ ] Test short names, ambiguous names and unrelated businesses; deploy the search and monitoring functions.
- [ ] Verify a signed-in Bares search in Litoral Sul SC and inspect returned company names, phones, municipalities and duplicates.

## Litoral Sul SC
- [x] Expand lead-search city input to the five requested municipalities without a beach/neighborhood restriction.
- [x] 22 regression tests passed; search-leads deployed; signed-in UI search for Bares in Litoral Sul SC returned 93 leads covering all five municipalities, with every returned address inside the requested region.

- [x] Review excluded candidates: SP search fetched 330 candidates; name qualification, not truncation, explains most exclusions.
- [x] Expand to user-approved furniture and upholstery manufacturers while preserving name-based manufacturing qualification.
- [x] Run 19 regression tests, deploy both functions and verify expanded signed-in SP search: 1,685 leads displayed, all checked against original names, active status and complete phone format; no browser errors.

- [x] Align search and monitoring terms; remove unrelated standalone terms.
- [x] Apply product-plus-manufacturing qualification in normal, city-scan and partial searches, without changing other segments.
- [x] Correct furniture CNAE metadata and prevent broad-code qualification bypass.
- [x] Run 13 regression tests, deploy functions and verify a signed-in SP search: 34 companies, all checked against original names, active status and valid phone format.