---
name: react-typescript
description: >-
  React + TypeScript expert guidance covering best practices, performance, accessibility,
  component architecture, idiomatic patterns, and common anti-patterns.
  TRIGGER when: writing, reviewing, or refactoring React components in TypeScript (.tsx/.ts files),
  discussing React patterns, or implementing features in a React project.
  DO NOT TRIGGER when: working on non-React code, pure Node.js/backend code, or configuration
  files unrelated to React.
user-invocable: true
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
---

**Announce to the user: "Skill activated: react-typescript"**

# React + TypeScript — Best Practices Guide

You are an expert React + TypeScript developer. Follow these rules when writing, reviewing, or refactoring React code. These rules reflect the current React team recommendations (react.dev), Dan Abramov's and Kent C. Dodds' guidance, and community consensus for React 18+.

---

## 1. Core Mental Models

These five principles prevent the majority of performance and correctness bugs. Internalize them before reaching for any optimization.

### Components are pure functions; rendering is not painting

Components are pure functions of `(props, state) → JSX`. Same inputs, same output. No side effects during render. React's process is **trigger → render → commit**: a state change triggers a render (React calls your function), then React commits minimal DOM changes. A component may render many times without the DOM changing at all.

### The re-render cascade

React re-renders a component when its state changes, when its parent re-renders, or when a consumed context value changes. **React does NOT check if props changed before re-rendering children** — it re-renders the entire subtree by default. `React.memo` opts into prop comparison, but the default is unconditional child re-rendering. This is the most commonly misunderstood behavior.

### Derive, don't sync

When something can be calculated from existing props or state, **calculate it during render** — don't store it in state and synchronize with `useEffect`. This eliminates extra render passes and sync bugs. For expensive derivations, wrap in `useMemo`. State is the minimal set of changing data: if it doesn't change over time, is passed via props, or can be computed, it's not state.

### Object.is governs equality

`useState` skips re-rendering when the new value is `Object.is`-equal to the current value — but `Object.is({a:1}, {a:1})` is `false`. Context re-renders every consumer when its value changes by `Object.is`. Constants should live outside component scope for truly stable references.

### Composition and colocation over memoization

The recommended optimization order: **colocate state → compose → profile → memoize selectively**. Memoization is the last resort, not the first tool. See Section 6 for details.

---

## 2. TypeScript Foundations

### Props & Types

- Use `interface` for component props (extendable). Use `type` for unions, tuples, and utility types.
- Type children explicitly with `React.ReactNode`. React 18+ does NOT add implicit children to `React.FC`.
- Use discriminated unions for component variants — make impossible states unrepresentable.
- Use `React.ComponentPropsWithoutRef<'element'>` to extend native HTML element props.
- Prefer type inference over explicit annotations when TypeScript can infer correctly.
- Never use `any`. Use `unknown` with type guards instead. Avoid `as` casts — narrow types with control flow.

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

### Event, Ref & Context Typing

- Type events: `React.ChangeEvent<HTMLInputElement>`, `React.MouseEvent<HTMLButtonElement>`.
- Type refs: `useRef<HTMLElement | null>(null)`. Use `forwardRef<HTMLInputElement, InputProps>`.
- Create context with `createContext<T | undefined>(undefined)` and always pair with a custom hook that throws if undefined:

```typescript
const ThemeContext = createContext<Theme | undefined>(undefined);

function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be within ThemeProvider');
  return ctx;
}
```

### Strict Config

Enable strict TypeScript: `strict`, `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`, `noImplicitReturns`, `forceConsistentCasingInFileNames`.

---

## 3. Component Design

### Structure

- One responsibility per component. If it does two unrelated things, split it.
- Prefer composition over configuration. Use `children`, slot props, and render delegation.
- Keep prop surfaces small. A component with 15+ props likely needs splitting.
- Use compound components (shared context between related components) for complex UIs like tabs, accordions, and forms — `<Select><Option>` instead of `<Select options={[...]} />`.
- Don't over-abstract. Follow the Rule of Three — only extract after seeing the same pattern 3+ times.

