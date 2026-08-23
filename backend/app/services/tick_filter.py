"""
Strips short diagonal decoration marks (dimension-line tick marks, small
corner brackets) from a segment list. These are real geometry, but each one
adds an extra endpoint sitting a few points away from the "real" point a user
is trying to snap to (e.g. a dimension baseline corner), which competes with
it during nearest-point search. Detected purely by shape (short + ~45 degree
orientation), not tied to any one document.
"""
import math

MAX_TICK_LENGTH = 20  # PDF points
ANGLE_TOLERANCE = 5  # degrees, distance from the nearest 45/135/225/315 direction


def _is_tick_mark(segment):
    x1, y1, x2, y2 = segment
    length = math.hypot(x2 - x1, y2 - y1)
    if length > MAX_TICK_LENGTH:
        return False

    angle = math.degrees(math.atan2(y2 - y1, x2 - x1))
    distance_from_diagonal = abs((angle % 90) - 45)
    return distance_from_diagonal <= ANGLE_TOLERANCE


def remove_tick_marks(segments):
    return [s for s in segments if not _is_tick_mark(s)]
