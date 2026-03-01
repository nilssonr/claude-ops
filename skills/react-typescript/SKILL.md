---
name: react-typescript
description: React + TypeScript expert guidance. Activates when writing, reviewing, or refactoring React components in TypeScript. Covers best practices, performance, accessibility, component architecture, idiomatic patterns, and common anti-patterns.
user-invocable: true
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
---

# React + TypeScript — Best Practices Guide

You are an expert React + TypeScript developer. Follow these rules when writing, reviewing, or refactoring React code. These rules reflect the current React team recommendations and community consensus.

---

## 1. TypeScript Foundations

### Props & Types

- Use `interface` for component props (extendable). Use `type` for unions, tuples, and utility types.
- Type children explicitly with `React.ReactNode` or `React.PropsWithChildren<P>`. React 18+ does NOT add implicit children to `React.FC`.
- Use discriminated unions for component variants — make impossible states unrepresentable.
- Use `React.ComponentPropsWithoutRef<'element'>` to extend native HTML element props.
- Prefer type inference over explicit annotations when TypeScript can infer correctly.
- Avoid `any`. Use `unknown` with type guards instead. Avoid `as` casts — narrow types with control flow.

```typescript
// Discriminated union for variants
type AlertProps =
  | { variant: 'info'; message: string }
  | { variant: 'action'; message: string; onAction: () => void };

// Extending native elements
interface ButtonProps extends React.ComponentPropsWithoutRef<'button'> {
  variant: 'primary' | 'secondary';
}
```

### Event & Ref Typing

- Type events using React's event types: `React.ChangeEvent<HTMLInputElement>`, `React.MouseEvent<HTMLButtonElement>`, etc.
- Type refs as `React.useRef<HTMLElement | null>(null)`. Use `forwardRef` with explicit generic params: `React.forwardRef<HTMLInputElement, InputProps>`.
- When exposing imperative APIs, use `useImperativeHandle` with a typed handle interface.

### Context Typing

- Create context with `createContext<T | undefined>(undefined)`.
- Always pair with a custom hook that throws if context is undefined — never let consumers get `undefined` silently.

```typescript
const MyContext = createContext<MyContextType | undefined>(undefined);

function useMyContext() {
  const ctx = useContext(MyContext);
  if (!ctx) throw new Error('useMyContext must be within MyProvider');
  return ctx;
}
```

### Strict Config

Enable strict TypeScript. These should be on:
`strict`, `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`, `noImplicitReturns`, `forceConsistentCasingInFileNames`.

---

## 2. Component Design

### Structure

- One responsibility per component. If a component does two unrelated things, split it.
- Prefer composition over inheritance. Use `children`, slot props, and render delegation.
- Keep prop surfaces small and focused. A component with 15+ props likely needs splitting.
- Use the compound component pattern (shared context between related components) for complex UIs like tabs, accordions, and forms.
- Don't over-abstract. Follow the Rule of Three — only extract a reusable component after seeing the same pattern 3+ times. Three similar lines of code is better than a premature abstraction.

### Controlled vs Uncontrolled

- Default to controlled components for forms requiring validation or cross-field logic.
- Use uncontrolled components (with refs) for simple, isolated inputs where you only need the value on submit.
- When building library components, support both patterns when practical.

### Polymorphic Components

Use the `as` prop pattern with TypeScript generics for components that need to render as different elements:

```typescript
interface BoxProps<C extends React.ElementType> {
  as?: C;
  children?: React.ReactNode;
}
type Props<C extends React.ElementType> = BoxProps<C> &
  Omit<React.ComponentPropsWithoutRef<C>, keyof BoxProps<C>>;
```

---

## 3. Hooks Rules & Patterns

### Core Rules

- Only call hooks at the top level. Never inside conditions, loops, or nested functions.
- Only call hooks from React function components or custom hooks.
- Every custom hook should have a single concern. Name them `use[Domain]`.

### useEffect — The Most Misused Hook

**Only use useEffect to synchronize with external systems** (subscriptions, browser APIs, third-party libraries). NOT for:

| Don't use useEffect for | Do this instead |
|---|---|
| Computing derived values | Calculate during render or `useMemo` |
| Handling user events | Event handlers |
| Resetting state when props change | Use the `key` prop to remount |
| Chaining state updates (Effect A triggers Effect B) | Single event handler that computes all state |
| Fetching data | TanStack Query, SWR, or framework data loading |
| Notifying parent of state changes | Call parent callback in the event handler directly |

### useEffect When You Must

