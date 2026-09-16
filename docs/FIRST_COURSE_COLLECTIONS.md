# First Course Collections

**Status:** Approved direction; content production specification

**Locale:** `zh-CN`

This document defines the first two curated course collections for Octos Learn.
It separates a **collection**, which groups related lessons for discovery, from
an immutable **CoursePack**, which contains one independently playable lesson.
The CoursePack v1 archive format remains unchanged.

The curated lessons must remain representative of the normal Octos Learn
generation path. They are reviewed editions of lessons produced by the same
`learning-coach + Gemini -> OLL` pipeline used for live generation, not an
unrelated set of hand-authored showcase programs.

## Product model

```text
Course collection (catalog grouping)
  `-- CoursePack (one lesson, one versioned archive)
        `-- mutable learner instance created by Octos Learn
```

A collection is not downloaded or played as one large archive. Each lesson is
published, cached, embedded in Spotlight builds, resumed, restarted, and
versioned independently. The launcher may present a collection card and then
list its lessons, while older clients may continue to show the individual
CoursePack cards.

## Collection 1: Primary Mathematics — Understanding Area

- **Working ID:** `primary-area-foundations`
- **Chinese title:** `小学数学：理解面积`
- **Audience:** approximately ages 8–9; the exact Chinese grade/semester label
  must be reviewed against the selected local curriculum before publication.
- **Collection outcome:** learners explain area in square units, derive the
  rectangle-area rule from tiling, distinguish area from perimeter, and
  decompose simple compound shapes.

### Lesson sequence

| Order | CoursePack working ID | Chinese title | Main learning outcome |
| --- | --- | --- | --- |
| 1 | `area-what-it-measures` | `面积到底是什么？` | Interpret area as the number of unit squares covering a region without gaps or overlaps. |
| 2 | `rectangle-area-from-tiles` | `长方形的面积为什么等于长 × 宽？` | Connect rows of unit squares to multiplication and derive the rectangle-area rule. |
| 3 | `area-versus-perimeter` | `面积和周长有什么不同？` | Distinguish boundary length from covered region and compare rectangles with equal area or equal perimeter. |
| 4 | `compound-shape-area` | `怎样计算组合图形的面积？` | Decompose rectilinear shapes into non-overlapping rectangles and add their areas. |

### Source-topic mapping

The sequence is adapted from the following Marble Skill Taxonomy v1 topics:

- `mt_6xNmQLzuqm` — Understanding Area
- `mt_y1n0Zwhoca` — Area (age 8+)
- `mt_Jvvh5P06NV` — Area by Tiling
- `mt_WtcFrxGOgw` — Perimeters of polygons
- `mt_eMtV6tBSJm` — Area of compound shapes

The taxonomy is an input to editorial review, not an executable prerequisite
authority. Topic descriptions, evidence, translations, lesson order, and
Chinese curriculum claims must be reviewed by a human before publication.

### First production lesson

`rectangle-area-from-tiles` is the first vertical slice.

It should contain three teaching sections and approximately 8–10 narrated
beats:

1. Establish a unit square and compare covered regions.
2. Tile a rectangle, count rows and columns, and derive `area = length × width`.
3. Let the learner change one side, predict the area, and complete a target-area task.

The approved interaction uses a fixed-height rectangle and a width variable.
The geometry expands as the learner moves a slider. A completion task asks the
learner to reach a specified area. Static math and note cards explain the
current example; the lesson must not pretend that unsupported dynamic text
bindings exist.

## Collection 2: Secondary Mathematics — Linear Functions

- **Working ID:** `secondary-linear-functions`
- **Chinese title:** `初中数学：一次函数与直线图像`
- **Audience:** approximately ages 12–14; market-facing grade labels must be
  checked against the selected curriculum.
- **Collection outcome:** learners connect coordinate pairs, tables, equations,
  and straight-line graphs; interpret slope and intercept; and model a simple
  real-world linear relationship.

### Lesson sequence

| Order | CoursePack working ID | Chinese title | Main learning outcome |
| --- | --- | --- | --- |
| 1 | `coordinates-four-quadrants` | `怎样在四个象限中确定一个点？` | Read and plot positive and negative coordinate pairs. |
| 2 | `formula-table-points` | `怎样从公式得到坐标点？` | Substitute x-values, build a value table, and plot the resulting points. |
| 3 | `linear-function-straight-line` | `为什么一次函数的图像是直线？` | Connect a constant rate of change with collinear coordinate points. |
| 4 | `slope-and-intercept` | `斜率和截距如何改变一条直线？` | Interpret `m` and `b` in `y = mx + b` by changing them and observing the graph. |
| 5 | `plot-linear-graphs` | `怎样根据解析式画出一次函数图像？` | Generate points, plot a line, and calculate slope from two points. |
| 6 | `linear-models-in-context` | `怎样用一次函数描述真实问题？` | Interpret slope and intercept in a simple cost or rate model. |

