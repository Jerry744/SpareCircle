import { useRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ZoomRouter } from "../zoomNavigator/ZoomRouter";
import { ZoomRouterProvider, useZoomRouter } from "../zoomNavigator/useZoomRouter";

let boardMountSequence = 0;

function BoardProbe({ variantId }: { variantId: string }) {
  const mountIdRef = useRef(++boardMountSequence);

  return (
    <div>
      <span data-testid="variant-id">{variantId}</span>
      <span data-testid="mount-count">{mountIdRef.current}</span>
    </div>
  );
}

function Harness() {
  const { replaceVariant } = useZoomRouter();
  return (
    <div>
      <button type="button" onClick={() => replaceVariant("variant-b")}>
        switch variant
      </button>
      <ZoomRouter
        renderMap={() => <div>map</div>}
        renderBoard={({ variantId }) => <BoardProbe variantId={variantId} />}
      />
    </div>
  );
}

describe("ZoomRouter board keying", () => {
  it("does not remount the board subtree when switching variants inside one state board", () => {
    boardMountSequence = 0;
    render(
      <ZoomRouterProvider initialLevel={{ level: "board", stateNodeId: "state-a", variantId: "variant-a" }}>
        <Harness />
      </ZoomRouterProvider>,
    );

    expect(screen.getByTestId("variant-id")).toHaveTextContent("variant-a");
    fireEvent.click(screen.getByRole("button", { name: "switch variant" }));
    expect(screen.getByTestId("variant-id")).toHaveTextContent("variant-b");
    expect(screen.getByTestId("mount-count")).toHaveTextContent("1");
  });
});
