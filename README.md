# Javier Lendínez — Aerospace Engineering Portfolio

Static portfolio for aerospace engineering, with indexable Projects, project evidence, professional experience, and contact links.
[Open portfolio](https://javilendi.github.io/)

## Projects

- [VLMPy — Aerodynamic Analysis Tool](projects/vlmpy.html): Python Vortex Lattice Method, geometry discretisation, visualisation, and documented XFLR5 comparison material.
- [UAXSat IV — CubeSat Systems](projects/uaxsat.html): 3U structural design, composite materials, manufacturing, payload interfaces, and the documented ground-data path.
- [UAS Drone Mission Planner](projects/uas-drone-mission-planner.html): mission planning using INSIGNIA data for UAS in Spain.

## Website and deployment

Visit [javilendi.github.io](https://javilendi.github.io/). The site is static and needs no build tools or package installation.

## Repository structure

- `index.html`, `styles.css`, `case-studies.css`, and `script.js` implement the site.
- `projects/` contains the three standalone case-study pages and their navigation script.
- `assets/` contains project screenshots, the Open Graph image, the English CV PDF, the embedded 60,000-face Eurofighter mesh, and the published 32.7 MB lite STL. The hero requests the 59 MB full STL first, then the lite STL; when opened with `file://`, it automatically loads the embedded lite mesh because browsers block fetches of neighboring files. The full source STL stays local and is excluded by `.gitignore`.
- `CFD/` contains an exploratory OpenFOAM/PyFoam external-flow demo and a saved streamline snapshot. The case assumptions and mesh limitations are documented in [CFD/README.md](CFD/README.md).
- `Ironhack/Coding/` contains course exercises and the UAX Coding for the Industry project. [Open the project site](https://javilendi.github.io/Ironhack/Coding/Project/index.html).
- `Ironhack/Data analytics/` contains the data analysis notebook.

More information about the Ironhack course: [Ironhack credential](https://www.credential.net/17c65a40-6e38-4b13-af57-3e961f99502b).
