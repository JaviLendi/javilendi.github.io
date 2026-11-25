"""Run an exploratory Eurofighter external-flow case with OpenFOAM and PyFoam."""

from __future__ import annotations

import argparse
import ast
import builtins
import inspect
import math
import os
import shutil
import tempfile
from pathlib import Path


TUTORIAL = Path(os.environ.get("WM_PROJECT_DIR", "")) / "tutorials" / "incompressible" / "simpleFoam" / "motorBike"


def configure_pyfoam_windows() -> None:
    if os.name != "nt":
        return

    pyfoam_home = Path(tempfile.gettempdir()) / "pyfoam-home"
    pyfoam_home.mkdir(parents=True, exist_ok=True)
    os.environ["HOME"] = pyfoam_home.as_posix()
    os.environ["USERPROFILE"] = pyfoam_home.as_posix()
    os.environ["TERM"] = "dumb"

    original_eval = builtins.eval

    def safe_eval(expression, globals=None, locals=None):
        frame = inspect.currentframe().f_back
        scope_globals = frame.f_globals if globals is None else globals
        scope_locals = frame.f_locals if locals is None else locals
        try:
            return original_eval(expression, scope_globals, scope_locals)
        except SyntaxError:
            if isinstance(expression, str) and "caseBuilderDescriptions" in expression:
                return ast.literal_eval(expression.replace("\\", "\\\\"))
            raise

    builtins.eval = safe_eval


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="ascii")


