# Design System Strategy: The Pristine Editorial

## 1. Overview & Creative North Star: "The Aquatic Curator"
This design system moves away from the cluttered, utility-first aesthetic of traditional service apps and toward a high-end editorial experience. We are not just building a scheduling tool; we are creating a digital sanctuary of cleanliness.

**Creative North Star: The Aquatic Curator**
The system treats whitespace as a premium commodity. It utilizes "The Aquatic Curator" philosophy—where every element feels buoyant, suspended in a fluid environment of cool blues and mint greens. By breaking the rigid "boxed-in" grid found in generic apps, we use intentional asymmetry, overlapping high-quality photography, and tonal layering to create a sense of professional mastery and effortless efficiency.

---

## 2. Colors: Tonal Depth over Structural Lines
Our palette is a sophisticated gradient of cleanliness. We move beyond "blue for trust" into a tiered system of atmospheric depth.

### The Palette
- **Primary (`#003d9b`)**: Our "Deep Water" anchor. Used for high-level branding and primary actions.
- **Secondary (`#006d37`)**: The "Fresh Mint" accent. Represents growth, cleanliness, and the "Go" signal for scheduling.
- **Surface & Background (`#f6f9ff`)**: A cool-tinted white that prevents screen fatigue and feels fresher than pure hex #FFF.

### The "No-Line" Rule
**Explicit Instruction:** 1px solid borders are strictly prohibited for sectioning. 
Structure must be defined through **Background Color Shifts**. For example, a `surface-container-low` section (for a "Recent Orders" block) should sit directly on a `surface` background without a stroke. The eye should perceive the boundary through the subtle shift in luminance, not a hard line.

### Surface Hierarchy & Nesting
Treat the UI as physical layers of frosted glass.
- **Base Layer:** `surface`
- **Component Layer:** `surface-container-low` or `surface-container-lowest` for cards to create a "lifted" feel.
- **Interactive Layer:** `surface-container-high` for hovered states or active selection.

### The "Glass & Gradient" Rule
To elevate the experience, use **Glassmorphism** for floating headers or navigation bars. Apply `surface` at 80% opacity with a `backdrop-blur` of 20px. 
**Signature Textures:** Use subtle linear gradients for CTAs (e.g., `primary` to `primary-container`) to give buttons a "pill-like" physical volume that invites a touch.

---

## 3. Typography: Editorial Authority
We utilize a triple-typeface system to create an authoritative yet approachable voice.

- **Display & Headlines (Plus Jakarta Sans):** These are our "Editorial" voices. Use large scales (`display-lg` at 3.5rem) with tighter letter-spacing (-2%) to create a premium, magazine-style feel for marketing and section intros.
- **Body & Titles (Inter):** The "Workhorse." Inter provides a neutral, highly readable canvas for service descriptions and logistics. It bridges the gap between the expressive headlines and functional labels.
- **Labels (Work Sans):** Used for micro-copy, status chips, and metadata. Its slightly wider stance ensures legibility at very small sizes (`label-sm` at 0.6875rem).

**Hierarchy Principle:** High-contrast scales (e.g., a `display-sm` headline next to `body-md` text) create the "Zomato-style" discovery feel, guiding the user's eye to the most important service offerings first.

---

## 4. Elevation & Depth: The Layering Principle
We reject the heavy, muddy shadows of the early 2010s.

- **Tonal Layering:** Depth is achieved by "stacking." Place a `surface-container-lowest` card on a `surface-container-low` section. The natural contrast creates a soft lift.
- **Ambient Shadows:** For floating elements like Action Sheets or Modals, use "Natural Light" shadows:
  - **Blur:** 32px to 64px
  - **Opacity:** 4% - 6%
  - **Color:** Use a tinted version of `on-surface` (dark blue-grey) rather than black to maintain the "Aquatic" feel.
- **The "Ghost Border" Fallback:** If a container needs more definition (e.g., on very bright mobile screens), use the `outline-variant` token at **15% opacity**. It should be felt, not seen.

---

## 5. Components

### Cards & Lists
*The "No-Divider" Mandate.*
- **Style:** Cards use `rounded-lg` (1rem) or `rounded-xl` (1.5rem) corners. 
- **Separation:** Never use horizontal rules. Separate list items using `surface-container` shifts or vertical whitespace from the spacing scale.
- **Imagery:** Service cards should use high-quality, desaturated imagery with a slight `secondary` color overlay to unify disparate brand photos.

### Buttons
- **Primary:** Gradient fill (`primary` to `primary-container`), `rounded-full`, with a soft ambient shadow.
- **Secondary:** `surface-container-high` background with `on-primary-fixed-variant` text. No border.
- **Tertiary:** Ghost style—text only, using `primary` color, with a `surface-variant` background appearing only on hover.

### Inputs & Fields
- **Container:** Use `surface-container-lowest`. 
- **Active State:** Change background to `surface-bright` and add a 2px "Ghost Border" of `primary` at 20% opacity. 
- **Labels:** Always use `label-md` (Work Sans) positioned above the field, never as placeholder text.

### Chips (Service Filters)
- **Unselected:** `surface-container-highest` background, no border.
- **Selected:** `secondary` background with `on-secondary` text. The pop of Mint Green signals a fresh selection.

---

## 6. Do's and Don'ts

### Do
- **Do** use asymmetrical layouts for hero sections (e.g., text aligned left, imagery bleeding off the right edge).
- **Do** use large amounts of "Oxygen" (whitespace). If you think there is enough space, add 16px more.
- **Do** use `backdrop-blur` on navigation elements to maintain a sense of context.
- **Do** ensure all touch targets are a minimum of 48x48px, even if the visual element is smaller.

### Don't
- **Don't** use 100% black (`#000000`) for text. Use `on-surface` (`#151c22`) to keep the palette soft and professional.
- **Don't** use 1px dividers to separate content. Use background tonal shifts.
- **Don't** use standard "Drop Shadows." Use the Ambient Shadow specification provided in Section 4.
- **Don't** use sharp corners. Everything in this system should feel "tumbled by water"—soft, rounded, and safe.