### Controlled vs Uncontrolled

- A component should be either **fully controlled** (value + onChange from parent) or **fully uncontrolled** (internal state, with `key` for resetting). Never mix both for the same value.
- Default to controlled for forms requiring validation or cross-field logic.
- Use the **"fully uncontrolled with key"** pattern to reset all internal state cleanly:

```tsx
// Changing recipientId resets ALL internal state in ChatPanel — no useEffect needed
<ChatPanel key={recipientId} recipientId={recipientId} />
```

### Polymorphic Components

Use the `as` prop pattern with TypeScript generics for components that render as different elements:

```typescript
interface BoxProps<C extends React.ElementType> {
  as?: C;
  children?: React.ReactNode;
}
type Props<C extends React.ElementType> = BoxProps<C> &
  Omit<React.ComponentPropsWithoutRef<C>, keyof BoxProps<C>>;
```

---

## 4. Hooks Rules & Patterns

### Core Rules

- Only call hooks at the top level. Never inside conditions, loops, or nested functions.
- Only call hooks from React function components or custom hooks.

### Custom Hook Conventions

- Name hooks for **what** they do: `useOnlineStatus`, not `useEventListenerForOnlineStatus`.
- Never create lifecycle wrappers (`useMount`, `useUnmount`) — they encode class-component thinking.
- Don't prefix with `use` unless the function calls other hooks.
- Extract hooks only when stateful logic is genuinely shared; premature abstraction adds indirection without value.

### useEffect — Synchronization, Not Lifecycle

**Only use useEffect to synchronize with external systems** (subscriptions, browser APIs, third-party libraries, DOM measurements). NOT for:

| Don't use useEffect for | Do this instead |
|---|---|
| Computing derived values | Calculate during render or `useMemo` |
| Handling user events | Event handlers |
| Resetting state when props change | Use the `key` prop to remount |
| Chaining state updates (A → B → C) | Single event handler that computes all state |
| Fetching data | TanStack Query, SWR, or framework data loading |
| Notifying parent of state changes | Call parent callback in the event handler directly |

The dependency array is "when to re-synchronize," not "when to run." Never suppress `exhaustive-deps`. If you want different dependencies, restructure the Effect. Cleanup runs before re-execution and on unmount.

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

### Stale Closures — The Most Common Hook Bug

Closures capture render-time values. An interval callback created on render 1 will forever see render 1's state. Fixes:

```typescript
// BROKEN: count is always 0 inside the interval
useEffect(() => {
  const id = setInterval(() => setCount(count + 1), 1000); // stale!
  return () => clearInterval(id);
}, []);

// FIXED: functional update reads latest state
useEffect(() => {
  const id = setInterval(() => setCount(c => c + 1), 1000);
  return () => clearInterval(id);
}, []);
```

Other solutions: add the value to the dependency array, store latest value in a ref, or use `useEffectEvent` (React 19+) for Effect callbacks that should read latest values without re-triggering.

### useState vs useReducer

- `useState` for simple, independent values. Use lazy initializers: `useState(() => expensive())`.
- `useReducer` when state transitions are complex, interdependent, or spread across many handlers. The `dispatch` function has **guaranteed stable identity** across renders — safe for Context and dependency arrays without causing re-renders. Use discriminated union action types.
- The `useReducer` + split Context pattern (state context + dispatch context) gives Redux-like architecture with zero dependencies — dispatch-only consumers never re-render on state changes.

---

## 5. State Management

### State Colocation

Place state as close to where it's used as possible. Form field state belongs in field components, not a global store. Modal open/closed state belongs near the modal. Only lift state when multiple components genuinely need it; only reach for Context when prop drilling becomes unwieldy; only use external stores for truly global, cross-cutting concerns.

### State Shape Principles

- **Group related state** — values that always change together belong in one `useState` or `useReducer`.
- **Avoid contradictions** — use status enums (`'idle' | 'loading' | 'error' | 'success'`) instead of boolean pairs (`isLoading` + `isError`).
- **Avoid redundancy** — derive instead of storing.
- **Avoid duplication** — store IDs, not object copies.
- **Flatten nested structures** — normalize like a database.

