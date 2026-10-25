# Quorum

Quorum is a real-time video collaboration app with rooms, WebRTC audio/video, a shared whiteboard, encrypted room messages, and file sharing.

## Requirements

- Node.js compatible with Next.js 16
- PostgreSQL
- An SMTP account to send password-reset emails

## Local setup

1. Install dependencies:

   ```bash
   npm ci
   ```

2. Create a PostgreSQL database and copy `.env.example` to `.env.local`. Set `DATABASE_URL` to the database connection string and `APP_URL` to the app's origin (locally, `http://localhost:3000`).

3. Apply the schema to the configured database:

   ```bash
   npx drizzle-kit push --config drizzle.config.ts
   ```

4. To enable password-reset email, set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM` in `.env.local`.

5. Start the development server:

   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000).

## Checks

```bash
npm run lint
npm run typecheck
npm run build
```

## Deployment notes

- Configure the same environment variables in the hosting provider; never commit `.env.local` or production credentials.
- Use HTTPS in production so browsers can grant camera and microphone access.
- The current WebRTC configuration uses public STUN servers only. For more reliable connections across restrictive networks, configure a TURN service.
- Use a persistent PostgreSQL database and configure a production SMTP provider for account recovery.