"""Weld and quantize a binary STL into a compact indexed mesh bundle for file:// use."""

from __future__ import annotations

import argparse
import base64
import gzip
import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
TRIANGLE_DTYPE = np.dtype([("normal", "<f4", (3,)), ("vertices", "<f4", (3, 3)), ("attribute", "<u2")])


def weld(grid: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    unique, inverse = np.unique(grid, axis=0, return_inverse=True)
    faces = inverse.reshape(-1, 3)
    keep = (faces[:, 0] != faces[:, 1]) & (faces[:, 1] != faces[:, 2]) & (faces[:, 0] != faces[:, 2])
    return unique, faces[keep]


def build(stl: Path, step: float, target_faces: int) -> tuple[dict, bytes]:
    import fast_simplification

    count = int(np.fromfile(stl, dtype="<u4", count=1, offset=80)[0])
    corners = np.fromfile(stl, dtype=TRIANGLE_DTYPE, count=count, offset=84)["vertices"].reshape(-1, 3)
    origin = corners.min(axis=0)
    grid, faces = weld(np.round((corners - origin) / step).astype(np.int32))
    if len(faces) > target_faces:
        points, faces = fast_simplification.simplify(
            (origin + grid * step).astype(np.float32),
            faces.astype(np.int32),
            target_reduction=1 - target_faces / len(faces),
        )
        grid = np.clip(np.round((points - origin) / step), 0, None).astype(np.int32)
        # Re-weld because simplified vertices can land on the same grid cell.
        grid, faces = weld(grid[faces.reshape(-1)])
    if grid.max() > 0xFFFF:
        raise ValueError("Grid coordinates exceed 16 bits; increase --step.")
    index_type = "<u2" if len(grid) < 0xFFFF else "<u4"
    # Planar axes plus lexicographic vertex order keep neighbouring values close for gzip.
    payload = grid.T.astype("<u2").tobytes() + faces.astype(index_type).tobytes()
    meta = {
        "origin": [round(float(value), 6) for value in origin],
        "step": step,
        "vertexCount": int(len(grid)),
        "faceCount": int(len(faces)),
        "indexBytes": 2 if index_type == "<u2" else 4,
    }
    return meta, gzip.compress(payload, 9, mtime=0)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--stl", type=Path, default=ROOT / "assets" / "eurofighter-typhoon3.stl")
    parser.add_argument("--step", type=float, default=0.02, help="Quantization grid in STL units")
    parser.add_argument("--faces", type=int, default=120000, help="Target face count after decimation")
    parser.add_argument("--output", type=Path, default=ROOT / "assets" / "eurofighter-mesh-data.js")
    args = parser.parse_args()

    meta, compressed = build(args.stl, args.step, args.faces)
    encoded = base64.b64encode(compressed).decode("ascii")
    meta["data"] = ""
    chunks = [encoded[index : index + 120] for index in range(0, len(encoded), 120)]
    body = " +\n".join(f'  "{chunk}"' for chunk in chunks)
    header = json.dumps({key: value for key, value in meta.items() if key != "data"}, separators=(",", ":"))
    args.output.write_text(
        f"window.EUROFIGHTER_MESH = Object.assign({header}, {{\n  data:\n{body}\n}});\n",
        encoding="ascii",
    )
    print(f"{meta['vertexCount']} vertices, {meta['faceCount']} faces, {len(compressed)} bytes gzip, {args.output.stat().st_size} bytes written")


if __name__ == "__main__":
    main()
