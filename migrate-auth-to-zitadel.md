# Migrate frontend auth to Zitadel

## Summary

**Context:** The app uses Next-Auth v5 (Auth.js beta) with two custom `Credentials` providers: one for
email/password (bcrypt, stored in Postgres) and one for anonymous guest sessions. All user data ownership
is gated on `session.user.id` (a UUID assigned at sign-in time).

**Task:** Replace the in-house email/password provider with Zitadel (OIDC) while preserving the guest
session flow and keeping existing chat data accessible to returning users.

**Impact:** Affects every authenticated surface in the app — middleware, API routes, login/register
UI, server actions, DB schema, and session types.

## Where

### Central auth config

<github_code url="https://github.com/rolandgvc/ai-chatbot/blob/256305d19fb82109ab135fb4b3b6b65a77bc2403/app/(auth)/auth.ts#L1-L87" />

```typescript
// Two Credentials providers:
Credentials({                          // email + bcrypt password
  async authorize({ email, password }) { ... }
}),
Credentials({ id: 'guest',            // auto-creates DB user, no credentials
  async authorize() {
    const [guestUser] = await createGuestUser();
    return { ...guestUser, type: 'guest' };
  },
}),
```

### Middleware — guest auto-login

<github_code url="https://github.com/rolandgvc/ai-chatbot/blob/256305d19fb82109ab135fb4b3b6b65a77bc2403/middleware.ts#L1-L50" />

```typescript
// Every unauthenticated request is silently redirected to /api/auth/guest
// which calls signIn('guest') and creates a DB row before returning.
if (!token) {
  return NextResponse.redirect(`/api/auth/guest?redirectUrl=...`);
}
```

### User table

<github_code url="https://github.com/rolandgvc/ai-chatbot/blob/256305d19fb82109ab135fb4b3b6b65a77bc2403/lib/db/schema.ts#L14-L19" />

```typescript
export const user = pgTable('User', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  email: varchar('email', { length: 64 }).notNull(),
  password: varchar('password', { length: 64 }),  // <-- bcrypt hash, null for guests
});
```

### Login / register pages & server actions

<github_code url="https://github.com/rolandgvc/ai-chatbot/blob/256305d19fb82109ab135fb4b3b6b65a77bc2403/app/(auth)/actions.ts#L1-L80" />

Custom forms that call `signIn('credentials', ...)` — these become redundant once
Zitadel handles the credential flow.

## Decision Points

### 1 — Guest sessions

Zitadel only issues tokens for registered identities. The current guest flow (`/api/auth/guest`)
auto-creates a DB row and signs the visitor in silently so they can use the app without registering.

| Option | Description | Trade-off |
|---|---|---|
| **A — Keep Credentials guest provider** | Retain the `id: 'guest'` Credentials provider alongside the new Zitadel OIDC provider. Middleware and guest route stay mostly unchanged. | Two providers in the same NextAuth instance; guest sessions are local JWTs with no Zitadel identity. Simpler. |
| **B — Drop guest sessions** | Remove the guest provider. Unauthenticated users are redirected to Zitadel login immediately. | Simplest long-term; breaks current UX where users try the product before registering. |
| **C — Custom unsigned cookie for guests** | Issue a short-lived anonymous cookie outside NextAuth; promote to a real Zitadel account on register. | Clean separation but requires extra plumbing (cookie helpers, DB guest cleanup). |

**Recommendation: Option A** — least disruption, guest UX preserved, can revisit later.

---

### 2 — User identity mapping

Zitadel's OIDC `sub` claim is an opaque string (e.g. `"182710278082349058"`), not a UUID.
The `User` table currently uses a Postgres-generated UUID as the primary key.

| Option | Description | Trade-off |
|---|---|---|
| **A — Add `zitadelSub` column, keep UUID PK** | New `varchar` column `zitadelId` on `User`. On first Zitadel login, look up by `sub`; if not found, create a row and store `sub`. | Requires a DB migration. Existing users lose their history unless manually linked by email. |
| **B — Use Zitadel sub as PK** | Replace the UUID PK with the Zitadel `sub` string. Requires a full data migration (`ALTER TABLE`, FK updates). | Cleanest long-term but invasive; guest rows still need a separate ID scheme. |
| **C — Map by email (no schema change)** | On Zitadel sign-in, find the local user row by `email`; create if absent. No new column needed. | Works only if Zitadel exposes email and email is unique — which it is for verified accounts. Guest rows (email `guest-{ts}`) are never matched. Zero migration cost. |

**Recommendation: Option C for the initial migration** — no schema change, no data migration, guests are
unaffected. Downside: relies on email uniqueness (currently enforced at app level).

---

### 3 — Fate of login / register pages

With Zitadel, the credential flow happens on the Zitadel-hosted UI (or can be embedded). The custom
`/login` and `/register` pages and their server actions (`login`, `register` in `actions.ts`) would
become wrappers that just redirect to `signIn('zitadel')`.

| Option | Description |
|---|---|
| **A — Keep pages as thin redirectors** | Pages remain; clicking "Sign in" calls `signIn('zitadel', { redirectTo: '/' })`. Existing routes and navigation links stay valid. |
| **B — Remove pages, redirect at middleware** | Middleware sends unauthenticated non-guest routes directly to Zitadel. Less code. |

**Recommendation: Option A for safety** — keeps existing `/login` URLs working; pages can be cleaned
up in a follow-up.

