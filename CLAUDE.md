# Chat SDK

Chat SDK is a free, open-source AI chatbot template built with Next.js 15 and the AI SDK v5. 
It provides a full-stack foundation for building conversational AI applications with support for 
multiple AI providers, real-time streaming, and advanced features like artifacts and document editing.

## Project Structure

```
chat-sdk/
├── app/                            # Next.js App Router application
│   ├── (auth)/                    # Authentication routes (grouped)
│   │   ├── actions.ts            # Server actions for login/register
│   │   ├── auth.config.ts        # NextAuth configuration
│   │   ├── auth.ts               # NextAuth setup and types
│   │   ├── login/page.tsx        # Login page
│   │   ├── register/page.tsx     # Register page
│   │   └── api/auth/             # NextAuth API routes
│   ├── (chat)/                   # Main chat interface (grouped)
│   │   ├── actions.ts            # Chat-related server actions
│   │   ├── layout.tsx            # Chat layout with sidebar
│   │   ├── page.tsx              # Main chat page
│   │   ├── chat/[id]/page.tsx    # Individual chat page
│   │   └── api/                  # Chat API routes
│   │       ├── chat/             # Chat streaming and management
│   │       ├── document/         # Document operations
│   │       ├── files/upload/     # File upload handling
│   │       ├── history/          # Chat history retrieval
│   │       ├── suggestions/      # AI suggestions
│   │       └── vote/             # Message voting
│   ├── layout.tsx                # Root layout with global providers
│   └── globals.css               # Global Tailwind styles
├── components/                    # React UI components
│   ├── ui/                       # shadcn/ui base components
│   │   ├── button.tsx           # Button primitives
│   │   ├── input.tsx            # Form inputs
│   │   ├── sidebar.tsx          # Sidebar layout components
│   │   ├── tooltip.tsx          # Tooltip components
│   │   └── ...                  # Other UI primitives
│   ├── auth-form.tsx            # Authentication form
│   ├── chat.tsx                 # Main chat interface
│   ├── chat-header.tsx          # Chat header with controls
│   ├── message.tsx              # Individual message rendering
│   ├── messages.tsx             # Message list container
│   ├── multimodal-input.tsx     # Chat input with file support
│   ├── artifact.tsx             # Artifact display and management
│   ├── code-editor.tsx          # CodeMirror integration
│   ├── text-editor.tsx          # ProseMirror integration
│   ├── model-selector.tsx       # AI model selection
│   ├── visibility-selector.tsx  # Chat visibility controls
│   └── ...                      # Other specialized components
├── lib/                          # Core business logic
│   ├── ai/                      # AI integration layer
│   │   ├── models.ts            # Model configurations and types
│   │   ├── providers.ts         # AI provider setup (xAI, OpenAI, etc.)
│   │   ├── prompts.ts           # System and user prompts
│   │   ├── entitlements.ts      # User permission management
│   │   └── tools/               # AI tool implementations
│   │       ├── create-document.ts
│   │       ├── update-document.ts
│   │       ├── get-weather.ts
│   │       └── request-suggestions.ts
│   ├── db/                      # Database layer
│   │   ├── schema.ts            # Drizzle ORM schema definitions
│   │   ├── queries.ts           # Database query functions
│   │   ├── utils.ts             # DB utility functions
│   │   └── migrations/          # Database migration files
│   ├── editor/                  # Text editing functionality
│   │   ├── config.ts            # ProseMirror configuration
│   │   ├── functions.tsx        # Editor utility functions
│   │   ├── suggestions.tsx      # AI suggestion integration
│   │   └── diff.js              # Document diff functionality
│   ├── artifacts/              # Document artifact system
│   │   └── server.ts           # Artifact processing logic
│   ├── constants.ts            # Application constants
│   ├── types.ts                # Shared TypeScript types
│   ├── utils.ts                # General utility functions
│   └── errors.ts               # Error handling and definitions
├── artifacts/                   # Artifact type implementations
│   ├── code/                   # Code artifacts
│   │   ├── client.tsx         # Code display component
│   │   └── server.ts          # Code processing logic
│   ├── text/                   # Text document artifacts
│   │   ├── client.tsx         # Text editor component
│   │   └── server.ts          # Text processing logic
│   ├── image/                  # Image artifacts
│   │   ├── client.tsx         # Image display component
│   │   └── server.ts          # Image processing logic
│   └── sheet/                  # Spreadsheet artifacts
│       ├── client.tsx         # Sheet editor component
│       └── server.ts          # Sheet processing logic
├── hooks/                       # Custom React hooks
│   ├── use-artifact.ts         # Artifact state management
│   ├── use-chat-visibility.ts  # Chat visibility hook
│   ├── use-messages.tsx        # Message list management
│   ├── use-mobile.tsx          # Mobile device detection
│   ├── use-scroll-to-bottom.tsx # Auto-scrolling behavior
│   └── use-auto-resume.ts      # Chat resumption logic
├── tests/                       # Playwright E2E tests
│   ├── e2e/                    # End-to-end tests
│   │   ├── chat.test.ts        # Chat functionality
│   │   ├── artifacts.test.ts   # Artifact features
│   │   ├── reasoning.test.ts   # AI reasoning tests
│   │   └── session.test.ts     # Session management
│   ├── routes/                 # API route tests
│   │   ├── chat.test.ts        # Chat API endpoints
│   │   └── document.test.ts    # Document API endpoints
│   ├── pages/                  # Page Object Model classes
│   │   ├── chat.ts             # Chat page interactions
│   │   ├── auth.ts             # Auth page interactions
│   │   └── artifact.ts         # Artifact page interactions
│   ├── prompts/                # Test data and utilities
│   │   ├── basic.ts            # Basic test prompts
│   │   ├── routes.ts           # API test prompts
│   │   └── utils.ts            # Prompt utilities
│   ├── fixtures.ts             # Test fixtures and contexts
│   └── helpers.ts              # Test helper functions
├── .env.example                 # Environment variables template
├── .gitignore                   # Git ignore rules
├── biome.jsonc                  # Biome linter/formatter config
├── .eslintrc.json              # ESLint configuration
├── drizzle.config.ts           # Database configuration
├── middleware.ts               # Next.js middleware
├── next.config.ts              # Next.js configuration
├── package.json                # Dependencies and scripts
├── playwright.config.ts        # E2E testing configuration
├── postcss.config.mjs          # PostCSS configuration
├── README.md                   # Project overview
├── tailwind.config.ts          # Tailwind CSS configuration
└── tsconfig.json               # TypeScript configuration
```

