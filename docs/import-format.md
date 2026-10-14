# Import contract

Upload question bank and roster separately. Each file is UTF-8 CSV or an XLSX workbook with exactly one worksheet. The first row contains headers. Plain text/numbers only; formulas, rich text and hyperlink cell objects are rejected. Files are limited to 2 MB and 3,000 data rows; expanded workbooks are checked before parsing.

## Question bank

| Column           | Required | Meaning                                                                          |
| ---------------- | -------- | -------------------------------------------------------------------------------- |
| question_id      | Yes      | Stable question identifier, letters/digits/underscore/dot/hyphen, ≤80 characters |
| topic            | Yes      | Curriculum topic                                                                 |
| prompt           | Yes      | Conversational prompt inviting one insight                                       |
| insight_id       | Yes      | Unique within this question                                                      |
| ideal_insight    | Yes      | One concise source-grounded insight                                              |
| weight           | Yes      | Positive number ≤10                                                              |
| grading_guidance | Yes      | Paraphrases, partial understanding, misconceptions and extensions                |
| source_reference | Yes      | Real supplied source file/page or topic/source reference                         |
| difficulty       | No       | Editorial 1–5 integer, default 3                                                 |

One row per insight. Repeated question fields must match. Maximum 20 insights per question and 600 questions. An exam needs at least three questions; a substantially larger bank is recommended because students are not shown questions they have already seen. The app explicitly reports bank exhaustion instead of quietly repeating questions. Review imports before creating an exam; each exam freezes a copy of bank and roster.

Templates download from the instructor preparation screen in CSV or Excel. public/content-prompt.txt is the reusable external-AI prompt. Synthetic sample files demonstrate format and workflow, not valid course assessment.

## Roster

Required headers: school_email, student_id, display_name. Between 3 and 100 students. Emails and IDs are unique. Keep ID cells as text to preserve leading zeros. Names are the names shown to current tablemates. The system maps roster IDs to opaque per-exam participant IDs before returning table information to student clients. Credentials and other students’ school identifiers are never shown to tablemates.
