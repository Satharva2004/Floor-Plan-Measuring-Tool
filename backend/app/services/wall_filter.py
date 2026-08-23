"""
Wall-only filter calibrated for one specific document (the Huntington A RH-SS
plan set, 2448x1584pt sheets). Not a general solution: this PDF has no layers
(OCGs) to separate wall types cleanly, so this leans on stroke width/color and
the sheet's fixed layout instead. Re-calibrate PLAN_BOUNDS/WALL_WIDTHS by hand
for any other document.
"""

PLAN_BOUNDS = (90, 40, 1500, 1560)  # floor-plan drawing region; excludes schedules/legend/title block
WALL_COLORS = {(0.0, 0.0, 0.0), (0.4, 0.4, 0.4)}  # black (masonry/bearing) + gray (partition), per this sheet's Wall Types Legend
WALL_WIDTHS = {0.36, 0.54, 0.72, 0.84, 1.02, 1.44, 1.68}


def is_wall_path(path):
    color = path.get("color")
    width = path.get("width")
    if color not in WALL_COLORS or width is None:
        return False
    if round(width, 2) not in WALL_WIDTHS:
        return False

    rect = path["rect"]
    x0, y0, x1, y1 = PLAN_BOUNDS
    return rect.x0 >= x0 and rect.x1 <= x1 and rect.y0 >= y0 and rect.y1 <= y1