- Always return a cleanup function for subscriptions, timers, and event listeners.
- Include every reactive value in the dependency array. Never suppress `exhaustive-deps`.
- Use `AbortController` for async operations to prevent race conditions.
- Use updater functions (`setState(prev => ...)`) to avoid stale state dependencies.

```typescript
useEffect(() => {
  const controller = new AbortController();
  fetch(`/api/data?q=${query}`, { signal: controller.signal })
    .then(r => r.json())
    .then(setData)
    .catch(err => { if (err.name !== 'AbortError') setError(err); });
  return () => controller.abort();
}, [query]);
```

### State: useState vs useReducer

- `useState` for simple, independent values.
- `useReducer` when state transitions are complex, interdependent, or spread across many handlers. Use discriminated union action types.
- Colocate state as close to where it's used as possible. Only lift state to the nearest common ancestor that needs it.

### Performance Hooks

- `useMemo`: Only for expensive computations confirmed by profiling. Not needed for simple calculations.
- `useCallback`: Only when passing callbacks to `React.memo`-wrapped children. Not needed otherwise.
- `useTransition`: For non-blocking state updates (search inputs, heavy filtering). Keeps UI responsive.
- `useDeferredValue`: For deferring non-critical renders while keeping urgent updates fast.
- **React Compiler (v1.0, production-ready)**: Auto-memoizes components. When using the compiler, manual `useMemo`/`useCallback`/`React.memo` are rarely needed. Still understand them for library code and edge cases.

---

## 4. State Management

### Decision Framework

| State Type | Solution |
|---|---|
| Local UI state (open/close, form input) | `useState` / `useReducer` |
| Shared UI state (theme, sidebar, locale) | React Context |
| Cross-cutting global state (cart, auth token) | Zustand or Jotai |
| Server/API state (fetched data, cache) | TanStack Query or SWR |

**Never** store server state in Context or Zustand. Use a data-fetching library.

### Context Performance

- Split unrelated state into separate contexts. Every consumer re-renders when any part of context changes.
- Separate data context from dispatch context (avoids re-rendering dispatch-only consumers).
- For high-frequency updates, use `useSyncExternalStore` or atomic state (Jotai/Zustand) instead of Context.

---

## 5. Performance

### Rendering

- Don't create components inside other components — they remount on every render.
- Avoid inline object/array literals as props — they create new references each render.
- Use stable, unique keys for lists (database IDs). Never use array indices for dynamic lists. Never use `Math.random()`.
- Split large components so state changes re-render smaller subtrees.

### Bundle Size

- Import specific modules, not barrels: `import { debounce } from 'lodash-es/debounce'`.
- Code-split at route boundaries with `React.lazy` + `Suspense`.
- Avoid large barrel files (index.ts re-exporting everything). Use direct imports or small barrels (~5 exports max).

### Lists

- Virtualize lists with 100+ items using TanStack Virtual or react-window.
- Combine infinite scroll with virtualization to prevent memory issues.

### Images

- Always specify `width` and `height` to prevent CLS.
- Use native `loading="lazy"` for below-the-fold images.
- Use `<picture>` with AVIF/WebP sources for modern format support.
- In Next.js, use `next/image` with the `sizes` attribute.

### Core Web Vitals

- **LCP**: Preload critical images and fonts. Use SSR or Server Components. Inline critical CSS.
- **INP**: Use `useTransition` for heavy updates. Reduce client-side JS with Server Components. Debounce/throttle expensive event handlers.
- **CLS**: Always specify image dimensions. Reserve space for dynamic content.

---

## 6. Data Fetching

### Client-Side

- Use TanStack Query for all API state. It handles caching, background refetching, loading/error states, and optimistic updates.
- Set `staleTime` and `gcTime` based on data freshness requirements.
- Use `queryKey` arrays that include all parameters affecting the query.
- For mutations, use `useMutation` with `onSuccess` that calls `invalidateQueries`.

### Server-Side (React 19+ / Next.js)

- Server Components fetch data directly with `async/await` — zero client JS.
- Use Server Actions (`'use server'`) for data mutations instead of API routes.
- Use `useActionState` for form state management with server actions.
- Use `useOptimistic` for immediate UI feedback during mutations.
- Use `useFormStatus` for submit button loading states.

### Loading & Error States

- Wrap async components in `<Suspense fallback={...}>` for loading states.
- Wrap in `<ErrorBoundary>` to catch render errors.
- Use granular Suspense boundaries — don't wrap the entire app in one.

---

## 7. Forms

### Simple Forms

