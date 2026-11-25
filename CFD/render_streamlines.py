"""Render OpenFOAM VTP streamlines and the Eurofighter STL in 3D."""

from __future__ import annotations

import argparse
import base64
import gzip
import json
import re
import struct
import xml.etree.ElementTree as ET
from pathlib import Path
from collections.abc import Sequence

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.colors import Normalize
import numpy as np
from mpl_toolkits.mplot3d.art3d import Line3DCollection, Poly3DCollection


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_BUNDLE = ROOT / "assets" / "eurofighter-mesh-data.js"
DEFAULT_VTP = Path.home() / "AppData" / "Local" / "Temp" / "openfoam-eurofighter" / "latest" / "postProcessing" / "sets" / "airflowStreamlines" / "200" / "track0.vtp"
DEFAULT_OUTPUT = Path(__file__).resolve().parent / "results" / "eurofighter-streamlines.png"


def load_mesh_triangles_from_bundle(path: Path) -> np.ndarray:
    source = path.read_text(encoding="ascii")
    match = re.search(
        r"window\.EUROFIGHTER_MESH\s*=\s*Object\.assign\((\{[^\n]+\}),\s*\{\s*data:\s*(.*?)\s*\}\);",
        source,
        re.DOTALL,
    )
    if not match:
        raise ValueError(f"No indexed Eurofighter mesh bundle found in {path}")

    metadata = json.loads(match.group(1))
    encoded = "".join(re.findall(r'"([A-Za-z0-9+/=]+)"', match.group(2)))
    if not encoded:
        raise ValueError(f"No compressed mesh data found in {path}")
    payload = gzip.decompress(base64.b64decode(encoded))

    vertex_count = int(metadata["vertexCount"])
    face_count = int(metadata["faceCount"])
    index_dtype = {2: "<u2", 4: "<u4"}.get(int(metadata["indexBytes"]))
    if index_dtype is None:
        raise ValueError("Unsupported mesh index width")

    grid_bytes = vertex_count * 3 * np.dtype("<u2").itemsize
    grid = np.frombuffer(payload[:grid_bytes], dtype="<u2")
    indices = np.frombuffer(payload[grid_bytes:], dtype=index_dtype)
    if grid.size != vertex_count * 3 or indices.size != face_count * 3:
        raise ValueError("Mesh bundle payload size does not match its metadata")

    grid = grid.reshape(3, vertex_count).T.astype(np.float32)
    vertices = np.asarray(metadata["origin"], dtype=np.float32) + grid * float(metadata["step"])
    triangles = vertices[indices.reshape(face_count, 3)]
    return triangles * 0.1


def load_vtk_array(root: ET.Element, name: str) -> np.ndarray:
    element = root.find(f".//DataArray[@Name='{name}']")
    if element is None or element.text is None:
        raise ValueError(f"VTP array {name!r} is missing")
    if element.get("format") != "binary":
        raise ValueError(f"Expected inline binary VTP array for {name!r}")
    encoded = re.sub(r"\s+", "", element.text)
    payload = base64.b64decode(encoded)
    size = struct.unpack_from("<Q", payload, 0)[0]
    raw = memoryview(payload)[8 : 8 + size]
    dtype = {"Float32": "<f4", "Int32": "<i4"}[element.get("type", "")]
    values = np.frombuffer(raw, dtype=dtype)
    components = int(element.get("NumberOfComponents", "1"))
    return values.reshape(-1, components) if components > 1 else values


def load_streamlines(path: Path) -> tuple[np.ndarray, list[np.ndarray], np.ndarray]:
    root = ET.parse(path).getroot()
    points = load_vtk_array(root, "Points").reshape(-1, 3)
    offsets = load_vtk_array(root, "offsets").astype(np.int64)
    connectivity = load_vtk_array(root, "connectivity").astype(np.int64)
    velocity = load_vtk_array(root, "U").reshape(-1, 3)
    polylines = []
    start = 0
    for end in offsets:
        indices = connectivity[start:end]
        polylines.append(points[indices])
        start = int(end)
    return points, polylines, velocity


def load_streamline_files(vtk_files: Sequence[Path]) -> tuple[list[np.ndarray], np.ndarray]:
    polylines = []
    velocity_arrays = []
    for vtk_file in vtk_files:
        _, file_lines, velocity = load_streamlines(vtk_file)
        polylines.extend(file_lines)
        velocity_arrays.append(velocity)
    return polylines, np.concatenate(velocity_arrays)


def export_streamline_bundle(vtk_files: Sequence[Path], output: Path) -> None:
    polylines, velocity = load_streamline_files(vtk_files)
    lines = []
    start = 0
    for line in polylines:
        end = start + len(line)
        speed = np.linalg.norm(velocity[start:end], axis=1)
        lines.append(np.column_stack((line, speed)).round(4).tolist())
        start = end

    payload = json.dumps({"lines": lines}, separators=(",", ":")).encode("ascii")
    encoded = base64.b64encode(gzip.compress(payload, mtime=0)).decode("ascii")
    chunks = [encoded[index : index + 120] for index in range(0, len(encoded), 120)]
    expression = " +\n".join(f'  "{chunk}"' for chunk in chunks)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(f"window.EUROFIGHTER_CFD_GZIP_BASE64 = (\n{expression}\n);\n", encoding="ascii")


