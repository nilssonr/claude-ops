---
name: storybook-components
description: >-
  Expert guidance for building UI components with Storybook, shadcn/ui, Tailwind CSS v4, tweakcn,
  compound components, and CVA variants.
  TRIGGER when: writing stories, creating reusable components, working with shadcn/ui, using
  Tailwind CSS, building component libraries, or writing .stories.tsx files.
  DO NOT TRIGGER when: working on non-UI code, backend logic, or general React without component
  library concerns.
user-invocable: true
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
---

**Announce to the user: "Skill activated: storybook-components"**

# Storybook + UI Components — Best Practices Guide

You are an expert in building reusable, idiomatic React UI components with Storybook, shadcn/ui, Tailwind CSS v4, and TypeScript. Follow these rules when writing components, stories, or working with these tools.

---

## 1. Tailwind CSS v4 — Critical Changes from v3

Tailwind v4 is a major rewrite. **Do not use v3 patterns.**

### Configuration is CSS-First

There is no `tailwind.config.js`. All configuration lives in CSS:

```css
@import "tailwindcss";

@theme {
  --color-brand: oklch(0.62 0.223 29.23);
  --font-display: "Satoshi", sans-serif;
  --radius-card: 0.75rem;
  --spacing-section: 4rem;
}
```

`@theme` variables automatically generate both CSS custom properties AND utility classes (`bg-brand`, `font-display`, `rounded-card`, `p-section`).

### Renamed Utilities

| v3 (do NOT use) | v4 (use this) |
|---|---|
| `bg-gradient-to-r` | `bg-linear-to-r` |
| `bg-opacity-50` | `bg-black/50` |
| `flex-grow-0` / `flex-shrink-1` | `grow-0` / `shrink-1` |
| `overflow-ellipsis` | `text-ellipsis` |
| `shadow-sm`, `blur-sm`, `rounded-sm` | `shadow-xs`, `blur-xs`, `rounded-xs` |
| `ring` (3px default) | `ring` (1px) — use `ring-3` for 3px |
| `outline-none` (on focus) | `outline-hidden` |
| `!flex` (important prefix) | `flex!` (important postfix) |
| `transform-none` | `scale-none`, `rotate-none` (reset individually) |

### Key v4 Features

- **Single import**: `@import "tailwindcss"` replaces `@tailwind base/components/utilities`
- **Container queries built-in**: `@container` + `@sm:`, `@lg:` — no plugin needed
- **Dark mode automatic**: `dark:` works via `prefers-color-scheme` with zero config
- **Descendant styling**: `*:font-bold` styles all children
- **Text shadows**: `text-shadow-lg`, `text-shadow-sky-300`
- **3D transforms**: `perspective-distant`, `rotate-x-51`, `transform-3d`
- **Radial/conic gradients**: `bg-radial-[at_25%_25%]`, `bg-conic/[in_hsl]`
- **Color space control**: `bg-linear-to-r/oklch`
- **Automatic content detection**: no `content` array needed, respects `.gitignore`

### Source Control

Override content detection when needed:

```css
@source "../node_modules/@my-company/ui-lib";
@source not "./src/legacy";
```

### Extending vs Replacing Theme Tokens

```css
/* Extend (keep defaults + add new) */
@theme {
  --color-brand: oklch(0.62 0.223 29.23);
}

/* Replace entire namespace (remove all defaults) */
@theme {
  --color-*: initial;
  --color-white: #fff;
  --color-brand: #3f3cbb;
}
```

---

## 2. shadcn/ui Architecture

### Core Principles

- shadcn/ui is a **code distribution system**, not an npm package. Components are copied into your project with `npx shadcn@latest add <component>`.
- Built on **Radix UI** primitives (accessibility, keyboard nav, focus management) + **Tailwind CSS** styling.
- You own the code. Customize freely.

### Directory Organization — Three Layers

| Layer | Path | Purpose |
|---|---|---|
| **Primitives** | `components/ui/` | shadcn-generated components. Treat as read-only when possible. |
| **Composed** | `components/shared/` | Your wrappers that compose primitives for application needs. |
| **Blocks** | `components/blocks/` | Page-level compositions (dashboard, auth flow, settings). |

### The `cn()` Utility

```typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

Always use `cn()` to merge class names in components. It resolves Tailwind conflicts — `cn("p-2", "p-4")` outputs `"p-4"`. Works with tailwind-merge v4 support.

### Wrap by Default, Extend When Necessary

- **Wrap**: Create a component in `components/shared/` that renders a shadcn primitive with additional styling or behavior. Keeps `components/ui/` pristine for easy updates.
- **Extend**: Edit `components/ui/` directly only when fundamentally changing core behavior.
- Use `npx shadcn@latest diff <component>` to check for upstream changes.

### asChild Pattern (from Radix)

Render a component as a different element while keeping behavior:

```tsx
<Button asChild>
  <Link href="/dashboard">Go to Dashboard</Link>
</Button>
```

When `asChild` is true, the component merges its props/behavior onto its child via a Slot component. The child must forward refs.

---

## 3. Class Variance Authority (CVA)

CVA provides type-safe variant management for component styling.

### Defining Variants

```typescript
import { cva, type VariantProps } from "class-variance-authority";

const buttonVariants = cva(
  // Base classes (always applied)
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    compoundVariants: [
      { variant: "outline", size: "sm", className: "h-8 px-2" },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);
```

### Using Variants in Components

```typescript
interface ButtonProps
  extends React.ComponentPropsWithoutRef<"button">,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  )
);
```

### CVA Rules

- Each variant property should have a single responsibility.
- Use `compoundVariants` for cross-variant rules instead of creating exponential combinations.
- Always set `defaultVariants` for ergonomic base cases.
- Use `VariantProps<typeof variants>` to auto-generate prop types.

---

## 4. Compound Components

### When to Use

Use compound components for multi-part UI where sub-components share implicit state: Tabs, Accordion, Dialog, Select, Menu, Form, RadioGroup, DataTable.

**Do not use** for simple components, components where users `.map()` data items, or single-responsibility components without sub-parts.

### The Pattern: Context + Namespace

```typescript
import { createContext, useContext, useState, useMemo, type ReactNode } from "react";

// 1. Define context type
interface TabsContextType {
  value: string;
  onValueChange: (value: string) => void;
}

const TabsContext = createContext<TabsContextType | undefined>(undefined);

// 2. Custom hook with error boundary
function useTabs() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("useTabs must be within <Tabs>");
  return ctx;
}

// 3. Root component provides context
interface TabsProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
}

function Tabs({ value, defaultValue = "", onValueChange, children }: TabsProps) {
  const [internal, setInternal] = useState(defaultValue);
  const isControlled = value !== undefined;
  const current = isControlled ? value : internal;

  const ctx = useMemo(() => ({
    value: current,
    onValueChange: (v: string) => {
      if (!isControlled) setInternal(v);
      onValueChange?.(v);
    },
  }), [current, isControlled, onValueChange]);

  return (
    <TabsContext.Provider value={ctx}>
      <div>{children}</div>
    </TabsContext.Provider>
  );
}

// 4. Sub-components consume context
function TabsTrigger({ value, children }: { value: string; children: ReactNode }) {
  const { value: active, onValueChange } = useTabs();
  return (
    <button role="tab" aria-selected={active === value} onClick={() => onValueChange(value)}>
      {children}
    </button>
  );
}

function TabsContent({ value, children }: { value: string; children: ReactNode }) {
  const { value: active } = useTabs();
  if (active !== value) return null;
  return <div role="tabpanel">{children}</div>;
}

function TabsList({ children }: { children: ReactNode }) {
  return <div role="tablist">{children}</div>;
}

// 5. Attach sub-components to parent (namespace pattern)
Tabs.List = TabsList;
Tabs.Trigger = TabsTrigger;
Tabs.Content = TabsContent;
```

### Usage

```tsx
<Tabs defaultValue="tab1">
  <Tabs.List>
    <Tabs.Trigger value="tab1">Tab 1</Tabs.Trigger>
    <Tabs.Trigger value="tab2">Tab 2</Tabs.Trigger>
  </Tabs.List>
  <Tabs.Content value="tab1">Content 1</Tabs.Content>
  <Tabs.Content value="tab2">Content 2</Tabs.Content>
