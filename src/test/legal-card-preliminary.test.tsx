import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LegalResponseCard } from "@/components/LegalResponseCard";
import { LanguageProvider } from "@/contexts/LanguageContext";

const baseSection = {
  id: "mva-134-0",
  sectionName: "Section 134 — Duty of driver in case of accident",
  actName: "Motor Vehicles Act, 1988",
  confidence: 88,
  applicableLaw: "Whoever fails to stop and report the accident...",
  explanation: "Stop, help the injured and inform the police.",
  punishment: "Imprisonment up to 6 months, or fine up to Rs. 2,000, or both",
  whatToDo: "Report the accident at the nearest police station.",
  whereToFile: "Traffic Police / Motor Accident Claims Tribunal",
};

const renderCard = (preliminary: boolean) =>
  render(
    <LanguageProvider>
      <LegalResponseCard section={{ ...baseSection, preliminary }} index={0} />
    </LanguageProvider>,
  );

describe("LegalResponseCard preliminary state", () => {
  it("hides the confidence score and punishment while a question is pending", () => {
    renderCard(true);

    expect(screen.getByText(/Likely section/i)).toBeInTheDocument();
    expect(screen.queryByText(/88%/)).toBeNull();
    expect(screen.queryByRole("button", { name: /view details/i })).toBeNull();
    expect(screen.queryByText(/Possible Punishment/)).toBeNull();
    expect(screen.queryByText(baseSection.punishment)).toBeNull();
  });

  it("shows the confidence badge and details toggle once confirmed", () => {
    renderCard(false);

    expect(screen.getByText(/88%/)).toBeInTheDocument();
    expect(screen.queryByText(/Likely section/i)).toBeNull();
    expect(
      screen.getByRole("button", { name: /view details/i }),
    ).toBeInTheDocument();
  });
});
