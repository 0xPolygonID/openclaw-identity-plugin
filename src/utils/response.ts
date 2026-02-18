const INSTRUCTION = "";

export function Bold(text: string): string {
  return `**${text}**`;
}

export function Italic(text: string): string {
  return `*${text}*`;
}

export function Strikethrough(text: string): string {
  return `~~${text}~~`;
}

export function Underline(text: string): string {
  return `<u>${text}</u>`;
}

export function Monospace(text: string): string {
  return `\`${text}\``;
}

export function Link(text: string, url: string): string {
  return `[${text}](${url})`;
}

export function Monoblock(
  content: string,
  newLinePrefix: boolean = false,
  newLineSuffix: boolean = false,
): string {
  const prefix = newLinePrefix ? "\n" : "";
  const suffix = newLineSuffix ? "\n" : "";
  return `${prefix}\`\`\`\n${content}\n\`\`\`${suffix}`;
}

/**
 * Build a tool response object with content array
 * Joins multiple strings with newlines
 */
export function Response(...parts: string[]): {
  content: Array<{ type: string; text: string }>;
} {
  const text = parts.join("\n");

  return {
    content: [
      {
        type: "text",
        text: text,
      },
    ],
  };
}

export function ResponseAiInstruction(...parts: string[]): {
  content: Array<{ type: string; text: string }>;
} {
  const text = parts.join("\n");

  return {
    content: [
      {
        type: "text",
        text: `${INSTRUCTION}\n\n${text}`,
      },
    ],
  };
}

export function CommandResponse(...parts: string[]): { text: string } {
  const text = parts.join("\n");

  return {
    text: text,
  };
}

export function CommandResponseAiInstruction(...parts: string[]): {
  text: string;
} {
  const text = parts.join("\n");

  return {
    text: `${INSTRUCTION}\n\n${text}`,
  };
}

export function MultiContentResponse(...parts: string[]): {
  content: Array<{ type: string; text: string }>;
} {
  return {
    content: parts.map((text) => ({
      type: "text",
      text: text,
    })),
  };
}

export function MultiContentResponseAiInstruction(...parts: string[]): {
  content: Array<{ type: string; text: string }>;
} {
  return {
    content: [
      {
        type: "text",
        text: INSTRUCTION,
      },
      ...parts.map((text) => ({
        type: "text",
        text: text,
      })),
    ],
  };
}
