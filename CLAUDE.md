# AI Chatbot Project

AI Chatbot is a full-stack Next.js application that provides a modern, production-ready chatbot experience with AI integration, authentication, and advanced artifact handling. Built with Next.js 15, React 19, and AI SDK v5, it offers real-time streaming conversations, document generation, and multi-user support.

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

- Start development server: `pnpm dev`
- Build for production: `pnpm build`
- Start production server: `pnpm start`
- Run tests: `pnpm test`
- Lint code: `pnpm lint`
- Fix linting issues: `pnpm lint:fix`
- Format code: `pnpm format`

### Database Commands

- Generate migrations: `pnpm db:generate`
- Run migrations: `pnpm db:migrate`
- Open database studio: `pnpm db:studio`
- Push schema changes: `pnpm db:push`

### Development Environment

- Development server: http://localhost:3000
- Database studio: Available via `pnpm db:studio`
- Test server: Automatically starts on port 3000 for Playwright tests

## Code Style

- TypeScript: Strict mode enabled with ESNext target
- Formatting: Biome (2 spaces, 80 character limit, single quotes for JS, double quotes for JSX)
- Linting: Biome + ESLint with Next.js config
- Semicolons: Always required
- Trailing commas: Always used
- Imports: External libraries first, then internal with @/ alias, then relative imports
- Components: PascalCase naming (e.g., `ChatHeader`, `MultimodalInput`)
- Files: kebab-case naming (e.g., `chat-header.tsx`, `use-messages.tsx`)
- Functions: camelCase naming (e.g., `generateUUID`, `fetchWithErrorHandlers`)
- Constants: SCREAMING_SNAKE_CASE (e.g., `DUMMY_PASSWORD`)
- NEVER use `@ts-expect-error` or `@ts-ignore` to suppress type errors
- Use functional components with hooks (no class components)
- Prefer named exports over default exports (except for pages and configs)

## Testing

- Playwright for end-to-end testing
- Custom fixtures for multi-user authentication scenarios
- Page Object Model for maintainable test organization
- AI model mocking using MockLanguageModelV2
- Test files: `*.test.ts`
- Test organization: `/tests/e2e/` for UI tests, `/tests/routes/` for API tests
- Parallel test execution with 8 workers locally, 2 on CI
- Automatic web server startup for tests

## Architecture

- Framework: Next.js 15 with App Router and experimental PPR
- Frontend: React 19 RC with TypeScript
- AI Integration: AI SDK v5 Beta with xAI (Grok) as default provider
- Database: PostgreSQL with Drizzle ORM
- Authentication: NextAuth.js v5 Beta with credentials and guest modes
- Styling: Tailwind CSS with shadcn/ui components
- State Management: React hooks + SWR for server state
- Build Tool: Next.js with Turbo mode
- Package Manager: pnpm
- Testing: Playwright for E2E testing
- File Storage: Vercel Blob for attachments

## Security

- Environment variables for sensitive data (AUTH_SECRET, API_KEY, etc.)
- Password hashing using bcrypt-ts
- Guest user system with temporary sessions
- Input validation using Zod schemas
- NextAuth.js session management
- HTTPS enforcement in production
- Secure authentication flows with timing attack protection
- No hardcoded secrets in repository
- Proper error handling without exposing sensitive information

## Git Workflow

- ALWAYS run `pnpm lint` before committing
- Fix linting errors with `pnpm lint:fix`
- Run `pnpm build` to verify build passes
- Run `pnpm test` to ensure tests pass
- Use conventional commit messages
- GitHub Actions for CI/CD with lint and test workflows
- Automatic deployment via Vercel

## Configuration

Environment variables required:
- `AUTH_SECRET`: NextAuth.js secret (generate with `openssl rand -base64 32`)
- `XAI_API_KEY`: xAI API key for AI model access
- `POSTGRES_URL`: PostgreSQL database connection string
- `BLOB_READ_WRITE_TOKEN`: Vercel Blob storage token
- `REDIS_URL`: Redis connection string (optional, for caching)

When adding new configuration:
1. Add to `.env.example` with documentation
2. Update configuration schema if applicable
3. Document in README.md or relevant documentation

All configuration follows the pattern of environment variables with reasonable defaults where possible.