## Build & Commands

- **Typecheck and lint everything**: `pnpm lint`
- **Fix linting/formatting**: `pnpm lint:fix`
- **Format code**: `pnpm format`
- **Run tests**: `pnpm test`
- **Start development server**: `pnpm dev`
- **Build for production**: `pnpm build`
- **Start production server**: `pnpm start`

### Database Commands

- **Generate migrations**: `pnpm db:generate`
- **Run migrations**: `pnpm db:migrate`
- **Open Drizzle Studio**: `pnpm db:studio`
- **Push schema to DB**: `pnpm db:push`
- **Pull schema from DB**: `pnpm db:pull`

### Development Environment

- **Frontend dev server**: http://localhost:3000
- **Health check endpoint**: http://localhost:3000/ping
- **Database**: PostgreSQL (configured via DATABASE_URL)
- **Package manager**: pnpm 9.12.3

## Code Style

- **TypeScript**: Strict mode with Next.js 15 and React 19 RC
- **Formatting**: 2-space indentation, 80-character line width
- **Quotes**: Single quotes for strings, double quotes for JSX
- **Semicolons**: Always required
- **Trailing commas**: Required for multiline structures
- **Imports**: Use `@/*` path aliases, absolute imports preferred
- **Type imports**: Use `import type` for TypeScript types
- **Component naming**: PascalCase for components, kebab-case for files
- **Variable naming**: camelCase, descriptive names
- **Constants**: SCREAMING_SNAKE_CASE for module constants
- **Boolean variables**: Use `is`, `has`, or `can` prefixes
- **Functions**: Descriptive action names (e.g., `generateTitleFromUserMessage`)
- **Files**: kebab-case with clear purpose (e.g., `message-actions.tsx`)
- **Line endings**: Use single blank lines to separate logical sections
- **NEVER use**: `@ts-expect-error` or `@ts-ignore` to suppress type errors

