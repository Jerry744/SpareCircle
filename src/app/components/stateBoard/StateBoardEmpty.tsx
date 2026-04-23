interface StateBoardEmptyProps {
  stateName?: string;
}

export function StateBoardEmpty({ stateName }: StateBoardEmptyProps): JSX.Element {
  return (
    <div className="flex h-full items-center justify-center bg-neutral-900 p-6 text-center">
      <div>
        <h3 className="text-lg font-semibold text-neutral-100">No variant available</h3>
        <p className="mt-2 text-sm text-neutral-400">
          {stateName ? `State "${stateName}"` : "Current state"} does not have a valid
          variant yet.
        </p>
      </div>
    </div>
  );
}