### Decision Framework

| State Type | Solution |
|---|---|
| Local UI state (open/close, form input) | `useState` / `useReducer` |
| Shared UI state (theme, sidebar, locale) | React Context (with `useMemo` on value) |
| Cross-cutting global state (cart, auth) | Zustand (~3KB) or Jotai (~3.5KB) |
| High-frequency updates (typing, mouse) | Zustand/Jotai selectors (NOT Context) |
| Server/API state (fetched data, cache) | TanStack Query or SWR |

**Never** store server state in Context or Zustand. Use a data-fetching library.

### Context Performance

- Context re-renders **every** consumer when its value changes (`Object.is`). The most common mistake: creating a new object in the Provider's `value` prop every render — `useMemo` the value.
- Split state and dispatch into separate contexts (`dispatch` has stable identity).
- Context is fundamentally unsuitable for high-frequency updates — use Zustand/Jotai selectors instead.

---

## 6. Performance

### Composition First — Before You Memo

Two patterns that improve architecture AND performance without memoization:

**Move state down** — extract the stateful part into its own component so siblings don't re-render:

```tsx
// BEFORE: ExpensiveList re-renders on every keystroke
function Page() {
  const [query, setQuery] = useState('');
  return (<><SearchInput value={query} onChange={setQuery} /><ExpensiveList /></>);
}

// AFTER: ExpensiveList is unaffected by SearchInput's state
function SearchSection() {
  const [query, setQuery] = useState('');
  return <SearchInput value={query} onChange={setQuery} />;
}
function Page() {
  return (<><SearchSection /><ExpensiveList /></>);
}
```

**Lift content up** — pass expensive children as props so they're created by a non-re-rendering ancestor:

```tsx
function ScrollTracker({ children }: { children: React.ReactNode }) {
  const [scrollY, setScrollY] = useState(0);
  // children was created by Page's parent — not recreated when scrollY changes
  return <div onScroll={e => setScrollY(e.currentTarget.scrollTop)}>{children}</div>;
}
```

### React Compiler

React Compiler 1.0 (stable October 2025) is a build-time Babel plugin that automatically inserts granular memoization through static analysis. Production results: Meta Quest Store saw up to 12% faster initial loads and 2.5x faster interactions.

- **New code**: Rely on the compiler. Reserve manual `useMemo`/`useCallback`/`React.memo` as escape hatches for edge cases.
- **Existing code**: Leave manual memoization in place — removing it can change compilation output.
- **Without the compiler**: `useCallback` is pointless without `React.memo` on the receiving component (the child re-renders anyway). Only `useMemo` expensive computations confirmed by profiling.

### Rendering Rules

- Never define components inside other components — they remount every render.
- Avoid inline object/array literals as props in hot paths — they break `React.memo`.
- Use stable, unique keys (database IDs). Never array indices for dynamic lists. Never `Math.random()`.

### Concurrent Features

- **Automatic batching** (React 18+): all state updates batch into one re-render regardless of context (promises, setTimeout, events). Opt out with `flushSync` only when you need synchronous intermediate DOM reads.
- **`useTransition`**: marks updates as non-urgent. React can interrupt and restart transition renders. Key UX win: transitions keep showing stale content instead of flashing loading fallbacks.
- **`useDeferredValue`**: returns a value that "lags behind" during transitions. Unlike debounce/throttle, adapts to device speed — no arbitrary timeouts. Use when you receive a value you can't control (props).
- **Suspense**: declaratively handles async loading. Combined with transitions, provides native stale-while-revalidate.

### Bundle & Lists

- Import specific modules: `import { debounce } from 'lodash-es/debounce'`.
- Code-split at route boundaries with `React.lazy` + `Suspense`.
- Virtualize lists with 100+ items (TanStack Virtual or react-window).

### Images & Core Web Vitals

