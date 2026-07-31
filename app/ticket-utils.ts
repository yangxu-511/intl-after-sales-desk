export const faultLevelDefinitions = [
  {
    level: "Level 1",
    severity: "Severe",
    description:
      "Critical customer or operational impact. The system may be unavailable, unsafe, or unable to continue routine testing.",
  },
  {
    level: "Level 2",
    severity: "Moderate",
    description:
      "Noticeable impact with limited operation or a temporary workaround. Prompt support is required.",
  },
  {
    level: "Level 3",
    severity: "Minor",
    description:
      "Limited impact that does not stop routine operation. Handle through normal support follow-up.",
  },
] as const;

export function severityForFaultLevel(level: string) {
  return (
    faultLevelDefinitions.find((definition) => definition.level === level)
      ?.severity ?? ""
  );
}

export function normalizeFaultSeverity<
  T extends { faultLevel: string; severity: string },
>(ticket: T): T {
  const severity = severityForFaultLevel(ticket.faultLevel);
  return severity && severity !== ticket.severity
    ? { ...ticket, severity }
    : ticket;
}

export function formatExportTimestamp(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`,
  ].join("_");
}
