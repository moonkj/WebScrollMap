// Smart tag filter (Pro). Scanner 결과를 tier/setting에 따라 필터링.

import { AnchorKind, type AnchorPoint } from './types';
import type { SmartFilter } from './messages';

export function applySmartFilter(
  anchors: ReadonlyArray<AnchorPoint>,
  filter: SmartFilter,
): ReadonlyArray<AnchorPoint> {
  if (filter === 'all') return anchors;
  return anchors.filter((a) => {
    if (filter === 'headings') {
      return (
        a.type === AnchorKind.Heading1 ||
        a.type === AnchorKind.Heading2 ||
        a.type === AnchorKind.Heading3
      );
    }
    if (filter === 'media') {
      return a.type === AnchorKind.Image || a.type === AnchorKind.Video;
    }
    return true;
  });
}
