# Candidate 005 Review

## Verdict

Classification:

- `publishable_after_editorial_review`

This is the first production-pipeline candidate that meets the instructional
and executable baseline for the vertical slice. It must remain preserved as
the unedited source candidate. Any narration, timing, or presentation edits
belong in a separate curated authoring copy and must be recorded.

## Production-generation evidence

- Provider/model: local development profile, `gemini-3.6-flash`.
- Model calls: 4.
- Sections: 4.
- Narrated beats: 13.
- Rejected model parts: 0.
- Shared capability: `rectangle_unit_square_array`.
- The generation report records both the learning-coach base revision and the
  SHA-256 digest of the dirty source diff used for this candidate.

## Passed review

### Course structure

- Area meaning, row-column counting, formula and square units, and the
  area-versus-perimeter comparison each have a focused section.
- The progression does not collapse the entire lesson into one section.
- The narration remains concise enough for a first curated pass.

### Mathematical correctness

- A 4 by 3 rectangle is consistently represented as 12 unit squares.
- The formula is derived as `area = length × width` and written as `S = a × b`.
- Length is measured in centimetres and area in square centimetres.
- The worked comparison correctly gives a perimeter of 14 cm and an area of
  12 cm² for the same 4 by 3 rectangle.
- Numeric state does not contradict narration across sections.

### Visual grounding

- The main visual is a real rectangle tiled by equal unit squares.
- Rows, columns, one unit square, the covered interior, and the boundary have
  stable deterministic parts.
- Both dimensions are backed by independent integer controls.
- No polygon-rearrangement or unrelated proof visual is substituted.

### Interaction

- The visible task explicitly asks the learner to set the length to 5 cm.
- Its completion condition checks the same variable and target.
- Moving the control changes the geometry rather than only changing a label.

## Editorial checklist before packaging

1. Play the complete lesson in Octos Learn and confirm that the 8 by 8 maximum
   viewport remains legible on desktop and the physical 4K meeting display.
2. Decide whether to keep all 13 beats or combine one or two repeated setup
   sentences without changing the four teaching goals.
3. Remove any no-op animation that only reasserts an already-current value.
4. Generate and verify the final Xiaohe narration for every retained beat.
5. Create the immutable CoursePack, run offline playback, resume, restart, and
   interaction tests, then record the final OLL digest.

The raw files in this directory must not be overwritten by editorial work.