</Tabs>
```

### Compound Component Rules

- Always use Context-based approach (not `React.Children.map` / `cloneElement` — that's legacy).
- `useMemo` the context value to prevent unnecessary re-renders.
- Support both controlled (`value` + `onValueChange`) and uncontrolled (`defaultValue`) modes.
- Custom hooks must throw if context is undefined — never return `undefined` silently.
- For performance-sensitive cases, split context into state context + dispatch context.
- Use `data-state="open"` / `data-state="closed"` attributes for CSS styling hooks.

### Namespace Pattern with TypeScript

```typescript
// Using Object.assign for proper typing
const Dialog = Object.assign(DialogRoot, {
  Trigger: DialogTrigger,
  Content: DialogContent,
  Close: DialogClose,
});
```

Or with an explicit interface:

```typescript
interface DialogComponent {
  (props: DialogRootProps): JSX.Element;
  Trigger: React.FC<DialogTriggerProps>;
  Content: React.FC<DialogContentProps>;
  Close: React.FC<DialogCloseProps>;
}
```

---

## 5. shadcn/ui Theming

### CSS Variables

shadcn uses semantic CSS variables consumed by Tailwind:

```css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --destructive: 0 84.2% 60.2%;
    --border: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    /* ... dark overrides */
  }
}
```

Components reference these via Tailwind: `bg-background`, `text-foreground`, `bg-primary`, `border-border`.

### tweakcn for Theme Customization

tweakcn (https://tweakcn.com) is a visual no-code theme editor for shadcn/ui:

- Generates exportable CSS variables compatible with shadcn.
- Supports Tailwind v3 and v4 (`@theme` directive syntax).
- Uses OKLCh color model for perceptually uniform colors.
- AI-powered theme generation from text prompts or image uploads.
- Provides preset themes as starting points.

**Workflow**: Design in tweakcn -> Export CSS variables -> Paste into your `globals.css` -> All shadcn components automatically consume them.

---

## 6. Storybook (v8+)

### Setup: React + TypeScript + Vite

```typescript
// .storybook/main.ts
import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  framework: "@storybook/react-vite",
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(ts|tsx)"],
  addons: [
    "@storybook/addon-essentials",
    "@storybook/addon-interactions",
    "@storybook/addon-a11y",
  ],
  docs: { autodocs: true },
  typescript: {
    check: true,
    reactDocgen: "react-docgen",
  },
};
export default config;
```

```typescript
// .storybook/preview.ts
import type { Preview } from "@storybook/react";
import "../src/index.css"; // Import global styles + Tailwind

const preview: Preview = {
  parameters: {
    layout: "centered",
    controls: {
      matchers: { color: /(background|color)$/i, date: /Date$/ },
    },
  },
  tags: ["autodocs"],
};
export default preview;
```

### CSF3 Story Format

Always use CSF3 with the `satisfies` operator for type safety:

```typescript
import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button";

const meta = {
  component: Button,
  title: "UI/Button",
  tags: ["autodocs"],
  args: {
    children: "Click me",
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "destructive", "outline", "secondary", "ghost", "link"],
      table: { category: "Styling" },
    },
    size: {
      control: "select",
      options: ["default", "sm", "lg", "icon"],
    },
    disabled: { control: "boolean" },
    onClick: { action: "clicked" },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { variant: "default" },
};

export const Destructive: Story = {
  args: { variant: "destructive", children: "Delete" },
};

export const Outline: Story = {
  args: { variant: "outline" },
};

export const Small: Story = {
  args: { ...Default.args, size: "sm" },
};

export const Disabled: Story = {
  args: { ...Default.args, disabled: true },
};
```

### Story Rules

- **One story per meaningful state**: Default, each variant, disabled, loading, error, empty.
- **Compose args**: Spread from base stories — `args: { ...Default.args, size: "lg" }`.
- **Naming**: PascalCase story names. Title hierarchy: `"Category/Subcategory/Component"`.
- **Colocate**: Place `Button.stories.tsx` next to `Button.tsx`.

### Play Functions for Interaction Testing

```typescript
import { expect, within, userEvent, fn } from "@storybook/test";

export const FormSubmission: Story = {
  args: { onSubmit: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const user = userEvent.setup();

    await user.type(canvas.getByLabelText("Email"), "test@example.com");
    await user.click(canvas.getByRole("button", { name: /submit/i }));

    await expect(args.onSubmit).toHaveBeenCalled();
  },
};
```

### Decorators for Context Providers

```typescript
// .storybook/preview.tsx — global decorators
const preview: Preview = {
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <Story />
        </ThemeProvider>
      </QueryClientProvider>
    ),
  ],
};
```

Story-level decorators for layout:

```typescript
export const InDialog: Story = {
  decorators: [
    (Story) => (
      <div className="flex items-center justify-center min-h-[400px]">
        <Story />
      </div>
    ),
  ],
};
```

### Stories for Compound Components

Use `render` to show composition:

```typescript
export const BasicTabs: Story = {
  render: () => (
    <Tabs defaultValue="tab1">
      <TabsList>
        <TabsTrigger value="tab1">Tab 1</TabsTrigger>
        <TabsTrigger value="tab2">Tab 2</TabsTrigger>
      </TabsList>
      <TabsContent value="tab1">Content 1</TabsContent>
      <TabsContent value="tab2">Content 2</TabsContent>
    </Tabs>
  ),
};

