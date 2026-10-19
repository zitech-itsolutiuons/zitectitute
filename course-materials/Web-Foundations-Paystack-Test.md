# Web Foundations: Build a Responsive Learning Page

## Course description

Learn how HTML, CSS, and JavaScript work together to create a useful, accessible web page. By the end, you will build and test a small responsive course landing page with a working lesson list and progress indicator.

## Intended audience

Beginners who can use a web browser and text editor. No programming experience is required.

## Learning outcomes

By the end of this course, learners will be able to:

- Explain the role of HTML, CSS, and JavaScript in a web page.
- Structure content with semantic HTML elements.
- Style a page with CSS, including a responsive layout.
- Use JavaScript values, functions, and event listeners.
- Update page content in response to a user action.
- Inspect and fix common browser errors.

## Chapter 1: How a web page works

### The three parts of a page

A browser turns source files into the page you see and use. HTML describes the content and its meaning. CSS controls how that content looks and how it is arranged. JavaScript adds behavior, such as opening a menu or updating a progress count.

These jobs are related, but they are not interchangeable. A heading should be a heading in HTML, not merely large text made with CSS. A button should be a real button, not a styled paragraph with a click handler. Clear structure gives browsers, assistive technology, and future developers useful information.

### Files and the browser

A simple project can start with three files in one folder:

- `index.html` contains the page structure.
- `styles.css` contains presentation rules.
- `script.js` contains interactive behavior.

The HTML file connects the other two files. When you open `index.html` in a browser, the browser reads the HTML, downloads or opens the linked CSS and JavaScript, and builds the page. If a linked filename is misspelled or stored in a different folder, that resource will not load.

### A first document

An HTML document begins with a doctype declaration and has a root `html` element. The `head` contains information about the document, such as its title and character encoding. The `body` contains the content people read and use.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Web Foundations</title>
    <link rel="stylesheet" href="styles.css">
    <script src="script.js" defer></script>
  </head>
  <body>
    <h1>Learn by building</h1>
    <p>HTML gives this text its structure.</p>
  </body>
</html>
```

The `lang` attribute identifies the language of the document. The viewport setting helps a mobile browser use the device width instead of pretending it has a desktop-sized canvas. The `defer` attribute lets the browser finish parsing the HTML before it runs the script.

### Practice

Create the three project files. Put the example document in `index.html`, then open it in a browser. Change the title shown in the browser tab and the main heading shown on the page. Check that the file paths in the `link` and `script` elements match your filenames exactly.

### Check your understanding

1. Which language describes a page's structure?
2. Why should the page include a viewport meta element?
3. What does `defer` change about when an external script runs?

## Chapter 2: Give content meaning with HTML

### Semantic structure

Semantic HTML uses elements according to their meaning. A page's main heading belongs in an `h1`; supporting sections may use `h2` and `h3` headings in a sensible hierarchy. A `main` element identifies the central content. A `nav` element groups important navigation links. A `button` represents an action, while an `a` element takes someone to another location.

Meaningful elements improve navigation for people using screen readers and make the source easier to understand. Do not choose an element only because its default appearance looks convenient. CSS can change appearance without changing meaning.

```html
<header>
  <a href="/">Zitechurity Techtitute</a>
  <nav aria-label="Main navigation">
    <a href="#lessons">Lessons</a>
    <a href="#about">About this course</a>
  </nav>
</header>

<main>
  <section aria-labelledby="course-title">
    <h1 id="course-title">Build your first learning page</h1>
    <p>Practice HTML, CSS, and JavaScript in one small project.</p>
    <a href="#lessons">Explore the lessons</a>
  </section>