## Testing

- **Framework**: Playwright for E2E and API route testing
- **Test files**: `*.test.ts` in `/tests/` directory
- **Organization**: Separate `/e2e/` and `/routes/` test directories
- **Page Object Model**: Structured page classes in `/tests/pages/`
- **Fixtures**: Custom test fixtures with user contexts
- **Mocking**: AI model mocking with MockLanguageModelV2
- **Timeout**: 240 seconds for tests and expectations
- **Parallel execution**: Enabled with 8 workers locally
- **Trace collection**: On failure for debugging
- **Test patterns**: 
  - Descriptive test names focusing on behavior
  - Use `.serial` for route tests requiring sequential execution
  - Group related functionality in describe blocks
  - Use page object methods for complex interactions

## Architecture

- **Frontend**: Next.js 15 with App Router, React 19 RC, TypeScript
- **Backend**: Next.js API routes with server actions
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: NextAuth.js v5 with credential and guest support
- **AI Integration**: AI SDK v5 with multiple provider support (xAI Grok default)
- **Styling**: Tailwind CSS with shadcn/ui components
- **State Management**: React hooks, SWR for data fetching, Zustand patterns
- **Real-time**: Streaming responses with resumable streams
- **File Storage**: Vercel Blob for file uploads
- **Build Tool**: Next.js with Turbo mode
- **Package Manager**: pnpm with workspace support
- **Text Editing**: ProseMirror for rich text, CodeMirror for code
- **Performance**: React.memo with custom equality functions

## Security

- **Authentication**: Secure session management with NextAuth
- **Password hashing**: bcrypt-ts for credential security  
- **Environment variables**: Never commit secrets to repository
- **Input validation**: Zod schemas for runtime validation
- **Error handling**: Custom `ChatSDKError` class with proper status codes
- **CORS**: Proper API route protection
- **Guest users**: Secure guest session handling
- **Database**: Parameterized queries via Drizzle ORM
- **File uploads**: Validated file type and size restrictions

## Git Workflow

- **ALWAYS run `pnpm lint` before committing**
- **Fix linting errors with `pnpm lint:fix`**
- **Run `pnpm build` to verify build passes**  
- **Run `pnpm test` for E2E validation**
- **NEVER use `git push --force` on main branch**
- **Use `git push --force-with-lease` for feature branches if needed**
- **Verify current branch before force operations**

## Configuration

### Environment Variables (.env.example)
Key configuration options that must be documented when adding new settings:

- **Database**: `DATABASE_URL`, `DATABASE_AUTH_TOKEN`
- **Authentication**: `AUTH_SECRET`, `NEXTAUTH_URL`
- **AI Providers**: `XAI_API_KEY`, `OPENAI_API_KEY`, etc.
- **File Storage**: `BLOB_READ_WRITE_TOKEN`
- **Observability**: OpenTelemetry configuration

### Configuration Files
When adding new configuration options, update all relevant places:

1. **Environment variables in `.env.example`**
2. **Configuration validation in relevant modules**
3. **Documentation in this file**
4. **Type definitions in configuration schemas**

### Model Configuration
- **Default**: xAI Grok-2-1212 model
- **Entitlements**: User type-based model access control
- **Streaming**: Real-time response streaming with tool calls
- **Fallbacks**: Graceful degradation for provider failures

All configuration keys use consistent naming patterns and MUST be documented when added.