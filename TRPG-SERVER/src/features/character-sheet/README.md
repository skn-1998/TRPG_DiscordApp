# character-sheet feature

Phase 1 keeps `SheetMaterializerService` as a pure calculation boundary because the current allowed slice does not extend `domains/character` persistence with `sheet`, `computedCache`, or `palette`.

Callers receive `computedCache`, legacy projection, and palette from this feature and remain responsible for persistence until the character domain gains the Phase 2 optimistic-lock update API.