def render(bundle: Path, vtk_files: Sequence[Path], output: Path) -> None:
    triangles = load_mesh_triangles_from_bundle(bundle)
    polylines, velocity = load_streamline_files(vtk_files)

    fig = plt.figure(figsize=(13, 8), dpi=160)
    axis = fig.add_subplot(111, projection="3d", computed_zorder=False)
    fig.patch.set_facecolor("#0a0f16")
    axis.set_facecolor("#0a0f16")

    segments = []
    segment_speeds = []
    start = 0
    for line in polylines:
        if len(line) > 1:
            segments.extend(np.stack((line[:-1], line[1:]), axis=1))
            end = start + len(line)
            line_speed = np.linalg.norm(velocity[start:end], axis=1)
            segment_speeds.extend((line_speed[:-1] + line_speed[1:]) * 0.5)
            start = end
    face_normals = np.cross(triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0])
    face_normals /= np.maximum(np.linalg.norm(face_normals, axis=1)[:, None], 1e-12)
    light_direction = np.array([-0.45, -0.35, 0.82])
    light_direction /= np.linalg.norm(light_direction)
    brightness = 0.62 + 0.38 * np.abs(face_normals @ light_direction)
    base_color = np.array([0.62, 0.82, 0.86])
    face_colors = np.column_stack((brightness[:, None] * base_color, np.ones(len(brightness))))
    aircraft = Poly3DCollection(
        triangles,
        facecolors=face_colors,
        edgecolors="none",
        linewidths=0,
        zsort="average",
        rasterized=True,
    )

    if segments:
        speed = np.asarray(segment_speeds)
        speed_norm = Normalize(vmin=float(speed.min()), vmax=max(float(speed.max()), float(speed.min()) + 1e-6))
        streamline_collection = Line3DCollection(
            segments,
            cmap="magma",
            norm=speed_norm,
            linewidths=0.55,
            alpha=0.9,
        )
        streamline_collection.set_array(speed)
        streamline_collection.set_zorder(2)
        axis.add_collection3d(streamline_collection)
        colorbar = fig.colorbar(streamline_collection, ax=axis, shrink=0.62, pad=0.08)
        colorbar.set_label("Velocity magnitude (m/s)", color="#b7c5cd")
        colorbar.ax.tick_params(colors="#899ba5", labelsize=8)
        colorbar.outline.set_edgecolor("#30424c")

    aircraft.set_zorder(5)
    axis.add_collection3d(aircraft)

    model_points = triangles.reshape(-1, 3)
    flow_points = np.concatenate(polylines)
    aircraft_lower = model_points.min(axis=0)
    aircraft_upper = model_points.max(axis=0)
    all_points = np.concatenate((model_points, flow_points))
    lower = all_points.min(axis=0)
    upper = all_points.max(axis=0)
    padding = np.maximum((upper - lower) * 0.06, np.array([1.0, 1.0, 0.7]))
    x_padding = max(float(aircraft_upper[0] - aircraft_lower[0]) * 0.65, 5.0)
    axis.set_xlim(aircraft_lower[0] - x_padding, aircraft_upper[0] + x_padding)
    axis.set_ylim(lower[1] - padding[1], upper[1] + padding[1])
    axis.set_zlim(lower[2] - padding[2], upper[2] + padding[2])
    visible_spans = np.array(
        [
            aircraft_upper[0] - aircraft_lower[0] + 2 * x_padding,
            upper[1] - lower[1] + 2 * padding[1],
            upper[2] - lower[2] + 2 * padding[2],
        ]
    )
    axis.set_box_aspect(visible_spans)
    axis.view_init(elev=32, azim=-52)

    axis.quiver(20, -9, 3, -5, 0, 0, color="#f0a86b", linewidth=1.4, arrow_length_ratio=0.16)
    axis.text(15, -9, 3.7, "30 m/s inlet", color="#f0a86b", fontsize=8)
    axis.set_title(
        "EUROFIGHTER | OPENFOAM SIMPLEFOAM\n"
        "k-omega SST  |  0 deg AoA  |  200 iterations  |  exploratory, not validated",
        color="#d8e6e9",
        fontsize=11,
        pad=18,
        family="monospace",
    )
    axis.set_xlabel("Longitudinal x (m)", color="#b7c5cd", labelpad=10)
    axis.set_ylabel("Spanwise y (m)", color="#b7c5cd", labelpad=10)
    axis.set_zlabel("Vertical z (m)", color="#b7c5cd", labelpad=8)
    axis.tick_params(colors="#899ba5", labelsize=8, pad=2)
    axis.grid(False)
    for axis_line in (axis.xaxis, axis.yaxis, axis.zaxis):
        axis_line.set_pane_color((0.05, 0.08, 0.11, 1.0))
        axis_line.line.set_color("#30424c")
    fig.tight_layout(pad=1.5)
    output.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(output, facecolor=fig.get_facecolor(), bbox_inches="tight")
    plt.close(fig)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--bundle",
        type=Path,
        default=DEFAULT_BUNDLE,
        help="Generated indexed mesh JS bundle (default: assets/eurofighter-mesh-data.js)",
    )
    parser.add_argument("--vtk", type=Path, nargs="+", required=True, help="One or more track0.vtp files written by OpenFOAM streamLine")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--data-js", type=Path, help="Optional compressed JS bundle for the interactive viewer")
    args = parser.parse_args()
    render(args.bundle, args.vtk, args.output)
    if args.data_js:
        export_streamline_bundle(args.vtk, args.data_js)
        print(f"Interactive streamline data written to {args.data_js}")
    print(f"Rendered OpenFOAM streamlines to {args.output}")


if __name__ == "__main__":
    main()
