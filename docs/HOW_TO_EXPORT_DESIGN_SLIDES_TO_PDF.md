# How to Export Design Slides to PDF

The slide deck is in **`Design_Documents_UnifiedMarket.md`** in Marp format.

## Option 1: Marp CLI (recommended)

```bash
# From project root
npm install -g @marp-team/marp-cli
cd docs
marp Design_Documents_UnifiedMarket.md --pdf -o Design_Documents_UnifiedMarket.pdf
```

If **Mermaid diagrams** do not render in the PDF, install the Mermaid plugin:

```bash
npm install -g @marp-team/marp-cli @marp-team/marpit-mermaid
```

Then in the markdown file, ensure the first line has (or add a front-matter with theme that supports Mermaid if your Marp version requires it). Alternatively, skip Mermaid and use Option 2.

## Option 2: Marp for VS Code

1. Install the **Marp for VS Code** extension.
2. Open `Design_Documents_UnifiedMarket.md`.
3. Use the Marp preview (e.g. "Open Preview to the Side").
4. Export via the Marp icon in the preview toolbar → **Export Slide Deck** → **PDF**.

## Option 3: Copy into Google Slides / PowerPoint

1. Open `Design_Documents_UnifiedMarket.md` in any editor.
2. Each slide is separated by `---`.
3. Copy each section into a new slide in Google Slides or PowerPoint.
4. For **Mermaid diagrams**: go to [mermaid.live](https://mermaid.live), paste the code (the part between \`\`\`mermaid and \`\`\`), export as PNG/SVG, and insert the image into the slide.
5. In Google Slides: **File → Download → PDF document**.

## Before submitting

1. **Fill in Slide 1:** Team member names and emails, supervisor name and email, course/semester.
2. **Export to PDF** and name the file **`Design_Documents_UnifiedMarket.pdf`** (or as your course requires).
3. **Individual time log:** Use the table format on the "Individual Time Log" slide (or the template below) and export your log as a separate PDF. Include it in the **same submission attempt** as the design document.
4. Submit **all PDFs in your latest attempt** (you have 3 attempts; only the latest is graded).

## Time log template (for your own PDF)

You can use this as a starting point and export to PDF (e.g. from Google Docs or Excel):

| Date       | Task description                    | Hours |
|-----------|-------------------------------------|-------|
| YYYY-MM-DD| e.g. Project setup, Supabase auth   | 2.5   |
| YYYY-MM-DD| e.g. Edge Functions, Finnhub API    | 4     |
| …         | …                                   | …     |

**Total hours:** ___
