import type { ServerSettings } from "@t3tools/contracts";

import { Input } from "../ui/input";

type WritingStyle = ServerSettings["sourceControlWritingStyle"];
type RulesFileField = "commitInstructionsFile" | "changeRequestInstructionsFile";

const RULES_FILE_FIELDS: ReadonlyArray<{ field: RulesFileField; label: string }> = [
  { field: "commitInstructionsFile", label: "Commit rules file" },
  { field: "changeRequestInstructionsFile", label: "Pull request rules file" },
];

export function SourceControlRulesFiles(props: {
  style: WritingStyle;
  onChange: (patch: Partial<Record<RulesFileField, string>>) => void;
}) {
  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs text-muted-foreground">
        Absolute paths on this environment, read on every generation. A file that can't be read
        falls back to the instructions above.
      </p>
      {RULES_FILE_FIELDS.map(({ field, label }) => (
        <label key={field} className="flex flex-col gap-1 text-sm">
          <span>{label}</span>
          <Input
            key={props.style[field]}
            size="sm"
            defaultValue={props.style[field]}
            placeholder="~/.claude/skills/my-skill/references/rules.md"
            aria-label={label}
            onBlur={(event) => {
              const value = event.target.value.trim();
              if (value !== props.style[field]) props.onChange({ [field]: value });
            }}
          />
        </label>
      ))}
    </div>
  );
}
