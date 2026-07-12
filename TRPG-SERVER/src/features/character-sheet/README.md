# character-sheet feature

Phase 2 keeps calculation and orchestration in this feature while persistence remains owned by the character domain.

- `SheetMaterializerService` validates template-aware values and derives `computedCache`, the canonical five-section projection, and palette entries.
- `CharacterSheetOperationService` owns the OP-1/OP-2 merge, idempotency, materialization, and revision-CAS retry flow before delegating one document update to `CharacterRepository`.
- `CharacterInstantiationService` owns OP-3 and delegates one complete materialized-character insert to `CharacterRepository` only after validation, creation rolls, and materialization succeed.
