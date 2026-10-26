# Setup for the free brainstorming account

Goal: every chat in the free account starts by reading the latest `BRIEF.md` and `STATUS.md` from this public repo, so nothing has to be copied by hand.

## Important: use full links
That account's web tool opens only links that are written out in full. A base address plus file names is refused. So the Project instructions must contain each complete link.

## Steps (about 3 minutes; reuse the existing project if there is one)
1. Open the Project's instructions. If it is a new project, create one first ("SplitEase brainstorm").
2. Replace the instructions with your role text plus the "SOURCES OF TRUTH" block below. Keep the rules about safety, style and wrap-up.
3. Remove old uploaded copies of PLAN.md, CLAUDE.md, AAI-Plan.md, QA.md and any PROJECTKNOWLEDGE.md from the Project's files, so nothing contradicts the repo.
4. Start a new chat, type `refresh`, then ask "What's the build status?". It should answer from the files.

## SOURCES OF TRUTH block
```
Repo (public): github.com/aryantusharr/Expense-Tracker
Open these exact links, in this order, and only what the question needs:
1. https://raw.githubusercontent.com/aryantusharr/Expense-Tracker/redesign/BRIEF.md (shared snapshot. Always.)
2. https://raw.githubusercontent.com/aryantusharr/Expense-Tracker/redesign/STATUS.md (current state. Always at the start of a session.)
3. https://splitease-7bb6c.web.app/version.json (live version)
When relevant:
- https://raw.githubusercontent.com/aryantusharr/Expense-Tracker/redesign/PLAN.md
- https://raw.githubusercontent.com/aryantusharr/Expense-Tracker/redesign/AGENTS.md
- https://raw.githubusercontent.com/aryantusharr/Expense-Tracker/redesign/ARCHITECTURE.md
- https://raw.githubusercontent.com/aryantusharr/Expense-Tracker/redesign/docs/SplitEase-Design-System.md
- https://raw.githubusercontent.com/aryantusharr/Expense-Tracker/redesign/docs/AAI.md
- https://raw.githubusercontent.com/aryantusharr/Expense-Tracker/redesign/package.json
- https://raw.githubusercontent.com/aryantusharr/Expense-Tracker/redesign/firestore.rules
Long history (last entries only, only when digging): https://raw.githubusercontent.com/aryantusharr/Expense-Tracker/redesign/LOG.md
If a doc and the code disagree, say so and trust the code. If a link does not open, tell me straight away. Don't search for the files.
```

## If a link is refused anyway
Paste the two links (BRIEF.md and STATUS.md) as the first message of the chat. Links typed into the chat are always allowed.

## Notes
- The links point at the `redesign` branch. If `main` is brought up to date and `redesign` is retired, replace `redesign` with `main` in every link.
- The brief is public on purpose, so it holds no names, emails, keys or room codes.
- Decisions from a brainstorm come back as a short "Decisions note" (format in `BRIEF.md`), pasted into a build chat.