---

## Proposed Implementation

Choosing **Guest: A**, **Identity: C**, **Pages: A**.

### 1. Install Zitadel provider

```bash
# next-auth already bundles ZitadelProvider — no new package needed
# Verify: node_modules/next-auth/providers/zitadel.js
```

### 2. Update `auth.ts`

```typescript
import Zitadel from 'next-auth/providers/zitadel';

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  providers: [
    Zitadel({
      clientId: process.env.AUTH_ZITADEL_CLIENT_ID!,
      clientSecret: process.env.AUTH_ZITADEL_CLIENT_SECRET!,
      issuer: process.env.AUTH_ZITADEL_ISSUER!,
    }),
    // Keep guest provider unchanged
    Credentials({
      id: 'guest',
      credentials: {},
      async authorize() {
        const [guestUser] = await createGuestUser();
        return { ...guestUser, type: 'guest' };
      },
    }),
  ],
  callbacks: {
    async signIn({ user: oidcUser, account }) {
      // For Zitadel sign-ins: find or create the local DB user by email
      if (account?.provider === 'zitadel' && oidcUser.email) {
        const existing = await getUser(oidcUser.email);
        if (existing.length === 0) {
          await createUser(oidcUser.email, generateUUID()); // dummy password
        }
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        // For guest: id comes from DB row
        // For Zitadel: look up local DB user by email to get stable UUID
        if (account?.provider !== 'zitadel') {
          token.id = user.id as string;
          token.type = (user as any).type ?? 'regular';
        } else {
          const [dbUser] = await getUser(user.email!);
          token.id = dbUser.id;
          token.type = 'regular';
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.type = token.type;
      }
      return session;
    },
  },
});
```

### 3. Update `auth.config.ts`

```typescript
export const authConfig = {
  pages: {
    signIn: '/login',
    newUser: '/',
  },
  providers: [],
  callbacks: {},
} satisfies NextAuthConfig;
```

No change needed — `/login` still serves as the sign-in page entry point.

### 4. Update `/login/page.tsx`

Replace the email/password form with a single "Sign in with Zitadel" button:

```tsx
'use client';
import { signIn } from 'next-auth/react';

export default function Page() {
  return (
    <div>
      <button onClick={() => signIn('zitadel', { callbackUrl: '/' })}>
        Sign in
      </button>
    </div>
  );
}
```

Or keep the existing form UI and wire the submit to `signIn('zitadel', ...)` instead
of the `login` server action.

### 5. Remove `/register/page.tsx` and server actions

Registration is now handled by Zitadel. The `/register` page can redirect to `/login`
(or directly call `signIn('zitadel')`). The `login` and `register` server actions in
`actions.ts` can be deleted.

### 6. Add env vars

```bash
# .env.local / Vercel env config
AUTH_ZITADEL_CLIENT_ID=       # Application client ID from Zitadel console
AUTH_ZITADEL_CLIENT_SECRET=   # Client secret
AUTH_ZITADEL_ISSUER=          # e.g. https://YOUR_DOMAIN.zitadel.cloud
```

### 7. Remove dead dependencies (after migration verified)

- `bcrypt-ts` (no longer needed for sign-in)
- `generateHashedPassword` in `lib/db/utils.ts` (still needed for guest passwords — keep)
- `createUser` and `getUser` remain (used in signIn callback)

### 8. Zitadel app configuration

In the Zitadel console, create a **Web** application with:
- Grant type: `Authorization Code`
- PKCE: enabled (recommended) or client secret
- Redirect URI: `{APP_URL}/api/auth/callback/zitadel`
- Post-logout redirect URI: `{APP_URL}`
- Scopes: `openid profile email`

---

## Files to Change

| File | Change |
|---|---|
| `app/(auth)/auth.ts` | Replace Credentials(email/pw) with ZitadelProvider; add `signIn` callback |
| `app/(auth)/auth.config.ts` | No change required |
| `app/(auth)/actions.ts` | Remove `login` and `register` actions (or keep as stubs) |
| `app/(auth)/login/page.tsx` | Replace form with Zitadel redirect button |
| `app/(auth)/register/page.tsx` | Redirect to `/login` or remove |
| `app/(auth)/api/auth/guest/route.ts` | No change (guest flow preserved) |
| `middleware.ts` | No change (guest redirect logic unchanged) |
| `lib/db/schema.ts` | No change (Option C: map by email) |
| `lib/db/queries.ts` | No change |
| `.env.example` | Add `AUTH_ZITADEL_CLIENT_ID`, `AUTH_ZITADEL_CLIENT_SECRET`, `AUTH_ZITADEL_ISSUER` |
| `package.json` | Can remove `bcrypt-ts` after migration (keep temporarily) |

## Open Questions

1. **Existing users**: Users currently registered with email/password will need to create a Zitadel
   account using the same email for their chat history to carry over (Option C relies on email match).
   Is a migration period / notice needed?

2. **Zitadel environment**: Is there an existing Zitadel instance/project, or does one need to be
   provisioned? Self-hosted or Zitadel Cloud?

3. **PKCE vs client secret**: Web apps prefer PKCE. Does the deployment environment support server-side
   secret storage?

4. **Guest-to-Zitadel upgrade flow**: Currently guests see `/register`. After migration, clicking
   "create account" should redirect to Zitadel registration. Is there a preferred flow for promoting
   a guest session to a full account (linking guest chat history)?
