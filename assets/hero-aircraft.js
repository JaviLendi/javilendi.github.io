const THREE = window.THREE;

const host = document.querySelector('.hero-art');
const fallback = host?.querySelector('svg');
const loadingScreen = host?.querySelector('.hero-loading');
const loadingMessage = loadingScreen?.querySelector('[data-loading-message]');
const modelCaption = host?.querySelector('.art-meta.bottom span');
if (modelCaption) modelCaption.textContent = 'OPENFOAM CFD · LOADING';

const showLoadError = (message = 'AIRCRAFT MODEL UNAVAILABLE') => {
  fallback?.remove();
  if (modelCaption) modelCaption.textContent = message;
  if (loadingMessage) loadingMessage.textContent = message;
  loadingScreen?.classList.add('is-error');
  host.dataset.modelState = 'unavailable';
};
if (fallback) {
  fallback.setAttribute('viewBox', '0 0 600 500');
  fallback.setAttribute('aria-label', 'Perspective Eurofighter Typhoon illustration with conceptual airflow lines. Not a CFD result.');
  fallback.innerHTML = `
    <defs>
      <pattern id="fighter-grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="#9eb9c6" stroke-opacity=".12"/></pattern>
      <linearGradient id="fighter-metal" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#dce8eb"/><stop offset="1" stop-color="#587a87"/></linearGradient>
      <marker id="fallback-flow-arrow" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0 0L7 3.5L0 7Z" fill="#f0a86b"/></marker>
    </defs>
    <rect width="600" height="500" fill="url(#fighter-grid)"/>
    <g fill="none" stroke="#7fb8c5" stroke-opacity=".58" stroke-width="1.2">
      <path d="M20 105C115 91 166 122 222 157C257 180 279 190 304 189C350 187 386 142 440 115C492 89 542 95 590 109"/>
      <path d="M16 150C117 137 167 158 222 188C260 210 280 218 306 216C352 213 391 177 444 153C495 130 544 138 590 154"/>
      <path d="M12 350C108 338 166 361 222 390C262 411 280 425 306 423C351 420 393 382 445 358C494 335 543 344 590 360"/>
      <path d="M18 399C116 389 169 410 228 439C265 457 285 468 309 465C353 460 394 425 446 402C495 381 543 390 590 405"/>
    </g>
    <g transform="rotate(28 300 250)" stroke="#a6dce1" stroke-width="1.5" stroke-linejoin="round">
      <path d="M300 202L133 282L115 309L287 270L300 279L313 270L485 309L467 282Z" fill="url(#fighter-metal)" fill-opacity=".86"/>
      <path d="M300 61C319 80 316 131 311 195L420 325L402 342L312 267L318 404L300 440L282 404L288 267L198 342L180 325L289 195C284 131 281 80 300 61Z" fill="url(#fighter-metal)"/>
      <path d="M289 153L235 179L282 174ZM311 153L365 179L318 174Z" fill="#91b8c2"/>
      <path d="M290 112Q300 91 310 112L307 160L293 160Z" fill="#18313c" stroke="#c9e8e9"/>
      <path d="M286 349L245 399L282 385M314 349L355 399L318 385" fill="#7896a2"/>
      <path d="M300 73L300 416M216 294L278 268M384 294L322 268" fill="none" stroke="#e1eef0" stroke-opacity=".55" stroke-width=".8"/>
    </g>
    <path d="M30 52H100M500 449H568" fill="none" stroke="#f0a86b" stroke-width="1.4" marker-end="url(#fallback-flow-arrow)"/>
    <g fill="#c6d7df" font-family="monospace" font-size="10"><text x="22" y="34">EUROFIGHTER / PERSPECTIVE CONCEPT</text><text x="420" y="478">AIRFLOW · NOT CFD</text></g>`;
}

