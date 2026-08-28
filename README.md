# Raccoon Notes (working title)

Stage 1: Clerk auth shell — no database yet.

## Run locally

```
npm install
cp .env.example .env
# paste your Clerk Publishable Key into .env
npm run dev
```

You should see a Clerk sign-in screen. After signing in (Clerk lets you sign
up as a normal user straight from that screen too — no separate step needed),
you'll land on a placeholder "signed in" page.

## What's next

- Netlify Database (Postgres) for folders/notes/attachments, each row scoped
  to the signed-in user's Clerk user ID
- Netlify Functions to read/write that data, verifying the Clerk session on
  every request
- Netlify Blobs for photo attachments
- The real folders/notes/editor UI (from the earlier design draft)
