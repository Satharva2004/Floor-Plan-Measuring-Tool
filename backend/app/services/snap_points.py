GRID_CELL_SIZE = 1  # PDF points per grid cell, for the intersection pre-filter
DEDUP_EPSILON = 0.5  # points within this distance are treated as the same snap point


def _segment_intersection(seg1, seg2):
    x1, y1, x2, y2 = seg1
    x3, y3, x4, y4 = seg2

    denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
    if denom == 0:
        return None  # parallel or collinear

    t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom
    u = ((x1 - x3) * (y1 - y2) - (y1 - y3) * (x1 - x2)) / denom

    if 0 <= t <= 1 and 0 <= u <= 1:
        return (x1 + t * (x2 - x1), y1 + t * (y2 - y1))

    return None


def _build_grid(segments, cell_size):
    """Bucket each segment into every grid cell its bounding box touches."""
    grid = {}
    for i, (x1, y1, x2, y2) in enumerate(segments):
        min_cx, max_cx = int(min(x1, x2) // cell_size), int(max(x1, x2) // cell_size)
        min_cy, max_cy = int(min(y1, y2) // cell_size), int(max(y1, y2) // cell_size)
        for cx in range(min_cx, max_cx + 1):
            for cy in range(min_cy, max_cy + 1):
                grid.setdefault((cx, cy), []).append(i)
    return grid


def _find_intersections(segments, cell_size=GRID_CELL_SIZE):
    """Only compares segments that share a grid cell, instead of every pair on the page."""
    grid = _build_grid(segments, cell_size)
    checked_pairs = set()
    points = []

    for cell_segments in grid.values():
        for a in range(len(cell_segments)):
            for b in range(a + 1, len(cell_segments)):
                i, j = cell_segments[a], cell_segments[b]
                pair = (i, j) if i < j else (j, i)
                if pair in checked_pairs:
                    continue
                checked_pairs.add(pair)

                point = _segment_intersection(segments[i], segments[j])
                if point:
                    points.append(point)

    return points


def _dedup_points(points, epsilon=DEDUP_EPSILON):
    """Collapses near-identical points (e.g. several segments meeting at one corner) into one."""
    seen_cells = set()
    result = []
    for point in points:
        cell = (round(point["x"] / epsilon), round(point["y"] / epsilon))
        if cell not in seen_cells:
            seen_cells.add(cell)
            result.append(point)
    return result


def generate_snap_points(segments):
    points = []

    for x1, y1, x2, y2 in segments:
        points.append({"type": "endpoint", "x": x1, "y": y1})
        points.append({"type": "endpoint", "x": x2, "y": y2})
        points.append({"type": "midpoint", "x": (x1 + x2) / 2, "y": (y1 + y2) / 2})

    for x, y in _find_intersections(segments):
        points.append({"type": "intersection", "x": x, "y": y})

    return _dedup_points(points)