if (host && fallback) {
  const canvas = document.createElement('canvas');
  canvas.className = 'aircraft-canvas';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Rotating 3D Eurofighter Typhoon model with OpenFOAM CFD streamlines and synchronized moving particles.');

  try {
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    if ('outputColorSpace' in renderer && THREE.SRGBColorSpace) {
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    } else {
      renderer.outputEncoding = THREE.sRGBEncoding;
    }
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.set(13, 9, 17);
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enablePan = false;
    controls.minPolarAngle = 0;
    controls.maxPolarAngle = Math.PI;
    controls.target.set(0, 0, 0);
    controls.update();

    scene.add(new THREE.HemisphereLight(0xdaf6ff, 0x18202c, 0.35));
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.65);
    keyLight.position.set(-5, 10, 8);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x75d5e0, 0.2);
    rimLight.position.set(6, 4, -8);
    scene.add(rimLight);
    const warmLight = new THREE.PointLight(0xf0a86b, 0.65, 40);
    warmLight.position.set(-9, 2, 1);
    scene.add(warmLight);

    let animationPaused = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const decompressBase64 = async payload => {
      if (!payload || !window.DecompressionStream) {
        throw new Error('Compressed local visualization data is unavailable.');
      }
      const binary = atob(payload);
      const compressed = Uint8Array.from(binary, character => character.charCodeAt(0));
      const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    };

    const loadAircraftGeometry = async () => {
      const loader = new THREE.STLLoader();
      const loadEmbeddedLite = async () => {
        const { origin, step, vertexCount, indexBytes, data } = window.EUROFIGHTER_MESH;
        const bytes = await decompressBase64(data);
        const grid = new Uint16Array(bytes.buffer, 0, vertexCount * 3);
        const positions = new Float32Array(vertexCount * 3);
        for (let index = 0; index < vertexCount; index += 1) {
          for (let axis = 0; axis < 3; axis += 1) {
            positions[index * 3 + axis] = origin[axis] + grid[axis * vertexCount + index] * step;
          }
        }
        // slice() copies to an aligned buffer, since the index block may start on a 2-byte offset.
        const indexBuffer = bytes.slice(vertexCount * 6).buffer;
        const indices = indexBytes === 2 ? new Uint16Array(indexBuffer) : new Uint32Array(indexBuffer);
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setIndex(new THREE.BufferAttribute(indices, 1));
        return { geometry, resolution: 'EMBEDDED LITE' };
      };

      if (window.location.protocol === 'file:') {
        return loadEmbeddedLite();
      }

      const loadStl = async (path, resolution) => {
        const response = await fetch(path);
        if (!response.ok) throw new Error(`${resolution} STL returned HTTP ${response.status}`);
        return { geometry: loader.parse(await response.arrayBuffer()), resolution };
      };

      try {
        return await loadStl('assets/eurofighter-typhoon.stl', 'FULL-RESOLUTION');
      } catch (fullError) {
        console.info('Full-resolution STL unavailable; trying the lite STL.', fullError.message);
        try {
          return await loadStl('assets/eurofighter-typhoon-lite.stl', 'LITE');
        } catch (liteError) {
          console.info('Lite STL unavailable; using the embedded optimized mesh.', liteError.message);
          return loadEmbeddedLite();
        }
      }
    };

    const parseEmbeddedFlow = async () => {
      const bytes = await decompressBase64(window.EUROFIGHTER_CFD_GZIP_BASE64);
      return JSON.parse(new TextDecoder().decode(bytes));
    };

    Promise.all([loadAircraftGeometry(), parseEmbeddedFlow()]).then(([aircraftData, flowData]) => {
      let { geometry } = aircraftData;
      const { resolution } = aircraftData;
      geometry.computeBoundingBox();
      const center = geometry.boundingBox.getCenter(new THREE.Vector3());
      geometry.translate(-center.x, -center.y, -center.z);
      geometry.rotateX(-Math.PI / 2);
      if (resolution === 'EMBEDDED LITE') geometry.computeVertexNormals();
      geometry.computeBoundingBox();

      const size = geometry.boundingBox.getSize(new THREE.Vector3());
      const longestAxis = Math.max(size.x, size.y, size.z);
      const modelScale = 13 / longestAxis;
      geometry.scale(modelScale, modelScale, modelScale);

      const material = new THREE.MeshStandardMaterial({
        color: 0x526d76,
        metalness: 0.22,
        roughness: 0.72,
        toneMapped: false,
        side: THREE.DoubleSide
      });
      const aircraft = new THREE.Mesh(geometry, material);
      const aircraftRoot = new THREE.Group();
      aircraftRoot.rotation.y = -0.12;
      aircraftRoot.add(aircraft);
      scene.add(aircraftRoot);

      const airflowGroup = new THREE.Group();
      aircraftRoot.add(airflowGroup);
      const flowSamplers = [];
      const allSpeeds = flowData.lines.flatMap(line => line.map(point => point[3])).sort((a, b) => a - b);
      const speedMinimum = allSpeeds[Math.floor((allSpeeds.length - 1) * 0.1)];
      const speedMaximum = allSpeeds[Math.floor((allSpeeds.length - 1) * 0.9)];
      const lowSpeedColor = new THREE.Color(0x318d99);
      const midSpeedColor = new THREE.Color(0xa2c8ce);
      const highSpeedColor = new THREE.Color(0xf0a86b);
      const colorForSpeed = speed => {
        const ratio = THREE.MathUtils.clamp(
          (speed - speedMinimum) / Math.max(speedMaximum - speedMinimum, 1e-6),
          0,
          1
        );
        return ratio < 0.5
          ? lowSpeedColor.clone().lerp(midSpeedColor, ratio * 2)
          : midSpeedColor.clone().lerp(highSpeedColor, (ratio - 0.5) * 2);
      };
      const transformFlowPoint = point => new THREE.Vector3(
        point[0] * 10 - center.x,
        point[1] * 10 - center.y,
        point[2] * 10 - center.z
      ).applyAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2).multiplyScalar(modelScale);

      flowData.lines.filter((_, index) => index % 2 === 0).forEach(line => {
        const samples = line
          .map(point => ({ position: transformFlowPoint(point), speed: point[3] }))
          .filter(sample => sample.position.x >= -12 && sample.position.x <= 12);
        if (samples.length < 2) return;

        const points = samples.map(sample => sample.position);
        const curve = new THREE.CatmullRomCurve3(points);
        const tubularSegments = Math.min(360, samples.length * 2);
        const radialSegments = 4;
        const lineGeometry = new THREE.TubeGeometry(curve, tubularSegments, 0.024, radialSegments, false);
        const colors = new Float32Array(lineGeometry.attributes.position.count * 3);
        const lineProgress = new Float32Array(lineGeometry.attributes.position.count);
        for (let ring = 0; ring <= tubularSegments; ring += 1) {
          const sampleIndex = Math.min(samples.length - 1, Math.round((ring / tubularSegments) * (samples.length - 1)));
          const color = colorForSpeed(samples[sampleIndex].speed);
          for (let side = 0; side <= radialSegments; side += 1) {
            const vertexIndex = ring * (radialSegments + 1) + side;
            colors.set([color.r, color.g, color.b], vertexIndex * 3);
            lineProgress[vertexIndex] = ring / tubularSegments;
          }
        }
        lineGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        lineGeometry.setAttribute('lineProgress', new THREE.BufferAttribute(lineProgress, 1));
        const lineMaterial = new THREE.MeshBasicMaterial({
          vertexColors: true,
          transparent: true,
          opacity: 0.68,
          depthWrite: false,
          toneMapped: false
        });
        lineMaterial.onBeforeCompile = shader => {
          shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nattribute float lineProgress;\nvarying float vLineProgress;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLineProgress = lineProgress;');
          shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', '#include <common>\nvarying float vLineProgress;')
            .replace(
              '#include <output_fragment>',
              'float startFade = smoothstep(0.0, 0.5, vLineProgress);\n' +
                'float endFade = 1.0 - smoothstep(0.6, 1.0, vLineProgress);\n' +
                'diffuseColor.a *= startFade * endFade;\n' +
                '#include <output_fragment>'
            );
        };
        airflowGroup.add(new THREE.Mesh(lineGeometry, lineMaterial));
        flowSamplers.push(phase => {
          const position = THREE.MathUtils.clamp(phase, 0, 1) * (points.length - 1);
          const start = Math.floor(position);
          const end = Math.min(start + 1, points.length - 1);
          return points[start].clone().lerp(points[end], position - start);
        });
      });

      const flowParticles = flowSamplers;
      const particlePositions = new Float32Array(flowParticles.length * 3);
      flowParticles.forEach((particle, index) => {
        const point = particle(0);
        particlePositions.set([point.x, point.y, point.z], index * 3);
      });
      const particleGeometry = new THREE.BufferGeometry();
      particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
      const particleMaterial = new THREE.PointsMaterial({
        color: 0xf0a86b,
        size: 0.2,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.95,
        depthWrite: false
      });
      airflowGroup.add(new THREE.Points(particleGeometry, particleMaterial));

      host.append(canvas);
      fallback.remove();
      loadingScreen?.remove();
      if (modelCaption) modelCaption.textContent = resolution === 'FULL-RESOLUTION'
        ? 'OPENFOAM CFD · FLOW SIMULATION'
        : resolution === 'LITE'
          ? 'OPENFOAM CFD · FLOW SIMULATION'
          : 'OPENFOAM CFD · FLOW SIMULATION';

      const resize = new ResizeObserver(entries => {
        const { width, height } = entries[0].contentRect;
        if (!width || !height) return;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
      });
      resize.observe(host);

      let frame = 0;
      const flowStartedAt = performance.now();
      const initialHeading = aircraftRoot.rotation.y;
      const render = now => {
        frame = window.requestAnimationFrame(render);
        if (!animationPaused) {
          aircraftRoot.rotation.y = initialHeading + (now - flowStartedAt) * 0.000045;
          const positionAttribute = particleGeometry.getAttribute('position');
          const elapsedCycles = (now - flowStartedAt) * 0.00012;
          flowParticles.forEach((particle, index) => {
            const point = particle(elapsedCycles % 1);
            positionAttribute.setXYZ(index, point.x, point.y, point.z);
          });
          positionAttribute.needsUpdate = true;
        }
        controls.update();
        renderer.render(scene, camera);
      };
      render(performance.now());

      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          window.cancelAnimationFrame(frame);
        } else {
          render(performance.now());
        }
      });
      host.dataset.modelState = 'ready';
    }).catch(error => {
      renderer.dispose();
      console.error('Could not load a Eurofighter STL model.', error);
      showLoadError(error.message);
    });
  } catch (error) {
    console.error('WebGL is unavailable; keeping the conceptual aircraft illustration.', error);
    showLoadError('WEBGL UNAVAILABLE · CANNOT RENDER AIRCRAFT');
  }
}