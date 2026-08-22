def _bezier_points(p0, p1, p2, p3, steps=8):
    points = []
    for i in range(steps + 1):
        t = i / steps
        x = (1 - t) ** 3 * p0.x + 3 * (1 - t) ** 2 * t * p1.x + 3 * (1 - t) * t**2 * p2.x + t**3 * p3.x
        y = (1 - t) ** 3 * p0.y + 3 * (1 - t) ** 2 * t * p1.y + 3 * (1 - t) * t**2 * p2.y + t**3 * p3.y
        points.append((x, y))
    return points


def extract_segments(page):
    """Every vector drawing object on the page, flattened into line segments (x1, y1, x2, y2) in PDF points."""
    segments = []

    for path in page.get_drawings():
        for item in path["items"]:
            kind = item[0]

            if kind == "l":
                p1, p2 = item[1], item[2]
                segments.append((p1.x, p1.y, p2.x, p2.y))

            elif kind == "re":
                rect = item[1]
                corners = [
                    (rect.x0, rect.y0),
                    (rect.x1, rect.y0),
                    (rect.x1, rect.y1),
                    (rect.x0, rect.y1),
                ]
                for i in range(4):
                    x1, y1 = corners[i]
                    x2, y2 = corners[(i + 1) % 4]
                    segments.append((x1, y1, x2, y2))

            elif kind == "qu":
                quad = item[1]
                corners = [quad.ul, quad.ur, quad.lr, quad.ll]
                for i in range(4):
                    p1, p2 = corners[i], corners[(i + 1) % 4]
                    segments.append((p1.x, p1.y, p2.x, p2.y))

            elif kind == "c":
                p0, p1, p2, p3 = item[1], item[2], item[3], item[4]
                points = _bezier_points(p0, p1, p2, p3)
                for i in range(len(points) - 1):
                    x1, y1 = points[i]
                    x2, y2 = points[i + 1]
                    segments.append((x1, y1, x2, y2))

    return segments
