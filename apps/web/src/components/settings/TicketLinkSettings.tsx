import type { TicketLinkSettings as TicketLinkSettingsValue } from "@t3tools/contracts";
import { useRef } from "react";

import { Input } from "../ui/input";
import { SettingResetButton, SettingsRow } from "./settingsLayout";
import { useSettingsScope } from "./SettingsScopeContext";
import { searchableSetting, type SettingsSearchItemId } from "./settingsSearch";
import {
  useScopedSettings,
  useScopedSettingsMixed,
  useUpdateScopedSettings,
} from "./useScopedSettings";

interface TicketLinkField {
  readonly searchId: SettingsSearchItemId;
  readonly label: string;
  readonly description: string;
  readonly placeholder: string;
  readonly format: (settings: TicketLinkSettingsValue) => string;
  readonly patch: (text: string) => Partial<TicketLinkSettingsValue>;
}

const FIELDS: ReadonlyArray<TicketLinkField> = [
  {
    searchId: "ticket-links-linear-workspace",
    label: "Linear workspace",
    description:
      "The workspace in your Linear URLs, as in linear.app/acme/issue/NRX-412. Branch names link Linear issues only when this is set.",
    placeholder: "acme",
    format: (settings) => settings.linearWorkspace,
    patch: (text) => ({ linearWorkspace: text }),
  },
  {
    searchId: "ticket-links-linear-teams",
    label: "Linear team keys",
    description:
      "Comma-separated team keys, such as NRX, ENG. A branch like gthomas/nrx-412-retry links NRX-412 only when NRX is listed.",
    placeholder: "NRX, ENG",
    format: (settings) => settings.linearTeamKeys.join(", "),
    patch: (text) => ({
      linearTeamKeys: text
        .split(",")
        .map((key) => key.trim().toUpperCase())
        .filter((key) => key !== ""),
    }),
  },
];

function TicketLinkFieldRow({ field }: { readonly field: TicketLinkField }) {
  const { targets } = useSettingsScope();
  const settings = useScopedSettings();
  const updateSettings = useUpdateScopedSettings();
  const mixed = useScopedSettingsMixed(["ticketLinks"]);
  const edited = useRef(false);
  const current = field.format(settings.ticketLinks);
  const scopeKey = targets.map((target) => target.environmentId).join(",");

  return (
    <SettingsRow
      {...searchableSetting(field.searchId)}
      description={field.description}
      serverScoped
      settingKeys={["ticketLinks"]}
      resetAction={
        mixed || current !== "" ? (
          <SettingResetButton
            label={field.label.toLowerCase()}
            onClick={() => updateSettings({ ticketLinks: field.patch("") })}
          />
        ) : null
      }
      control={
        <Input
          key={`${scopeKey}:${mixed}:${current}`}
          aria-label={field.label}
          autoCapitalize="none"
          spellCheck={false}
          placeholder={mixed ? "Mixed" : field.placeholder}
          defaultValue={mixed ? "" : current}
          onChange={() => {
            edited.current = true;
          }}
          onBlur={(event) => {
            const value = event.target.value.trim();
            if (edited.current && (mixed || value !== current))
              updateSettings({ ticketLinks: field.patch(value) });
            edited.current = false;
          }}
        />
      }
    />
  );
}

export function TicketLinkSettings() {
  return FIELDS.map((field) => <TicketLinkFieldRow key={field.searchId} field={field} />);
}
