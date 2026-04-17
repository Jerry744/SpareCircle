import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EditorBackendProvider, useEditorBackend } from "../../backend/editorStore";
import { TopToolbar } from "../TopToolbar";

function TestHarness({ children }: { children: React.ReactNode }) {
  return <EditorBackendProvider>{children}</EditorBackendProvider>;
}

function SnapReadout() {
  const { state: { project } } = useEditorBackend();
  return (
    <div>
      <div data-testid="pixel-snap">{String(project.canvasSnap?.pixelSnapEnabled ?? false)}</div>
      <div data-testid="magnet-snap">{String(project.canvasSnap?.magnetSnapEnabled ?? true)}</div>
    </div>
  );
}

describe("TopToolbar snap toggles", () => {
  it("renders Pixel Snap and Magnet Snap buttons", () => {
    render(
      <TestHarness>
        <TopToolbar />
      </TestHarness>,
    );

    expect(screen.getByRole("button", { name: /pixel snap/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /magnet snap/i })).toBeInTheDocument();
  });

  it("Pixel Snap button reflects initial state (off)", () => {
    render(
      <TestHarness>
        <TopToolbar />
        <SnapReadout />
      </TestHarness>,
    );

    const pixelBtn = screen.getByRole("button", { name: /pixel snap/i });
    expect(pixelBtn.getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByTestId("pixel-snap").textContent).toBe("false");
  });

  it("clicking Pixel Snap toggles pixelSnapEnabled on", () => {
    render(
      <TestHarness>
        <TopToolbar />
        <SnapReadout />
      </TestHarness>,
    );

    const pixelBtn = screen.getByRole("button", { name: /pixel snap/i });
    fireEvent.click(pixelBtn);
    expect(screen.getByTestId("pixel-snap").textContent).toBe("true");
    expect(pixelBtn.getAttribute("aria-pressed")).toBe("true");
  });

  it("clicking Pixel Snap twice toggles back off", () => {
    render(
      <TestHarness>
        <TopToolbar />
        <SnapReadout />
      </TestHarness>,
    );

    const pixelBtn = screen.getByRole("button", { name: /pixel snap/i });
    fireEvent.click(pixelBtn);
    fireEvent.click(pixelBtn);
    expect(screen.getByTestId("pixel-snap").textContent).toBe("false");
  });

  it("Magnet Snap button reflects initial state (on)", () => {
    render(
      <TestHarness>
        <TopToolbar />
        <SnapReadout />
      </TestHarness>,
    );

    const magnetBtn = screen.getByRole("button", { name: /magnet snap/i });
    expect(magnetBtn.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("magnet-snap").textContent).toBe("true");
  });

  it("clicking Magnet Snap toggles magnetSnapEnabled off", () => {
    render(
      <TestHarness>
        <TopToolbar />
        <SnapReadout />
      </TestHarness>,
    );

    const magnetBtn = screen.getByRole("button", { name: /magnet snap/i });
    fireEvent.click(magnetBtn);
    expect(screen.getByTestId("magnet-snap").textContent).toBe("false");
    expect(magnetBtn.getAttribute("aria-pressed")).toBe("false");
  });

  it("clicking Magnet Snap twice restores to on", () => {
    render(
      <TestHarness>
        <TopToolbar />
        <SnapReadout />
      </TestHarness>,
    );

    const magnetBtn = screen.getByRole("button", { name: /magnet snap/i });
    fireEvent.click(magnetBtn);
    fireEvent.click(magnetBtn);
    expect(screen.getByTestId("magnet-snap").textContent).toBe("true");
  });

  it("toggling Pixel Snap does not affect Magnet Snap state", () => {
    render(
      <TestHarness>
        <TopToolbar />
        <SnapReadout />
      </TestHarness>,
    );

    fireEvent.click(screen.getByRole("button", { name: /pixel snap/i }));
    expect(screen.getByTestId("magnet-snap").textContent).toBe("true");
  });
});