</main>
```

The `aria-label` gives this navigation landmark a name, which is useful if a page has more than one navigation area. Prefer native HTML semantics first; add ARIA only when it supplies information that native elements do not already provide.

### Links, buttons, and images

Use a link when the result is navigation: opening another page, moving to a section, or downloading a resource. Use a button when the user performs an action on the current page, such as marking a lesson complete. Both elements work with a keyboard by default.

An informative image needs alternative text that conveys its purpose. A decorative image that adds no useful information should use an empty `alt` value so assistive technology can skip it. Do not put important instructions only in an image.

```html
<img src="lesson-map.png" alt="Diagram showing the three lessons in this module">
<img src="paper-texture.png" alt="">
```

### Lists and forms

Use lists for groups of related items. Use a `label` connected to each form field so the field remains understandable when its placeholder disappears or the field receives keyboard focus. Placeholders are examples, not replacements for labels.

```html
<label for="learner-name">Your name</label>
<input id="learner-name" name="learnerName" autocomplete="name">
<button type="submit">Save name</button>
```

### Practice

Add a header, navigation, main section, a list of three lessons, and a footer to your page. Use one `h1`, then headings in order for the sections beneath it. Add a link that moves to the lesson list and a button whose label describes an action. Use the browser's keyboard navigation to check that links and buttons can receive focus.

### Check your understanding

1. When should you use a button instead of a link?
2. Why is a visible label better than relying on placeholder text?
3. What should alternative text communicate for an informative image?

## Chapter 3: Style the page with CSS

### Rules and selectors

CSS rules match HTML elements and assign values to visual properties. A selector chooses what to style. A declaration pairs a property with a value.

```css
body {
  color: #20312b;
  font-family: system-ui, sans-serif;
  line-height: 1.6;
}

main {
  width: min(100% - 2rem, 68rem);
  margin-inline: auto;
}
```

The `body` selector applies to the document body. The `main` selector applies to the main content area. CSS properties such as `color`, `font-family`, `line-height`, `width`, and `margin-inline` control different aspects of presentation.

### The box model

Every element occupies a box. The content is surrounded by padding, a border, and margin. Padding adds room inside the border; margin separates the element from other boxes. The default content-box sizing can make declared widths harder to reason about, so many projects use `box-sizing: border-box`.

```css
*,
*::before,
*::after {
  box-sizing: border-box;
}

.lesson-link {
  display: block;
  padding: 1rem;
  border: 1px solid #ccd5ce;
  margin-block: 0.75rem;
}
```

Classes let you apply a style to a purposeful group of elements. A class name such as `lesson-link` describes the element's role more clearly than a name based on a temporary color choice.

### Layout with Flexbox and Grid

Flexbox is useful when arranging items along one dimension, such as a navigation row or a row that wraps. Grid is useful when arranging content in rows and columns. Both tools can adapt when the available space changes.

```css
.lesson-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr));
  gap: 1rem;
}
```

This grid creates as many columns as will fit while keeping each column at least a comfortable width. It can wrap without hard-coding a separate layout for every screen size.

### Practice

Add a stylesheet link to your HTML. Choose a readable text color, a comfortable line height, and a centered content width. Use Grid for the lesson list. Give links and buttons clear hover and keyboard-focus states; do not remove the browser's focus indicator unless you replace it with one that is equally visible.

### Check your understanding

1. What does padding change, and how is it different from margin?
2. When might Grid be a better fit than Flexbox?
3. Why should keyboard focus remain visible?

## Chapter 4: Make the layout responsive and accessible

### Start with the content

Responsive design allows a page to work across different viewport sizes, input methods, and text settings. Start with a layout that works in a narrow viewport, then add changes when the content needs more room. Avoid assuming that every phone, tablet, or laptop has the same dimensions.

Flexible widths, wrapping layouts, and readable line lengths reduce the need for device-specific rules. Use relative units such as `rem` for spacing and text where appropriate. Avoid fixed heights around text: learners may zoom their browser or use larger text, and content must still be able to grow.

### Media queries

A media query applies styles when a condition is true. Add a breakpoint where the content no longer fits well, rather than choosing one because a device label suggests it.

```css
.site-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

