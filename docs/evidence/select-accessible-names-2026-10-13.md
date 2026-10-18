# Select Accessible Names: Follow-up

Date: 2026-10-13

This updates the Select call-site count from the 2026-10-12 component audit.

- A TypeScript AST scan of production `src/**/*.tsx` found 50 shared `<Select>` call sites. Test files were excluded.
- All 50 call sites pass an explicit `aria-label` or the shared component's `label` prop: 48 use `aria-label`, 2 use `label`. No call site relies only on the currently selected option text for its accessible name.
- Names describe the field, including chapter, genre, character, calendar, relationship, and writing-setting controls. Table View uses the column name as the control label.
- `src/ui/primitives/select.test.tsx` verifies that the combobox accessible name comes from `aria-label` or `label`, independently of the selected option's display text.

Status: the code-level U06 label gap is closed in the current working tree. Manual screen-reader acceptance and the full page keyboard/accessibility matrix were not run.
