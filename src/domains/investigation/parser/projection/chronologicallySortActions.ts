export function chronologicallySortActions<
  Action extends {
    id: string;
    startTime: number | undefined;
    streamId: string;
  },
>(actions: Action[]): Action[] {
  return actions.toSorted((left, right) => {
    if (left.startTime === undefined && right.startTime !== undefined) return 1;
    if (left.startTime !== undefined && right.startTime === undefined)
      return -1;
    return (
      (left.startTime ?? 0) - (right.startTime ?? 0) ||
      left.streamId.localeCompare(right.streamId) ||
      left.id.localeCompare(right.id)
    );
  });
}
