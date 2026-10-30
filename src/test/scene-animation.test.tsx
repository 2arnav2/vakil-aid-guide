import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CaseSceneAnimation } from "@/components/CaseSceneAnimation";

describe("CaseSceneAnimation", () => {
  it("renders nothing before any query is typed", () => {
    const { container } = render(<CaseSceneAnimation text="  " />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a road accident scene with cues for a truck hit-and-run", () => {
    render(<CaseSceneAnimation text="the truck hit us and the driver fled" />);

    expect(screen.getByText("Road accident scene")).toBeInTheDocument();
    expect(screen.getByText("Vehicle collision")).toBeInTheDocument();
    expect(screen.getByText("Driver fled the scene")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /Animated Road accident scene/i }),
    ).toBeInTheDocument();
  });

  it("updates the scene when the text changes", () => {
    const { rerender } = render(<CaseSceneAnimation text="my car was stolen" />);
    expect(screen.getByText("Theft scene")).toBeInTheDocument();
    expect(screen.getByText("Theft of movable property")).toBeInTheDocument();

    rerender(<CaseSceneAnimation text="my email account was hacked" />);
    expect(screen.getByText("Cyber incident scene")).toBeInTheDocument();
    expect(screen.getByText("Unauthorised access")).toBeInTheDocument();
  });

  it("shows a financial-loss cue for hacked money", () => {
    render(<CaseSceneAnimation text="my email was hacked and money was stolen" />);
    expect(screen.getByText("Cyber incident scene")).toBeInTheDocument();
    expect(screen.getByText("Financial loss or stolen money")).toBeInTheDocument();
  });

  it("shows an assault scene when someone is hit without a vehicle", () => {
    render(<CaseSceneAnimation text="someone hit me near the market" />);
    expect(screen.getByText("Assault scene")).toBeInTheDocument();
    expect(screen.getByText("Physical assault")).toBeInTheDocument();
  });

  it("draws people in the accident scene, including a victim lying down", () => {
    const { container } = render(
      <CaseSceneAnimation text="the truck hit us and the driver fled, my wife was injured" />,
    );
    expect(container.querySelectorAll("[data-person]").length).toBeGreaterThanOrEqual(2);
    expect(container.querySelector('[data-person="lie"]')).not.toBeNull();
    expect(container.querySelector('[data-person="run"]')).not.toBeNull();
  });

  it("draws a walking pedestrian for a crossing accident", () => {
    const { container } = render(
      <CaseSceneAnimation text="a car hit me while crossing the road" />,
    );
    expect(container.querySelectorAll('[data-person="walk"]').length).toBeGreaterThan(0);
  });

  it("draws a seated person at the desk in the cyber scene", () => {
    const { container } = render(
      <CaseSceneAnimation text="my email was hacked and money was stolen" />,
    );
    expect(container.querySelector('[data-person="sit"]')).not.toBeNull();
  });

  it("draws figures in the theft scene", () => {
    const { container } = render(<CaseSceneAnimation text="my car was stolen last night" />);
    expect(container.querySelectorAll("[data-person]").length).toBeGreaterThanOrEqual(2);
  });

  it("shows a single tipped vehicle for a solo fall", () => {
    const { container } = render(
      <CaseSceneAnimation text="my scooter slipped on the road and I was injured" />,
    );
    expect(container.querySelector('[data-layout="solo"]')).not.toBeNull();
    expect(container.querySelectorAll("[data-vehicle]").length).toBe(1);
  });

  it("shows two facing vehicles for a collision", () => {
    const { container } = render(<CaseSceneAnimation text="the truck hit us on the road" />);
    expect(container.querySelector('[data-layout="collision"]')).not.toBeNull();
    expect(container.querySelectorAll("[data-vehicle]").length).toBe(2);
  });

  it("shows only the fleeing car for a pedestrian hit-and-run", () => {
    const { container } = render(
      <CaseSceneAnimation text="a car hit me while crossing the road and fled" />,
    );
    expect(container.querySelector('[data-layout="pedestrian"]')).not.toBeNull();
    expect(container.querySelectorAll("[data-vehicle]").length).toBe(1);
  });

  it("renders night, rain, signal and city variants from the description", () => {
    const { container } = render(
      <CaseSceneAnimation text="the truck hit us near the signal at night in the rain" />,
    );
    expect(container.querySelector('[data-night="true"]')).not.toBeNull();
    expect(container.querySelector("[data-rain]")).not.toBeNull();
    expect(container.querySelector("[data-signal]")).not.toBeNull();
    expect(container.querySelector("[data-backdrop='city']")).not.toBeNull();
  });
});