@media (min-width: 48rem) {
  .course-intro {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(16rem, 0.7fr);
    gap: 3rem;
    align-items: start;
  }
}
```

The base header can wrap when space is limited. The wider course introduction uses two columns only when the viewport can support them.

### Accessibility checks

Readable contrast helps people see text. Do not use color alone to explain a state; pair color with text, an icon, or another clear cue. Every interactive control needs a meaningful name. Keyboard users should be able to reach controls in a logical order and see which one is focused.

Check the page at a narrow width and at a wider desktop width. Zoom in and confirm content remains available. Navigate using Tab and Shift+Tab. If you add animation, ensure the page remains usable when a visitor prefers reduced motion.

### Practice

Make your header and lesson list adapt to a narrow viewport without horizontal scrolling. Add a visible focus style to each interactive control. Test the page at a narrow window width, then zoom to 200% and verify headings, lessons, and actions remain available.

### Check your understanding

1. What should determine where a responsive breakpoint belongs?
2. Why should an interface not rely on color alone to communicate state?
3. What is one way to test a page without using a mouse?

## Chapter 5: Add behavior with JavaScript

### Values and variables

JavaScript can store information and use it to decide what happens next. A `const` variable names a value that will not be reassigned. A `let` variable can be reassigned when the program needs to update it. Use names that communicate what the value represents.

```js
const lessonCount = 3;
let completedLessons = 0;
```

Values have types. Strings represent text, numbers represent numeric quantities, and booleans represent `true` or `false`. Arrays hold ordered collections; objects group related named values.

```js
const lessons = [
  { title: "Structure with HTML", complete: false },
  { title: "Style with CSS", complete: false },
  { title: "Add interaction", complete: false },
];
```

### Functions and decisions

A function packages work that can be called by name. Parameters supply input, and a return value can send a result back to the caller. An `if` statement chooses between actions based on a condition.

```js
function completionMessage(completed, total) {
  if (total === 0) {
    return "No lessons are available yet.";
  }
  return `${completed} of ${total} lessons complete`;
}
```

The strict equality operator `===` compares values without automatically converting between different types. Clear conditions make code easier to reason about.

### Practice

In `script.js`, create an array of three lesson titles and a function that returns a message with the completed lesson count. Call the function and show its result in the browser console. Open the developer tools and inspect the output.

### Check your understanding

1. When is `let` appropriate instead of `const`?
2. What is a parameter?
3. Why is strict equality often easier to reason about than loose equality?

## Chapter 6: Connect JavaScript to the page

### Select elements and listen for actions

The Document Object Model (DOM) is the browser's structured representation of the page. JavaScript can find an element, listen for an event, and update that element. A real button can be activated with a mouse, keyboard, or assistive technology, so prefer native controls over custom clickable elements.

Add an element for progress and a button for marking a lesson complete:

```html
<p id="lesson-progress" aria-live="polite">0 of 3 lessons complete</p>
<button id="complete-lesson" type="button">Mark first lesson complete</button>
```

Then select those elements and respond to a click:

```js
const progress = document.querySelector("#lesson-progress");
const completeButton = document.querySelector("#complete-lesson");
let completedLessons = 0;
const totalLessons = 3;

completeButton.addEventListener("click", () => {
  completedLessons = Math.min(completedLessons + 1, totalLessons);
  progress.textContent = `${completedLessons} of ${totalLessons} lessons complete`;
  completeButton.disabled = completedLessons === totalLessons;
});
```

The event listener waits for a click. The update changes the text in the page, and the disabled state prevents the count from exceeding the total. The `aria-live` attribute asks assistive technology to announce a change to the progress text.

### Debug with the browser

If an interaction does not work, check the browser console for errors. Confirm that the HTML IDs match the selectors in JavaScript, that the script file loaded, and that the script runs after the relevant HTML exists. Read the first error message carefully; later errors may be consequences of the first one.

Test the button with a mouse and with the keyboard. Confirm that the page announces or visibly displays the updated progress. Reload the page and observe whether the count resets; this example intentionally keeps progress in memory only.

### Capstone: a responsive learning page

Bring the lessons together in one page:

1. Use semantic HTML for the page header, navigation, main content, lesson list, and footer.
2. Use CSS to create a readable layout that adapts to a narrow screen.
3. Add a JavaScript button that updates the lesson progress.
4. Check headings, labels, keyboard focus, contrast, and responsive behavior.
5. Fix any console errors and verify the button cannot count beyond the available lessons.

### Check your understanding

1. What does `querySelector` return when it finds a matching element?
2. Why does the example disable the button after all lessons are complete?
3. Where should you look first when JavaScript reports an error?

## Final review

You have used HTML to describe content, CSS to shape its presentation, and JavaScript to respond to an action. Review the capstone against the learning outcomes: the result should have meaningful structure, work at different widths, support keyboard interaction, and show accurate progress. These habits transfer to larger learning applications and make future changes easier.