def build_case(case: Path, speed: float, angle_deg: float, iterations: int) -> None:
    from PyFoam.RunDictionary.ParsedParameterFile import ParsedParameterFile

    system = case / "system"
    constant = case / "constant"
    fields = case / "0"
    tri_surface = constant / "triSurface"
    for folder in (system, constant, fields, tri_surface):
        folder.mkdir(parents=True, exist_ok=True)

    block_mesh = r"""FoamFile
{
    version 2.0;
    format ascii;
    class dictionary;
    object blockMeshDict;
}
scale 1;
vertices
(
    (-25 -18 -12)
    ( 24 -18 -12)
    ( 24  18 -12)
    (-25  18 -12)
    (-25 -18  12)
    ( 24 -18  12)
    ( 24  18  12)
    (-25  18  12)
);
blocks
(
    hex (0 1 2 3 4 5 6 7) (35 26 18) simpleGrading (1 1 1)
);
edges ();
boundary
(
    outlet { type patch; faces ((0 4 7 3)); }
    inlet  { type patch; faces ((2 6 5 1)); }
    sideMin { type symmetryPlane; faces ((0 1 5 4)); }
    sideMax { type symmetryPlane; faces ((3 7 6 2)); }
    bottom  { type symmetryPlane; faces ((0 3 2 1)); }
    top     { type symmetryPlane; faces ((4 5 6 7)); }
);
mergePatchPairs ();
"""
    write_text(system / "blockMeshDict", block_mesh)

    snappy = r"""FoamFile
{
    version 2.0;
    format ascii;
    class dictionary;
    object snappyHexMeshDict;
}
castellatedMesh true;
snap true;
addLayers false;
geometry
{
    eurofighter.obj
    {
        type triSurfaceMesh;
        name aircraft;
    }
    aircraftRefinement
    {
        type searchableBox;
        min (-11 -8 -5);
        max (16 8 8);
    }
}
castellatedMeshControls
{
    maxLocalCells 100000;
    maxGlobalCells 350000;
    minRefinementCells 0;
    maxLoadUnbalance 0.1;
    nCellsBetweenLevels 2;
    features ();
    refinementSurfaces
    {
        aircraft
        {
            level (2 3);
            patchInfo { type wall; inGroups (aircraftGroup); }
        }
    }
    resolveFeatureAngle 35;
    refinementRegions
    {
        aircraftRefinement
        {
            mode inside;
            levels ((1E15 1));
        }
    }
    locationInMesh (0 0 10);
    allowFreeStandingZoneFaces true;
}
snapControls
{
    nSmoothPatch 3;
    tolerance 1.5;
    nSolveIter 20;
    nRelaxIter 3;
    nFeatureSnapIter 0;
    implicitFeatureSnap false;
    explicitFeatureSnap false;
    multiRegionFeatureSnap false;
}
addLayersControls
{
    relativeSizes true;
    layers {};
    expansionRatio 1;
    finalLayerThickness 0.3;
    minThickness 0.1;
    nGrow 0;
    featureAngle 60;
    nRelaxIter 3;
    nSmoothSurfaceNormals 1;
    nSmoothNormals 3;
    nSmoothThickness 10;
    maxFaceThicknessRatio 0.5;
    maxThicknessToMedialRatio 0.3;
    minMedialAxisAngle 90;
    nBufferCellsNoExtrude 0;
    nLayerIter 30;
}
meshQualityControls
{
    #includeEtc "caseDicts/meshQualityDict"
    minFaceWeight 0.02;
    nSmoothScale 4;
    errorReduction 0.75;
}
writeFlags (scalarLevels layerSets layerFields);
mergeTolerance 1e-6;
"""
    write_text(system / "snappyHexMeshDict", snappy)

    control = r"""FoamFile
{
    version 2.0;
    format ascii;
    class dictionary;
    object controlDict;
}
application simpleFoam;
startFrom startTime;
startTime 0;
stopAt endTime;
endTime 60;
deltaT 1;
writeControl timeStep;
writeInterval 10;
purgeWrite 0;
writeFormat ascii;
writePrecision 7;
writeCompression off;
timeFormat general;
timePrecision 6;
runTimeModifiable true;
functions
{
    airflowStreamlinesUpper
    {
        type streamLine;
        libs (fieldFunctionObjects);
        writeControl writeTime;
        setFormat vtk;
        direction forward;
        fields (U p);
        lifeTime 600;
        nSubCycle 5;
        cloud eurofighterUpperSeeds;
        seedSampleSet
        {
            type uniform;
            axis y;
            start (22 -7 0.5);
            end (22 7 0.5);
            nPoints 31;
        }
    }
    airflowStreamlinesLower
    {
        type streamLine;
        libs (fieldFunctionObjects);
        writeControl writeTime;
        setFormat vtk;
        direction forward;
        fields (U p);
        lifeTime 600;
        nSubCycle 5;
        cloud eurofighterLowerSeeds;
        seedSampleSet
        {
            type uniform;
            axis y;
            start (22 -7 -0.2);
            end (22 7 -0.2);
            nPoints 31;
        }
    }
}
"""
    control_path = system / "controlDict"
    write_text(control_path, control)

    schemes = r"""FoamFile
{
    version 2.0;
    format ascii;
    class dictionary;
    object fvSchemes;
}
ddtSchemes { default steadyState; }
gradSchemes { default Gauss linear; grad(U) cellLimited Gauss linear 1; }
divSchemes
{
    default none;
    div(phi,U) bounded Gauss linearUpwindV grad(U);
    div(phi,k) bounded Gauss upwind;
    div(phi,omega) bounded Gauss upwind;
    div((nuEff*dev2(T(grad(U))))) Gauss linear;
}
laplacianSchemes { default Gauss linear corrected; }
interpolationSchemes { default linear; }
snGradSchemes { default corrected; }
wallDist { method meshWave; }
"""
    write_text(system / "fvSchemes", schemes)

    solution = r"""FoamFile
{
    version 2.0;
    format ascii;
    class dictionary;
    object fvSolution;
}
solvers
{
    p { solver GAMG; smoother GaussSeidel; tolerance 1e-7; relTol 0.05; }
    U { solver smoothSolver; smoother GaussSeidel; tolerance 1e-8; relTol 0.1; nSweeps 1; }
    k { solver smoothSolver; smoother GaussSeidel; tolerance 1e-8; relTol 0.1; nSweeps 1; }
    omega { solver smoothSolver; smoother GaussSeidel; tolerance 1e-8; relTol 0.1; nSweeps 1; }
}
SIMPLE { nNonOrthogonalCorrectors 0; consistent yes; }
relaxationFactors { equations { U 0.7; k 0.5; omega 0.5; } }
"""
    write_text(system / "fvSolution", solution)

    velocity = (-speed * math.cos(math.radians(angle_deg)), 0.0, -speed * math.sin(math.radians(angle_deg)))
    velocity_text = f"({velocity[0]:.7g} {velocity[1]:.7g} {velocity[2]:.7g})"
    turbulent_k = 1.5 * (0.05 * speed) ** 2
    omega = 5.6
    write_text(
        constant / "transportProperties",
        "FoamFile\n{ version 2.0; format ascii; class dictionary; object transportProperties; }\ntransportModel Newtonian;\nnu [0 2 -1 0 0 0 0] 1.5e-05;\n",
    )
    write_text(
        constant / "turbulenceProperties",
        "FoamFile\n{ version 2.0; format ascii; class dictionary; object turbulenceProperties; }\nsimulationType RAS;\nRAS { RASModel kOmegaSST; turbulence on; printCoeffs on; }\n",
    )

    write_text(
        fields / "U",
        f"""FoamFile
{{ version 2.0; format ascii; class volVectorField; object U; }}
dimensions [0 1 -1 0 0 0 0];
internalField uniform {velocity_text};
boundaryField
{{
    inlet {{ type fixedValue; value uniform {velocity_text}; }}
    outlet {{ type zeroGradient; }}
    sideMin {{ type symmetryPlane; }}
    sideMax {{ type symmetryPlane; }}
    bottom {{ type symmetryPlane; }}
    top {{ type symmetryPlane; }}
    aircraft {{ type noSlip; }}
}}
""",
    )
    write_text(
        fields / "p",
        """FoamFile
{ version 2.0; format ascii; class volScalarField; object p; }
dimensions [0 2 -2 0 0 0 0];
internalField uniform 0;
boundaryField
{
    inlet { type zeroGradient; }
    outlet { type fixedValue; value uniform 0; }
    sideMin { type symmetryPlane; }
    sideMax { type symmetryPlane; }
    bottom { type symmetryPlane; }
    top { type symmetryPlane; }
    aircraft { type zeroGradient; }
}
""",
    )
    write_text(
        fields / "k",
        f"""FoamFile
{{ version 2.0; format ascii; class volScalarField; object k; }}
dimensions [0 2 -2 0 0 0 0];
internalField uniform {turbulent_k:.7g};
boundaryField
{{
    inlet {{ type fixedValue; value uniform {turbulent_k:.7g}; }}
    outlet {{ type zeroGradient; }}
    sideMin {{ type symmetryPlane; }}
    sideMax {{ type symmetryPlane; }}
    bottom {{ type symmetryPlane; }}
    top {{ type symmetryPlane; }}
    aircraft {{ type kqRWallFunction; value uniform {turbulent_k:.7g}; }}
}}
""",
    )
    write_text(
        fields / "omega",
        f"""FoamFile
{{ version 2.0; format ascii; class volScalarField; object omega; }}
dimensions [0 0 -1 0 0 0 0];
internalField uniform {omega};
boundaryField
{{
    inlet {{ type fixedValue; value uniform {omega}; }}
    outlet {{ type zeroGradient; }}
    sideMin {{ type symmetryPlane; }}
    sideMax {{ type symmetryPlane; }}
    bottom {{ type symmetryPlane; }}
    top {{ type symmetryPlane; }}
    aircraft {{ type omegaWallFunction; value uniform {omega}; }}
}}
""",
    )
    write_text(
        fields / "nut",
        """FoamFile
{ version 2.0; format ascii; class volScalarField; object nut; }
dimensions [0 2 -1 0 0 0 0];
internalField uniform 0;
boundaryField
{
    inlet { type calculated; value uniform 0; }
    outlet { type calculated; value uniform 0; }
    sideMin { type symmetryPlane; }
    sideMax { type symmetryPlane; }
    bottom { type symmetryPlane; }
    top { type symmetryPlane; }
    aircraft { type nutkWallFunction; value uniform 0; }
}
""",
    )

    block = ParsedParameterFile(str(system / "blockMeshDict"), backup=False)
    snappy = ParsedParameterFile(str(system / "snappyHexMeshDict"), backup=False)
    parsed_control = ParsedParameterFile(str(control_path), backup=False)
    parsed_control.content["endTime"] = iterations
    parsed_control.content["writeInterval"] = max(1, iterations // 10)
    parsed_control.writeFile()
    for field in ("U", "p", "k", "omega", "nut"):
        ParsedParameterFile(str(fields / field), backup=False)
    del block, snappy


def run_tool(command: str, case: Path, *arguments: str) -> None:
    from PyFoam.Execution.BasicRunner import BasicRunner

    runner = BasicRunner(argv=[command, *arguments], silent=True)
    if os.name == "nt":
        runner.run.cpuTime = lambda: 0.0
        runner.run.cpuUserTime = lambda: 0.0
        runner.run.cpuSystemTime = lambda: 0.0
        runner.run.usedMemory = lambda: 0.0
    print(f"[PyFoam] {command} {' '.join(arguments)}")
    runner.start()
    if not runner.runOK():
        raise RuntimeError(f"{command} failed; inspect {case / f'PyFoam.{command}.logfile'}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--stl", type=Path, default=Path(__file__).resolve().parents[1] / "assets" / "eurofighter-typhoon.stl")
    parser.add_argument("--case", type=Path, help="Optional case directory; default is a unique directory in %%TEMP%%.")
    parser.add_argument("--speed", type=float, default=30.0)
    parser.add_argument("--angle", type=float, default=0.0)
    parser.add_argument("--iterations", type=int, default=60)
    args = parser.parse_args()
    stl_path = args.stl.resolve()

    if not stl_path.is_file():
        raise SystemExit(f"STL not found: {stl_path}. Pass --stl PATH to the local source model.")
    if not os.environ.get("WM_PROJECT_DIR") or not shutil.which("simpleFoam"):
        raise SystemExit("OpenFOAM is not initialized. Run setEnvVariables-v2606.bat first, then this script.")

    configure_pyfoam_windows()
    work_root = Path(tempfile.gettempdir()) / "openfoam-eurofighter"
    work_root.mkdir(parents=True, exist_ok=True)
    case = args.case or Path(tempfile.mkdtemp(prefix="run-", dir=work_root))
    case.mkdir(parents=True, exist_ok=True)
    build_case(case, args.speed, args.angle, args.iterations)

    previous_directory = Path.cwd()
    os.chdir(case)
    try:
        geometry = case / "constant" / "triSurface"
        scaled_surface = geometry / "eurofighter-scaled.obj"
        surface = geometry / "eurofighter.obj"
        run_tool("surfaceTransformPoints", case, "-write-scale", "0.1", "-write-format", "obj", str(stl_path), str(scaled_surface))
        run_tool("surfacePointMerge", case, str(scaled_surface), "1e-5", str(surface))
        run_tool("surfaceCheck", case, str(surface))
        run_tool("blockMesh", case)
        run_tool("snappyHexMesh", case, "-overwrite")
        run_tool("checkMesh", case, "-allTopology", "-allGeometry")
        run_tool("simpleFoam", case)
    finally:
        os.chdir(previous_directory)

    print(f"Case directory: {case}")
    print(f"Assumptions: {args.speed:g} m/s, AoA={args.angle:g} deg, standard-air rho=1.225 kg/m3, nu=1.5e-5 m2/s, STL scale=0.1 m/unit.")
    print("Exploratory steady RANS demonstration, not validated flight-performance data.")
    print(f"Upper streamline VTK output: {case / 'postProcessing' / 'sets' / 'airflowStreamlinesUpper'}")
    print(f"Lower streamline VTK output: {case / 'postProcessing' / 'sets' / 'airflowStreamlinesLower'}")


if __name__ == "__main__":
    main()
