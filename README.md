# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## Optional Google AI (Gemini) fallback

The app works without any AI key: it uses a fast offline rule engine, plus a
local semantic search model for paraphrases the rules do not recognise.

You can optionally add a **Google AI Studio** key so Gemini handles cases that
are still too weak for local matching:

1. Create a key at <https://aistudio.google.com/app/apikey>.
2. Open the app, click the gear icon in the top-right, paste the key, and click
   **Save** (or **Test connection** first).
3. The key is stored only in your browser's `localStorage`.

For development you can also create `.env.local`:

```sh
VITE_GOOGLE_AI_API_KEY=your_key_here
VITE_GEMINI_MODEL=gemini-3.8-flash
```

**Important:** this is a client-side app. A key in the browser can be seen by
users, so do not ship a personal key on a public site. A public deployment needs
a backend proxy that holds the key server-side; set `VITE_GEMINI_BASE_URL` to
that proxy. This local build does not include a proxy server, so the browser-key
mode is intended for local use. Google may charge for API usage, and only
weak-match case text is sent to Google.

The local semantic model (`Xenova/bge-small-en-v1.5`) downloads once on first
use and is cached by the browser. Section vectors are precomputed; regenerate
them after editing `src/assets/acts.json` with:

```sh
npm run embeddings
```

### How an answer is produced

1. The offline rule engine runs first. Strong matches never call Google.
2. If the match is weak and a key is saved, Google AI analyses the case. Every
   section it picks is checked against `src/assets/acts.json`; invented sections
   are discarded.
3. If Google AI is not configured or unavailable, local semantic search tries a
   meaning-based match.
4. If that also fails, the app returns the rule-engine answer with a note
   explaining what happened.

The badge in the top-right of the chat says **Google AI**, **Semantic AI**, or
**Offline rules**, so the source of the result is always visible. For local use,
run `start-e-vakil.bat` (or `npm run dev`); nothing is deployed.


## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