export const Controlled: Story = {
  render: function Render() {
    const [value, setValue] = useState("tab1");
    return (
      <Tabs value={value} onValueChange={setValue}>
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>
    );
  },
};

export const WithDisabledTab: Story = {
  render: () => (
    <Tabs defaultValue="tab1">
      <TabsList>
        <TabsTrigger value="tab1">Enabled</TabsTrigger>
        <TabsTrigger value="tab2" disabled>Disabled</TabsTrigger>
      </TabsList>
      <TabsContent value="tab1">Content</TabsContent>
    </Tabs>
  ),
};
```

### All Variants Showcase Story

Write a story that renders all variants in one view for visual review:

```typescript
export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      {(["default", "secondary", "outline", "ghost", "destructive", "link"] as const).map(
        (variant) => (
          <Button key={variant} variant={variant}>
            {variant}
          </Button>
        )
      )}
    </div>
  ),
};
```

---

## 7. Component Design Patterns

### Extending Native HTML Elements

Always extend native element props so consumers can pass standard attributes:

```typescript
interface InputProps extends React.ComponentPropsWithoutRef<"input"> {
  label?: string;
  error?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, ...props }, ref) => (
    <div>
      {label && <label>{label}</label>}
      <input ref={ref} className={cn("...", className)} {...props} />
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  )
);
```

### Polymorphic Components

```typescript
interface BoxProps<C extends React.ElementType> {
  as?: C;
  children?: React.ReactNode;
}

type Props<C extends React.ElementType> = BoxProps<C> &
  Omit<React.ComponentPropsWithoutRef<C>, keyof BoxProps<C>>;

function Box<C extends React.ElementType = "div">({ as, ...props }: Props<C>) {
  const Component = as || "div";
  return <Component {...props} />;
}

// TypeScript enforces correct props per element
<Box as="a" href="/path">Link</Box>     // href valid for <a>
<Box as="button" onClick={fn}>Click</Box> // onClick valid for <button>
```

### Headless Hook Pattern

Separate logic from presentation for maximum reuse:

```typescript
function useDisclosure(defaultOpen = false) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return {
    isOpen,
    onOpen: () => setIsOpen(true),
    onClose: () => setIsOpen(false),
    onToggle: () => setIsOpen((v) => !v),
  };
}

// Use with any UI
function MyDialog() {
  const { isOpen, onOpen, onClose } = useDisclosure();
  return (
    <>
      <Button onClick={onOpen}>Open</Button>
      <Dialog open={isOpen} onOpenChange={onClose}>...</Dialog>
    </>
  );
}
```

---

## 8. shadcn/ui Forms

### Standard Pattern: React Hook Form + Zod + shadcn Form

```typescript
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Min 8 characters"),
});

type FormData = z.infer<typeof schema>;

function LoginForm() {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input type="password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Signing in..." : "Sign in"}
        </Button>
      </form>
    </Form>
  );
}
```

---

## 9. Component Quality Checklist

When writing or reviewing UI components:

- [ ] Uses `cn()` for all className merging.
- [ ] Extends native HTML element props via `ComponentPropsWithoutRef<"element">`.
- [ ] Forwards refs with `React.forwardRef`.
- [ ] CVA variants have `defaultVariants` set.
- [ ] Passes `className` through to root element (allows consumer overrides).
- [ ] Spreads remaining `...props` onto the DOM element.
- [ ] Compound components use Context (not `cloneElement`).
- [ ] Context hooks throw if used outside provider.
- [ ] Context value is memoized with `useMemo`.
- [ ] Supports both controlled and uncontrolled modes where applicable.
- [ ] Stories cover: default, all variants, disabled, loading, error states.
- [ ] Stories use `satisfies Meta<typeof Component>` for type safety.
- [ ] Tailwind classes use v4 syntax (no v3 deprecated names).
- [ ] Uses semantic shadcn color tokens (`bg-primary`, not `bg-blue-600`).
- [ ] Accessible: proper roles, ARIA attributes, keyboard navigation.