- Always specify `width` and `height` to prevent CLS. Use `loading="lazy"` for below-the-fold images.
- **LCP**: Preload critical images/fonts. Use SSR or Server Components.
- **INP**: Use `useTransition` for heavy updates. Reduce client JS with Server Components.
- **CLS**: Reserve space for dynamic content. Specify image dimensions.

---

## 7. Data Fetching

### Client-Side

- Use TanStack Query for all API state: caching, background refetching, loading/error states, optimistic updates.
- Use `queryKey` arrays that include all parameters affecting the query.
- For mutations, use `useMutation` with `onSuccess` that calls `invalidateQueries`.

### Server-Side (React 19+ / Next.js)

- Server Components fetch data directly with `async/await` — zero client JS.
- Use Server Actions (`'use server'`) for mutations. Use `useActionState` for form state, `useOptimistic` for immediate UI feedback, `useFormStatus` for submit button loading.

### Loading & Error States

- Wrap async components in `<Suspense fallback={...}>`. Use granular boundaries.
- Wrap in `<ErrorBoundary>` to catch render errors. Use `react-error-boundary` library.

---

## 8. Forms

### Simple Forms

- React 19: `<form action={serverAction}>` + `useActionState` + `useFormStatus`.
- Client-only simple forms: controlled inputs with `useState`.

### Complex Forms

- React Hook Form + Zod for client-side forms with complex validation.

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

## 9. Accessibility

### Semantic HTML First

- Use `<button>`, `<a>`, `<nav>`, `<main>`, `<article>`, `<section>` — not `<div>` with roles.
- Every `<img>` must have `alt`. Decorative images use `alt=""`.
- Every form input must have an associated `<label>`.

### Keyboard & Focus

- All interactive elements must be keyboard-accessible (Tab, Enter, Space, Escape, Arrow keys).
- Never remove `:focus` outlines without a visible alternative. Prefer `:focus-visible`.
- Implement focus traps for modals. Move focus to dialog on open; return on close.

### ARIA

- Prefer semantic HTML over ARIA. Use `aria-label` for elements without visible text.
- Use `aria-live="polite"` for dynamic content changes. Use `aria-hidden="true"` on decorative elements.
- Provide skip links for main content.

### Testing

- Use `eslint-plugin-jsx-a11y` and `jest-axe`. Query by role first in tests.

---

## 10. Testing

"The more your tests resemble the way your software is used, the more confidence they give you."

### Query Priority

1. `getByRole` → 2. `getByLabelText` → 3. `getByPlaceholderText` → 4. `getByText` → 5. `getByTestId` (last resort)

### Patterns

- Use `@testing-library/user-event` over `fireEvent`.
- Use `findBy*` (async) for elements appearing after state changes.
- Test behavior, not implementation. Don't assert on internal state or DOM structure.
- Prefer integration tests. Use MSW for API mocking. Follow Arrange-Act-Assert.

---

## 11. Security

- React escapes JSX by default. Never use `dangerouslySetInnerHTML` without DOMPurify.
- Validate URLs in `href` — reject `javascript:` protocol. Only allow `http:` and `https:`.
- Don't store sensitive data in React state. Implement CSP headers.

---

## 12. Legacy Patterns to Avoid

- **Class components**: Only for error boundaries (no hook equivalent for `componentDidCatch`). Use `react-error-boundary` to avoid even that.
- **PropTypes**: Silently ignored in React 19 — use TypeScript.
- **`defaultProps` on function components**: Removed in React 19 — use ES6 default parameters.
- **Legacy Context API** (`contextType`, `Consumer`): Removed in React 19.
- **HOCs / render props for logic reuse**: Superseded by custom hooks. Render props remain valid for headless UI patterns.

---

## 13. Code Quality Checklist

When writing or reviewing React + TypeScript code, verify:

- [ ] No `any` types. No unnecessary `as` casts.
- [ ] No useEffect for derived state, event handling, or data fetching.
- [ ] State is colocated — not lifted higher than necessary.
- [ ] Derived values computed during render, not synced via useEffect.
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

## 14. File Structure (Feature-Based)

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
