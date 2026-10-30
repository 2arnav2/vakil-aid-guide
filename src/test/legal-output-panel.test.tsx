import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { LegalOutputPanel, type LegalSection } from "@/components/LegalOutputPanel";
import { LanguageProvider } from "@/contexts/LanguageContext";

const makeSections = (count: number): LegalSection[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `section-${index + 1}`,
    sectionName: `Section ${index + 1} — Test provision ${index + 1}`,
    actName: "Motor Vehicles Act, 1988",
    confidence: 90 - index * 5,
    applicableLaw: "A short summary of the applicable law.",
    explanation: "A plain-language explanation.",
    punishment: "A possible punishment.",
    whatToDo: "Steps the user can take.",
    whereToFile: "Traffic Police / Motor Accident Claims Tribunal",
  }));

const renderPanel = (props: Partial<ComponentProps<typeof LegalOutputPanel>> = {}) =>
  render(
    <LanguageProvider>
      <LegalOutputPanel
        sections={makeSections(5)}
        stage="results"
        caseSummary="No FIR has been filed. No witnesses are available."
        terms={["MVA", "road accident"]}
        {...props}
      />
    </LanguageProvider>,
  );

describe("LegalOutputPanel results stack", () => {
  it("shows five provisions by default and reveals the rest with Show all", () => {
    renderPanel({ sections: makeSections(6) });

    expect(screen.getByText("Section 5 — Test provision 5")).toBeInTheDocument();
    expect(screen.queryByText("Section 6 — Test provision 6")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /show all 6 provisions/i }));

    expect(screen.getByText("Section 6 — Test provision 6")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /show only the top 5 provisions/i }));

    expect(screen.queryByText("Section 6 — Test provision 6")).not.toBeInTheDocument();
  });

  it("switches between the confidence and uncertainty views", () => {
    renderPanel({ analysisNote: "The AI explanation was not available within the time limit." });

    expect(screen.getByText("5 verified provisions")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^uncertainty$/i }));

    expect(screen.getByText("What could change this result")).toBeInTheDocument();
    expect(
      screen.getByText("The AI explanation was not available within the time limit."),
    ).toBeInTheDocument();
  });

  it("requires confirmation on the summary stage", () => {
    const onConfirm = vi.fn();
    const onEdit = vi.fn();
    renderPanel({ stage: "summary", onConfirm, onEdit });

    fireEvent.click(screen.getByRole("button", { name: /confirm analysis/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /edit details/i }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});
