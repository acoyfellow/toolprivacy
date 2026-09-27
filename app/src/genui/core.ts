import type { UINode } from 'jsx2ui/react';

export type { UINode };

export function ui(
  type: string,
  props?: Record<string, unknown> | null,
  ...children: ReadonlyArray<UINode | string | null | undefined | false>
): UINode {
  return {
    type,
    props: props ?? undefined,
    children: children.filter(
      (c): c is UINode | string => c !== null && c !== undefined && c !== false,
    ),
  };
}

export function toUIJSON(node: UINode): string {
  return JSON.stringify(node);
}

export function fromUIJSON(json: string): UINode {
  return JSON.parse(json) as UINode;
}
