"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

const examples = [
  {
    language: "HTML",
    code: "<main>\n  <h1>Ideas start here.</h1>\n  <p>Build your first page.</p>\n</main>",
    previewLabel: "IN THE BROWSER",
    previewTitle: "Ideas start here.",
    previewText: "Build your first page.",
  },
  {
    language: "CSS",
    code: ":root {\n  --accent: #bb8b3e;\n  font-family: sans-serif;\n}",
    previewLabel: "STYLE IN FOCUS",
    previewTitle: "Design with intention.",
    previewText: "Color and type shape the experience.",
  },
  {
    language: "JavaScript",
    code: 'const course = "Web foundations";\nconsole.log(`Now learning: ${course}`);',
    previewLabel: "IN THE CONSOLE",
    previewTitle: "Now learning: Web foundations",
    previewText: "JavaScript brings a page to life.",
  },
  {
    language: "TypeScript",
    code: 'type Lesson = { title: string };\nconst lesson: Lesson = { title: "Type safely" };',
    previewLabel: "TYPE CHECKED",
    previewTitle: "A clearer shape for data.",
    previewText: "Types help catch mistakes earlier.",
  },
  {
    language: "React",
    code: 'function Welcome() {\n  return <h1>Welcome, learner.</h1>;\n}',
    previewLabel: "COMPONENT PREVIEW",
    previewTitle: "Welcome, learner.",
    previewText: "A reusable piece of the interface.",
  },
  {
    language: "Python",
    code: 'def greet(name):\n    return f"Hello, {name}!"\n\nprint(greet("Ada"))',
    previewLabel: "SAMPLE OUTPUT",
    previewTitle: "Hello, Ada!",
    previewText: "A small function, ready to reuse.",
  },
  {
    language: "Java",
    code: 'class Main {\n  public static void main(String[] args) {\n    System.out.println("Hello, world!");\n  }\n}',
    previewLabel: "SAMPLE OUTPUT",
    previewTitle: "Hello, world!",
    previewText: "A first step in a Java program.",
  },
  {
    language: "C",
    code: '#include <stdio.h>\n\nint main(void) {\n  printf("Hello, world!\\n");\n  return 0;\n}',
    previewLabel: "SAMPLE OUTPUT",
    previewTitle: "Hello, world!",
    previewText: "A simple program in C.",
  },
  {
    language: "C++",
    code: '#include <iostream>\n\nint main() {\n  std::cout << "Hello, world!";\n}',
    previewLabel: "SAMPLE OUTPUT",
    previewTitle: "Hello, world!",
    previewText: "A first program in C++.",
  },
  {
    language: "C#",
    code: 'using System;\n\nConsole.WriteLine("Hello, world!");',
    previewLabel: "SAMPLE OUTPUT",
    previewTitle: "Hello, world!",
    previewText: "A clean start with C#.",
  },
  {
    language: "PHP",
    code: '<?php\n$name = "Ada";\necho "Hello, $name!";',
    previewLabel: "SAMPLE OUTPUT",
    previewTitle: "Hello, Ada!",
    previewText: "PHP can bring server-side pages to life.",
  },
  {
    language: "Ruby",
    code: 'def greet(name)\n  "Hello, #{name}!"\nend\n\nputs greet("Ada")',
    previewLabel: "SAMPLE OUTPUT",
    previewTitle: "Hello, Ada!",
    previewText: "Expressive code, one method at a time.",
  },
  {
    language: "Go",
    code: 'package main\n\nimport "fmt"\n\nfunc main() {\n  fmt.Println("Hello, world!")\n}',
    previewLabel: "SAMPLE OUTPUT",
    previewTitle: "Hello, world!",
    previewText: "A concise introduction to Go.",
  },
  {
    language: "Rust",
    code: 'fn main() {\n    let message = "Hello, world!";\n    println!("{message}");\n}',
    previewLabel: "SAMPLE OUTPUT",
    previewTitle: "Hello, world!",
    previewText: "Explore safety and performance with Rust.",
  },
  {
    language: "SQL",
    code: "SELECT title, duration_minutes\nFROM lessons\nWHERE published = TRUE\nORDER BY title;",
    previewLabel: "QUERY RESULT",
    previewTitle: "Find exactly what you need.",
    previewText: "Ask structured questions of your data.",
  },
];