### Source-topic mapping

The sequence is adapted from the following Marble Skill Taxonomy v1 topics:

- `mt_hVpGOEz2kG` — Coordinates (age 11+)
- `mt_WBdHkc2HTf` — Linear Function Graphs
- `mt_-3udyo6VyB` — Plotting Linear Graphs
- `mt_FspV_imUGK` — Proportion Graphs

### First production lesson

`slope-and-intercept` is the first vertical slice.

It should contain four teaching sections and approximately 10–12 narrated
beats:

1. Recall coordinate axes and introduce `y = mx + b`.
2. Change `m` and observe steepness, direction, and the horizontal case.
3. Change `b` and observe vertical translation and the y-intercept.
4. Complete a line-matching challenge and interpret one real-world example.

The primary composition places the formula, variable controls, and live plot
in one camera-safe region. Two sliders control `m` and `b`; a student task asks
the learner to match a target line or pass through declared points. The lesson
uses only capabilities published by the current OLL runtime.

## Generation parity policy

Each curated lesson begins as a candidate produced by the production lesson
generation pipeline. Directly hand-authoring the final OLL from an empty file
is not the default workflow.

```text
Reviewed lesson brief
        |
        v
Production learning-coach + Gemini generation
        |
        v
OLL validation and complete playback
        |
        v
Classify defects and improve shared systems
        |
        v
Regenerate the candidate
        |
        v
Limited editorial review
        |
        v
Immutable CoursePack release
```

Corrections that can benefit live generation must be made in the shared
system before the curated lesson is edited locally:

| Defect | Preferred correction |
| --- | --- |
| Weak section structure or pedagogy | learning-coach planning prompt or lesson-plan validation |
| Unsupported or inappropriate cards | OLL capability constraints and generation guidance |
| Collisions, excessive whitespace, or poor camera framing | deterministic player layout and camera policy |
| Invalid references or malformed timelines | OLL compiler and validator |
| Repeated factual or explanation errors | generation prompt, grounding, and evaluation |

Editorial changes remain allowed for factual review, Chinese wording,
narration pacing, and showcase-specific timing. Precision interactions that
the live generator cannot yet produce reliably may be added by an editor, but
they must be recorded as curated enhancements and must not be presented as
one-shot live-generation capability.

Every production lesson keeps a repository-only generation report that is not
required at playback time:

```text
generation-report.json
|-- lesson request and reviewed brief
|-- model and generation-pipeline versions
|-- raw candidate digest and location
|-- validation and playback results
|-- shared-system fixes and regeneration attempts
|-- editorial change log
`-- final canonical OLL digest
```

The report distinguishes the quality of the production generator from the
additional value of editorial review. The launcher should label published
packs as curated courses and must not imply that their final reviewed form was
produced in one live request.

## Shared production requirements

Each first-release lesson must:

- be a valid, immutable CoursePack with no account, session, RPC, or temporary URL dependency;
- include local `zh-CN` narration audio for every narrated beat;
- remain fully playable while logged out and offline in a Spotlight build;
- create a separate mutable learner instance for ink and task progress;
- expose at least one meaningful learner interaction, not a decorative slider;
- use deterministic camera targets and avoid fitting unrelated board content;
- keep required cards clear of the toolbar, composer, outline, teacher avatar,
  and camera preview on the 4K meeting display;
- pass desktop, Android-mode, physical-device, resume, restart, and full-playback checks;
- include source attribution and share-alike notices for adapted taxonomy text.

## Attribution baseline

Every published pack adapted from the taxonomy must include an attribution
equivalent to:

> Marble Skill Taxonomy (v1) · © Generative Spark, Inc. (Marble) ·
> https://withmarble.com · database licensed under ODbL 1.0 and textual
> content licensed under CC BY-SA 4.0.

The pack license inventory must separately identify original Octos lesson
content, adapted taxonomy text, narration audio, and any third-party assets.

## Production order

1. Write the reviewed brief and generate `rectangle-area-from-tiles` through
   the production learning-coach and Gemini path.
2. Classify its defects, improve shared generation or playback systems, and
   regenerate until it passes the curated-course baseline.
3. Apply and record the remaining editorial changes, generate narration, and
   validate the immutable pack.
4. Repeat the same process for `slope-and-intercept`.
5. Test both on the physical meeting display and lock approved versions for Spotlight.
6. Add collection metadata to the server catalog and launcher without changing
   the CoursePack v1 archive identity.
7. Produce the remaining lessons only after the two vertical slices pass review.
