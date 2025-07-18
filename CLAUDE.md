# AI Chatbot Template

AI Chatbot is a full-stack Next.js AI chatbot template (Chat SDK v3.1.0) that provides a modern, production-ready chatbot experience with AI integration, authentication, and advanced artifact handling. Built with Next.js 15, React 19 RC, and AI SDK v5 Beta, it offers real-time streaming conversations, document generation, multi-user support, and comprehensive artifact creation capabilities.

## Project Structure

```
ai-chatbot/
├── app/                             # Next.js App Router structure
│   ├── (auth)/                     # Authentication route group
│   │   ├── api/auth/               # NextAuth.js API routes
│   │   │   ├── [...nextauth]/     # NextAuth.js handler
│   │   │   └── guest/             # Guest user endpoint
│   │   ├── login/                 # Login page
│   │   ├── register/              # Registration page
│   │   ├── actions.ts             # Auth server actions
│   │   ├── auth.config.ts         # NextAuth configuration
│   │   └── auth.ts                # NextAuth setup
│   ├── (chat)/                    # Chat application route group
│   │   ├── api/                   # Chat API endpoints
│   │   │   ├── chat/              # Chat streaming endpoints
│   │   │   ├── document/          # Document CRUD operations
│   │   │   ├── files/             # File upload handling
│   │   │   ├── history/           # Chat history API
│   │   │   ├── suggestions/       # AI suggestions API
│   │   │   └── vote/              # Message voting API
│   │   ├── chat/[id]/             # Individual chat pages
│   │   ├── actions.ts             # Chat server actions
│   │   ├── layout.tsx             # Chat layout with sidebar
│   │   └── page.tsx               # Chat homepage
│   ├── layout.tsx                 # Root layout
│   └── globals.css                # Global styles
├── components/                      # React components
│   ├── ui/                        # shadcn/ui components
│   │   ├── button.tsx             # Button component
│   │   ├── card.tsx               # Card component
│   │   ├── dropdown-menu.tsx      # Dropdown menu
│   │   ├── input.tsx              # Input component
│   │   ├── sidebar.tsx            # Sidebar component
│   │   └── ...                    # Other UI components
│   ├── app-sidebar.tsx            # Application sidebar
│   ├── artifact.tsx               # Artifact renderer
│   ├── chat.tsx                   # Main chat component
│   ├── chat-header.tsx            # Chat header
│   ├── message.tsx                # Message component
│   ├── multimodal-input.tsx       # Input with file upload
│   ├── visibility-selector.tsx    # Chat visibility controls
│   └── ...                        # Other feature components
├── lib/                            # Shared libraries and utilities
│   ├── ai/                        # AI integration
│   │   ├── models.ts              # AI model configurations
│   │   ├── providers.ts           # AI provider setup
│   │   ├── prompts.ts             # System prompts
│   │   ├── entitlements.ts        # User entitlements
│   │   └── tools/                 # AI tools and functions
│   ├── db/                        # Database layer
│   │   ├── schema.ts              # Drizzle ORM schema
│   │   ├── queries.ts             # Database queries
│   │   ├── migrate.ts             # Migration runner
│   │   └── utils.ts               # Database utilities
│   ├── editor/                    # Rich text editor
│   │   ├── config.ts              # ProseMirror config
│   │   ├── functions.tsx          # Editor functions
│   │   └── suggestions.tsx        # Suggestion system
│   ├── constants.ts               # Application constants
│   ├── types.ts                   # Shared TypeScript types
│   └── utils.ts                   # Utility functions
├── hooks/                          # Custom React hooks
│   ├── use-artifact.ts            # Artifact state management
│   ├── use-chat-visibility.ts     # Chat visibility controls
│   ├── use-messages.tsx           # Message handling
│   └── use-scroll-to-bottom.tsx   # Auto-scroll functionality
├── artifacts/                      # Artifact handling components
│   ├── code/                      # Code artifacts
│   ├── image/                     # Image artifacts
│   ├── sheet/                     # Spreadsheet artifacts
│   └── text/                      # Text artifacts
├── tests/                          # Test files
│   ├── e2e/                       # End-to-end tests
│   ├── routes/                    # API route tests
│   ├── pages/                     # Page Object Model
│   ├── prompts/                   # Test prompts and data
│   ├── fixtures.ts                # Test fixtures
│   └── helpers.ts                 # Test utilities
├── .env.example                    # Environment variables template
├── .github/workflows/              # GitHub Actions workflows
├── .gitignore                      # Git ignore rules
├── biome.jsonc                     # Biome configuration
├── components.json                 # shadcn/ui configuration
├── drizzle.config.ts              # Database configuration
├── middleware.ts                   # Next.js middleware
├── next.config.ts                 # Next.js configuration
├── package.json                   # Project dependencies
├── playwright.config.ts           # Playwright configuration
├── postcss.config.mjs             # PostCSS configuration
├── tailwind.config.ts             # Tailwind CSS configuration
└── tsconfig.json                  # TypeScript configuration
```

