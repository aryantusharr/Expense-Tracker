# One-time setup for the free brainstorming account

Goal: every chat in the free account starts by reading the latest `BRIEF.md` from this public repo, so nothing has to be copied by hand.

## Steps (about 3 minutes, once)
1. In the free Claude account, create a Project called "SplitEase brainstorm".
2. Open the Project's instructions and paste the block below.
3. Start a new chat in that Project. Type `refresh`, then ask: "What's the build status?". If it answers from the brief (v3.0.0 live, etc.), you're done.
4. If it says it cannot open links, use the fallback below.

## Instruction block to paste
```
You are my brainstorming partner for SplitEase, a mobile expense-splitting web app.
At the start of every chat, open this link and read it fully before you reply:
https://raw.githubusercontent.com/aryantusharr/Expense-Tracker/redesign/BRIEF.md
Treat it as the latest state of the app and the rules for working with me.
If I type "refresh", open the link again and use the new version.
If you cannot open links, say so straight away and ask me to paste the brief.
Keep replies short, give 2-4 options with a recommendation, and when I say "wrap up" write a Decisions note in the format given in the brief.
```

## Fallback if links don't open
- Download `BRIEF.md` from the repo and add it to the Project's knowledge. If the Project offers "Add from GitHub", choose `BRIEF.md` only (never the whole repo) and press Sync whenever the build account says "brief changed".
- Otherwise paste the brief's text at the start of a chat.

## Notes
- The link points at the `redesign` branch. If that branch is merged and deleted, change `redesign` to `main` in the instruction block.
- The brief is public on purpose, so it holds no names, emails, keys or room codes.
