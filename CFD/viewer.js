(() => {
  const canvas = document.querySelector('#scene');
  const loadState = document.querySelector('#load-state');
  const toggleButton = document.querySelector('#toggle-flow');
  const resetButton = document.querySelector('#reset-camera');
  const speedInput = document.querySelector('#flow-speed');
  const speedOutput = document.querySelector('#speed-value');
  const speedMinimumOutput = document.querySelector('#speed-min');
  const speedMaximumOutput = document.querySelector('#speed-max');
  const meshResolution = document.querySelector('#mesh-resolution');
  const THREE = window.THREE;

  if (!canvas || !THREE || !window.EUROFIGHTER_MESH || !window.EUROFIGHTER_CFD_GZIP_BASE64) {
    loadState.textContent = 'Could not load the 3D libraries or local geometry data.';
    return;
  }

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x0b1217, 1);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 250);
  const aircraftRoot = new THREE.Group();
  aircraftRoot.rotation.y = -0.12;
  const modelCoordinates = new THREE.Group();
  modelCoordinates.rotation.x = -Math.PI / 2;
  aircraftRoot.add(modelCoordinates);
  scene.add(aircraftRoot);
  scene.add(new THREE.HemisphereLight(0xdaf6ff, 0x18202c, 0.35));

  const keyLight = new THREE.DirectionalLight(0xffffff, 0.85);
  keyLight.position.set(-5, 10, 8);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x75d5e0, 0.25);
  fillLight.position.set(6, 4, -8);
  scene.add(fillLight);

  const warmLight = new THREE.PointLight(0xf0a86b, 1.5, 38);
  warmLight.position.set(-9, 2, 1);
  scene.add(warmLight);

  const floorGrid = new THREE.GridHelper(40, 40, 0x36505a, 0x203038);
  floorGrid.position.y = -1.15;
  floorGrid.material.transparent = true;
  floorGrid.material.opacity = 0.16;
  scene.add(floorGrid);

  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.target.set(2.7, 1.25, 0.3);
  controls.minDistance = 5;
  controls.maxDistance = 90;
  controls.maxPolarAngle = Math.PI * 0.48;

  const decodeGzipBase64 = async encoded => {
    if (!window.DecompressionStream) throw new Error('Gzip decompression is unavailable in this browser.');
    const bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  };

  const loadEmbeddedMesh = async () => {
    const { origin, step, vertexCount, faceCount, indexBytes, data } = window.EUROFIGHTER_MESH;
    const bytes = await decodeGzipBase64(data);
    const gridLength = vertexCount * 3;
    const gridByteLength = gridLength * Uint16Array.BYTES_PER_ELEMENT;
    const indexLength = faceCount * 3;
    const IndexArray = indexBytes === 2 ? Uint16Array : indexBytes === 4 ? Uint32Array : null;
    if (!IndexArray || bytes.byteLength !== gridByteLength + indexLength * IndexArray.BYTES_PER_ELEMENT) {
      throw new Error('The embedded aircraft mesh does not match its metadata.');
    }

    const grid = new Uint16Array(bytes.buffer, bytes.byteOffset, gridLength);
    const positions = new Float32Array(gridLength);
    for (let vertex = 0; vertex < vertexCount; vertex += 1) {
      for (let axis = 0; axis < 3; axis += 1) {
        positions[vertex * 3 + axis] = origin[axis] + grid[axis * vertexCount + vertex] * step;
      }
    }

    const indexBuffer = bytes.slice(gridByteLength).buffer;
    const indices = new IndexArray(indexBuffer);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeVertexNormals();
    return geometry;
  };

  const loadAircraft = async () => {
    let geometry;
    let fullResolution = false;
    try {
      if (!THREE.STLLoader) throw new Error('STLLoader is unavailable.');
      const loader = new THREE.STLLoader();
      const response = await fetch('../assets/eurofighter-typhoon.stl');
      if (!response.ok) throw new Error(`Full-resolution STL returned HTTP ${response.status}`);
      geometry = loader.parse(await response.arrayBuffer());
      fullResolution = true;
    } catch (error) {
      console.info('Full-resolution STL unavailable; using the embedded optimized mesh.', error.message);
      geometry = await loadEmbeddedMesh();
    }

    geometry.scale(0.1, 0.1, 0.1);

    const aircraft = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        color: 0x253b43,
        metalness: 0.28,
        roughness: 0.68,
        side: THREE.DoubleSide
      })
    );
    const triangleCount = geometry.index
      ? geometry.index.count / 3
      : geometry.attributes.position.count / 3;
    aircraft.name = fullResolution ? 'Full-resolution Eurofighter STL' : 'Optimized Eurofighter mesh';
    meshResolution.textContent = fullResolution
      ? `AIRFLOW SIMULATION · ${triangleCount.toLocaleString()} FACES`
      : `OPTIMIZED MESH · ${triangleCount.toLocaleString()} FACES`;
    modelCoordinates.add(aircraft);
    return aircraft;
  };

  const loadFlowData = async () => {
    const bytes = await decodeGzipBase64(window.EUROFIGHTER_CFD_GZIP_BASE64);
    return JSON.parse(new TextDecoder().decode(bytes));
  };

  const addStreamlines = flowData => {
    const samplers = [];
    const visibleLines = flowData.lines.filter((_, index) => index % 2 === 0);
    const particleCount = visibleLines.length;
    const particlePositions = new Float32Array(particleCount * 3);
    const allSpeeds = flowData.lines.flatMap(line => line.map(point => point[3]));
    const sortedSpeeds = allSpeeds.toSorted((first, second) => first - second);
    const speedMinimum = sortedSpeeds[Math.floor((sortedSpeeds.length - 1) * 0.1)];
    const speedMaximum = sortedSpeeds[Math.floor((sortedSpeeds.length - 1) * 0.9)];
    const lowSpeedColor = new THREE.Color(0x318d99);
    const midSpeedColor = new THREE.Color(0xa2c8ce);
    const highSpeedColor = new THREE.Color(0xf0a86b);
    speedMinimumOutput.textContent = `${speedMinimum.toFixed(1)} m/s`;
    speedMaximumOutput.textContent = `${speedMaximum.toFixed(1)} m/s`;
    const colorForSpeed = speed => {
      const relativeSpeed = THREE.MathUtils.clamp(
        (speed - speedMinimum) / Math.max(speedMaximum - speedMinimum, 1e-6),
        0,
        1
      );
      return relativeSpeed < 0.5
        ? lowSpeedColor.clone().lerp(midSpeedColor, relativeSpeed * 2)
        : midSpeedColor.clone().lerp(highSpeedColor, (relativeSpeed - 0.5) * 2);
    };

    visibleLines.forEach(line => {
      const curve = new THREE.CatmullRomCurve3(
        line.map(point => new THREE.Vector3(point[0], point[1], point[2]))
      );
      const tubularSegments = Math.min(480, line.length * 2);
      const radialSegments = 4;
      const geometry = new THREE.TubeGeometry(curve, tubularSegments, 0.024, radialSegments, false);
      const colors = new Float32Array(geometry.attributes.position.count * 3);
      const lineProgress = new Float32Array(geometry.attributes.position.count);
      for (let ring = 0; ring <= tubularSegments; ring += 1) {
        const speedIndex = Math.min(line.length - 1, Math.round((ring / tubularSegments) * (line.length - 1)));
        const color = colorForSpeed(line[speedIndex][3]);
        for (let side = 0; side <= radialSegments; side += 1) {
          const vertexIndex = ring * (radialSegments + 1) + side;
          const colorIndex = vertexIndex * 3;
          colors.set([color.r, color.g, color.b], colorIndex);
          lineProgress[vertexIndex] = ring / tubularSegments;
        }
      }
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geometry.setAttribute('lineProgress', new THREE.BufferAttribute(lineProgress, 1));
      const material = new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.68,
        depthWrite: false,
        toneMapped: false
      });
      material.onBeforeCompile = shader => {
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
      modelCoordinates.add(new THREE.Mesh(geometry, material));

      const sample = phase => curve.getPoint(phase).toArray();
      samplers.push(sample);
      particlePositions.set(sample(0), (samplers.length - 1) * 3);
    });

    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMaterial = new THREE.PointsMaterial({
      color: 0xf0a86b,
      size: 0.2,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.98,
      depthWrite: false
    });
    modelCoordinates.add(new THREE.Points(particleGeometry, particleMaterial));

    return { samplers, particleGeometry, particleCount };
  };

  const resize = () => {
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  let running = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let flow = null;
  let elapsed = 0;
  let previousFrame = performance.now();
  let animationFrame = 0;

  const updateToggle = () => {
    toggleButton.textContent = running ? 'Pause flow' : 'Play flow';
    toggleButton.setAttribute('aria-pressed', String(running));
  };

  const resetCamera = () => {
    camera.position.set(15.7, 10.25, 17.3);
    controls.target.set(2.7, 1.25, 0.3);
    controls.update();
  };

  const animate = now => {
    animationFrame = requestAnimationFrame(animate);
    const delta = Math.min((now - previousFrame) / 1000, 0.05);
    previousFrame = now;

    if (flow && running) {
      elapsed += delta * Number(speedInput.value) * 0.12;
      const positions = flow.particleGeometry.attributes.position;
      for (let index = 0; index < flow.particleCount; index += 1) {
        const point = flow.samplers[index](elapsed % 1);
        positions.setXYZ(index, point[0], point[1], point[2]);
      }
      positions.needsUpdate = true;
    }

    controls.update();
    renderer.render(scene, camera);
  };

  toggleButton.addEventListener('click', () => {
    running = !running;
    updateToggle();
  });
  resetButton.addEventListener('click', resetCamera);
  speedInput.addEventListener('input', () => {
    speedOutput.value = `${Number(speedInput.value).toFixed(1)}×`;
  });
  new ResizeObserver(resize).observe(canvas.parentElement);

  Promise.all([loadAircraft(), loadFlowData()]).then(([, flowData]) => {
    flow = addStreamlines(flowData);
    loadState.hidden = true;
    toggleButton.disabled = false;
    resetButton.disabled = false;
    speedInput.disabled = false;
    resetCamera();
    updateToggle();
    resize();
    animate(performance.now());
  }).catch(error => {
    console.error('Interactive CFD viewer failed to initialize.', error);
    loadState.textContent = error.message || 'Could not initialize the 3D viewer.';
    loadState.classList.add('error');
  });
})();