const tokenPattern =
  /^\s*#(?:include|define|if|ifdef|ifndef|endif|pragma)\b.*|<\/?[a-z][^>]*>|\/\/.*|#[\da-f]{3,8}\b|#.*|\/\*.*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b(?:class|public|static|void|int|return|const|let|function|def|print|import|from|new|using|namespace|type|interface|async|await|SELECT|FROM|WHERE|ORDER|BY|TRUE|echo|puts|package|func|fn|mut|var|String|Console|System|main)\b|\b\d+(?:\.\d+)?\b/gi;

function renderCodeLine(line: string) {
  const parts: ReactNode[] = [];
  let cursor = 0;

  for (const match of line.matchAll(tokenPattern)) {
    const value = match[0];
    const start = match.index ?? 0;
    if (start > cursor) parts.push(line.slice(cursor, start));
    const className = value.startsWith("<")
      ? "code-example__tag"
      : /^#(?:include|define|if|ifdef|ifndef|endif|pragma)\b/i.test(value)
        ? "code-example__keyword"
        : /^#[\da-f]{3,8}$/i.test(value)
          ? "code-example__color"
        : value.startsWith("//") || value.startsWith("#") || value.startsWith("/*")
          ? "code-example__comment"
        : /^["'`]/.test(value)
          ? "code-example__string"
          : /^\d/.test(value)
            ? "code-example__number"
            : "code-example__keyword";
    parts.push(<span key={`${start}-${value}`} className={className}>{value}</span>);
    cursor = start + value.length;
  }

  if (cursor < line.length) parts.push(line.slice(cursor));
  return parts;
}

export default function CodeShowcase({ label }: { label: string }) {
  const showcaseRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(true);
  const [pageVisible, setPageVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [exampleIndex, setExampleIndex] = useState(0);
  const [visibleCharacters, setVisibleCharacters] = useState(0);
  const example = examples[exampleIndex];
  const visibleCode = example.code.slice(0, visibleCharacters);
  const outputReady = visibleCharacters >= example.code.length;
  const lines = useMemo(() => visibleCode.split("\n"), [visibleCode]);
  const title = label.replace(/\bHTML\b/i, example.language);

  useEffect(() => {
    const element = showcaseRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => setActive(entry.isIntersecting),
      { rootMargin: "80px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const updateVisibility = () => setPageVisible(!document.hidden);
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => setReducedMotion(motionPreference.matches);
    updateVisibility();
    updateMotionPreference();
    document.addEventListener("visibilitychange", updateVisibility);
    motionPreference.addEventListener("change", updateMotionPreference);
    return () => {
      document.removeEventListener("visibilitychange", updateVisibility);
      motionPreference.removeEventListener("change", updateMotionPreference);
    };
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      setVisibleCharacters(example.code.length);
      return;
    }
    if (!active || !pageVisible) return;
    let timeout: ReturnType<typeof setTimeout>;
    if (visibleCharacters >= example.code.length) {
      timeout = setTimeout(() => {
        const nextIndex = (exampleIndex + 1) % examples.length;
        setExampleIndex(nextIndex);
        setVisibleCharacters(0);
      }, 2200);
    } else {
      timeout = setTimeout(() => setVisibleCharacters((count) => count + 1), 26);
    }
    return () => clearTimeout(timeout);
  }, [active, pageVisible, reducedMotion, exampleIndex, example.code.length, visibleCharacters]);

  return (
    <div ref={showcaseRef} className="code-example overflow-hidden rounded-xl" role="region" aria-label="Programming language code showcase">
      <div className="code-example__toolbar flex items-center justify-between gap-4 border-b px-5 py-4">
        <span className="text-sm font-medium">{title}</span>
        <span className="code-example__language">{example.language}</span>
      </div>

      <pre className="code-example__source">
        <code>
          {lines.map((line, index) => (
            <span key={index} className="code-example__line">
              <span className="code-example__line-number">{index + 1}</span>
              <span>
                {renderCodeLine(line)}
                {index === lines.length - 1 && !reducedMotion && visibleCharacters < example.code.length && (
                  <span className="code-example__cursor" />
                )}
              </span>
            </span>
          ))}
        </code>
      </pre>

      <div
        aria-hidden={!outputReady}
        className={`code-example__preview${outputReady ? "" : " code-example__preview--pending"}`}
      >
        <p className="code-example__preview-label">{example.previewLabel}</p>
        <h2>{example.previewTitle}</h2>
        <p>{example.previewText}</p>
        <span aria-hidden="true" className="code-example__preview-rule" />
      </div>
    </div>
  );
}
