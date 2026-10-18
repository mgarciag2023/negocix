# Seating industry search

- [x] Review excluded candidates: SP search fetched 330 candidates; name qualification, not truncation, explains most exclusions.
- [x] Expand to user-approved furniture and upholstery manufacturers while preserving name-based manufacturing qualification.
- [ ] Run regression tests, deploy and verify expanded signed-in SP search.

- [x] Align search and monitoring terms; remove unrelated standalone terms.
- [x] Apply product-plus-manufacturing qualification in normal, city-scan and partial searches, without changing other segments.
- [x] Correct furniture CNAE metadata and prevent broad-code qualification bypass.
- [x] Run 13 regression tests, deploy functions and verify a signed-in SP search: 34 companies, all checked against original names, active status and valid phone format.