## Build & Commands

- Start development server: `pnpm dev` (with Turbo mode enabled)
- Build for production: `pnpm build` (runs database migration then Next.js build)
- Start production server: `pnpm start`
- Run tests: `pnpm test` (Playwright E2E tests)
- Lint code: `pnpm lint` (ESLint + Biome)
- Fix linting issues: `pnpm lint:fix` (ESLint + Biome with auto-fix)
- Format code: `pnpm format` (Biome formatter)

### Database Commands

- Generate migrations: `pnpm db:generate` (Drizzle Kit)
- Run migrations: `pnpm db:migrate` (tsx migration runner)
- Open database studio: `pnpm db:studio` (Drizzle Studio)
- Push schema changes: `pnpm db:push` (direct schema push)
- Pull schema: `pnpm db:pull` (reverse engineer schema)
- Check schema: `pnpm db:check` (validate migrations)
- Update database: `pnpm db:up` (update to latest)

### Development Environment

- Development server: http://localhost:3000 (with hot reload and Turbo mode)
- Database studio: Available via `pnpm db:studio`
- Test server: Automatically starts on port 3000 for Playwright tests
- Package manager: pnpm v9.12.3
- Node.js: Compatible with latest LTS versions

## Code Style

- TypeScript: Strict mode with ESNext target, isolatedModules, resolveJsonModule
- Formatting: Biome v1.9.4 (2 spaces, 80 character limit, single quotes for JS/TS, double quotes for JSX)
- Linting: Biome + ESLint with Next.js config, accessibility rules enabled
- Semicolons: Always required
- Trailing commas: Always used (except in JSON)
- Line endings: LF (Unix-style)
- Arrow function parentheses: Always
- Bracket spacing: Enabled

### Naming Conventions
- Components: PascalCase (e.g., `ChatHeader`, `MultimodalInput`)
- Files: kebab-case (e.g., `chat-header.tsx`, `use-messages.tsx`)
- Hooks: `use-` prefix with kebab-case (e.g., `use-artifact.ts`)
- Functions: camelCase (e.g., `generateUUID`, `fetchWithErrorHandlers`)
- Constants: SCREAMING_SNAKE_CASE (e.g., `DUMMY_PASSWORD`)
- Types/Interfaces: PascalCase (e.g., `ChatMessage`, `CustomUIDataTypes`)
- CSS Variables: kebab-case with -- prefix (e.g., `--background`, `--foreground`)

### Import Organization
1. External libraries first (React, Next.js, third-party)
2. Internal imports with @/ alias (using path mapping)
3. Relative imports (local files)
4. Type imports explicitly marked with `type` keyword

### Code Patterns
- NEVER use `@ts-expect-error` or `@ts-ignore` to suppress type errors
- Use functional components with hooks (no class components)
- Prefer named exports over default exports (except for pages and configs)
- Use destructuring in function parameters
- Early returns for conditional rendering
- Fragment syntax (`<>`) preferred over `<React.Fragment>`

## Testing

- Playwright v1.50.1 for end-to-end testing
- Custom fixtures for multi-user authentication scenarios (adaContext, babbageContext, curieContext)
- Page Object Model for maintainable test organization
- AI model mocking using MockLanguageModelV2 from AI SDK
- Test files: `*.test.ts`
- Test organization: `/tests/e2e/` for UI tests, `/tests/routes/` for API tests
- Parallel test execution with 8 workers locally, 2 on CI
- Automatic web server startup for tests
- Test timeout: 240 seconds for both test and expect
- HTML reporter for test results
- Trace retention on failure for debugging

### Test Structure
- `/tests/e2e/`: End-to-end tests (chat, artifacts, authentication, reasoning)
- `/tests/routes/`: API route tests (chat endpoints, document operations)
- `/tests/pages/`: Page Object Model classes (ChatPage, AuthPage, ArtifactPage)
- `/tests/prompts/`: Test data and mock response patterns
- `/tests/fixtures.ts`: Custom test fixtures and setup
- `/tests/helpers.ts`: Test utility functions

### Test Patterns
- Worker-scoped fixtures for session management
- Multi-user testing with different privilege levels
- Resource ownership verification
- Authentication flow testing
- AI model response mocking
- File upload and multimodal input testing

## Architecture

- Framework: Next.js 15 with App Router and experimental Partial Prerendering (PPR)
- Frontend: React 19 RC with TypeScript strict mode
- AI Integration: AI SDK v5 Beta with xAI (Grok) as default provider, supports OpenAI, Anthropic, and others
- Database: PostgreSQL (Neon Serverless) with Drizzle ORM
- Authentication: NextAuth.js v5 Beta with credentials provider and guest mode support
- Styling: Tailwind CSS with shadcn/ui components built on Radix UI primitives
- State Management: React hooks + SWR for server state + Zustand for artifact visibility
- Build Tool: Next.js with Turbo mode enabled
- Package Manager: pnpm v9.12.3
- Testing: Playwright for E2E testing with AI model mocking
- File Storage: Vercel Blob for attachments (5MB limit, JPEG/PNG only)
- Editor: ProseMirror for rich text editing, CodeMirror for code editing
- Animation: Framer Motion for UI animations
- Icons: Lucide React icon library
- Observability: OpenTelemetry for monitoring and tracing