- React 19: Use native `<form action={serverAction}>` + `useActionState` + `useFormStatus`.
- For client-only simple forms, controlled inputs with `useState` are fine.

### Complex Forms

- Use React Hook Form + Zod for client-side forms with complex validation.
- Define schemas with Zod, infer TypeScript types with `z.infer<typeof schema>`.
- Use `zodResolver` to connect Zod schemas to React Hook Form.

```typescript
const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
type FormData = z.infer<typeof schema>;

const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
  resolver: zodResolver(schema),
});
```

---

## 8. Accessibility

### Semantic HTML First

- Use `<button>`, `<a>`, `<nav>`, `<main>`, `<article>`, `<section>`, `<header>`, `<footer>` — not generic `<div>` and `<span>` with roles.
- Every `<img>` must have an `alt` attribute. Decorative images use `alt=""`.
- Every form input must have an associated `<label>`.

### Keyboard Navigation

- All interactive elements must be keyboard-accessible (Tab, Enter, Space, Escape, Arrow keys).
- Never remove `:focus` outlines without providing a visible alternative. Prefer `:focus-visible`.
- Implement focus traps for modals and dialogs.
- Move focus to the dialog when it opens; return focus to the trigger when it closes.

### ARIA

- Prefer semantic HTML over ARIA. Only use ARIA when semantic elements can't express the meaning.
- Use `aria-label` for elements without visible text labels.
- Use `aria-live="polite"` for dynamic content changes that screen readers should announce.
- Use `aria-hidden="true"` on decorative elements.
- Provide skip links (`<a href="#main-content" class="sr-only">Skip to main content</a>`).

### Testing

- Use `eslint-plugin-jsx-a11y` for static analysis.
- Use `jest-axe` for automated accessibility checks in tests.
- Query elements by role first in tests: `screen.getByRole('button', { name: /submit/i })`.

---

## 9. Testing

### Philosophy

"The more your tests resemble the way your software is used, the more confidence they give you."

### Query Priority

1. `getByRole` (preferred default)
2. `getByLabelText` (form inputs)
3. `getByPlaceholderText`
4. `getByText` (non-interactive)
5. `getByTestId` (last resort)

### Patterns

- Use `@testing-library/user-event` over `fireEvent` for realistic user interactions.
- Use `findBy*` (async) for elements that appear after state changes.
- Test behavior, not implementation. Don't assert on internal state or DOM structure.
- Favor integration tests over unit tests — test components with their hooks and API interactions.
- Use MSW (Mock Service Worker) for API mocking.
- Follow Arrange-Act-Assert structure.

---

## 10. Security

- React escapes JSX expressions by default — this prevents most XSS.
- Never use `dangerouslySetInnerHTML` without sanitizing with DOMPurify first.
- Validate URLs before using in `href` — reject `javascript:` protocol. Only allow `http:` and `https:`.
- Don't store sensitive data (passwords, tokens) in React state. Use refs for temporary values, clear after use.
- Implement CSP headers to restrict script sources.

---

## 11. Code Quality Checklist

When writing or reviewing React + TypeScript code, verify:

- [ ] No `any` types. No unnecessary `as` casts.
- [ ] No useEffect for derived state, event handling, or data fetching.
- [ ] No inline object/array literals as props in hot paths.
- [ ] No array index keys on dynamic lists.
- [ ] No component definitions inside other components.
- [ ] No suppressed ESLint rules (`exhaustive-deps`, `rules-of-hooks`).
- [ ] Cleanup functions for every subscription, timer, and listener in effects.
- [ ] AbortController for every async operation in effects.
- [ ] Semantic HTML elements used instead of generic divs with roles.
- [ ] All images have alt text and explicit dimensions.
- [ ] All form inputs have associated labels.
- [ ] All interactive elements are keyboard-accessible.

---

## 12. File Structure (Feature-Based)

For medium-to-large projects:

```
src/
├── features/
│   └── auth/
│       ├── components/
│       │   ├── LoginForm.tsx
│       │   └── LoginForm.test.tsx
│       ├── hooks/
│       │   └── useAuth.ts
│       ├── types.ts
│       └── index.ts          # Public API only
├── shared/
│   ├── components/            # UI primitives (Button, Modal)
│   ├── hooks/                 # Cross-cutting hooks
│   ├── utils/
│   └── types/
└── App.tsx
```

- Colocate tests, styles, types, and hooks with their component.
- Feature directories should not depend on other feature directories.
- Use barrel files only at feature boundaries, not deeply nested.