### Special Features
- **Artifacts System**: Dynamic content generation for code, images, sheets, and text
- **Real-time Streaming**: Server-Sent Events for AI responses
- **Resumable Streams**: Redis-backed stream resumption (optional)
- **Multi-user Support**: Guest users (20 messages/day) and regular users (100 messages/day)
- **Advanced Editor**: Diff viewing, suggestions system, and collaborative editing
- **File Upload**: Drag-and-drop file uploads with preview
- **Visibility Controls**: Public/private chat management
- **Version Management**: Document versioning with timestamp tracking

## Security

- Environment variables for sensitive data (AUTH_SECRET, XAI_API_KEY, POSTGRES_URL, etc.)
- Password hashing using bcrypt-ts with salt rounds of 10
- Timing attack protection by comparing against dummy passwords
- Guest user system with temporary sessions and JWT tokens
- Input validation using Zod schemas with strict constraints
- NextAuth.js v5 session management with secure cookie handling
- Resource ownership verification for all operations
- Rate limiting: 20 messages/day for guests, 100 messages/day for regular users
- File upload validation (5MB limit, JPEG/PNG only)
- UUID validation for all identifiers
- Prepared statements with Drizzle ORM (prevents SQL injection)
- Server-only imports for database operations
- Proper error handling without exposing sensitive information
- No hardcoded secrets in repository
- Environment-specific security configurations

### Security Best Practices
- All API endpoints require valid authentication
- Resource authorization checks before operations
- Input sanitization through Zod parsing
- Secure cookie configuration (production vs development)
- Database foreign key constraints and data isolation
- TypeScript strict mode for type safety
- Custom error classes with structured responses

### Areas for Enhancement
- Consider implementing Content Security Policy (CSP) headers
- Add security headers middleware (HSTS, X-Frame-Options)
- Consider API request rate limiting beyond daily limits
- Add security event logging for audit trails

## Git Workflow

- ALWAYS run `pnpm lint` before committing
- Fix linting errors with `pnpm lint:fix` 
- Format code with `pnpm format`
- Run `pnpm build` to verify build passes (includes database migration)
- Run `pnpm test` to ensure Playwright tests pass
- Use conventional commit messages
- GitHub Actions CI/CD:
  - Lint workflow: Runs on every push with pnpm 9.12.3 and Node.js 20
  - Playwright tests: Runs on push/PR to main/master with 30-minute timeout
- Automatic deployment via Vercel
- NEVER use `git push --force` on main branch
- Use `git push --force-with-lease` for feature branches if needed
- Always verify current branch before force operations

### Pre-commit Checklist
1. Code formatted with Biome (`pnpm format`)
2. Linting passes (`pnpm lint`)
3. TypeScript compilation succeeds (`pnpm build`)
4. Tests pass (`pnpm test`)
5. Database migrations applied if schema changes
6. Environment variables documented in `.env.example`

## Configuration

Environment variables required:
- `AUTH_SECRET`: NextAuth.js secret (generate with `openssl rand -base64 32`)
- `XAI_API_KEY`: xAI API key for AI model access (get from https://console.x.ai/)
- `POSTGRES_URL`: PostgreSQL database connection string
- `BLOB_READ_WRITE_TOKEN`: Vercel Blob storage token for file uploads
- `REDIS_URL`: Redis connection string (optional, for resumable streams)
- `NODE_ENV`: Environment detection (development/production)

### Setup Instructions
1. Install Vercel CLI: `npm i -g vercel`
2. Link project: `vercel link`
3. Pull environment variables: `vercel env pull`
4. Install dependencies: `pnpm install`
5. Run database migrations: `pnpm db:migrate`
6. Start development server: `pnpm dev`

### Key Configuration Files
- `next.config.ts`: Next.js configuration with experimental PPR
- `biome.jsonc`: Biome linting and formatting configuration
- `drizzle.config.ts`: Database ORM configuration
- `playwright.config.ts`: Test configuration with custom projects
- `tailwind.config.ts`: Tailwind CSS with custom theme variables
- `tsconfig.json`: TypeScript configuration with path aliases
- `components.json`: shadcn/ui component configuration
- `middleware.ts`: Next.js middleware for authentication and routing

When adding new configuration:
1. Add to `.env.example` with documentation
2. Update configuration schema if applicable
3. Document in README.md or relevant documentation
4. Test in both development and production environments

All configuration follows the pattern of environment variables with reasonable defaults where possible.