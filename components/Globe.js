"use client";

import React from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";

const CAMERA_DISTANCE = 255;
const CAMERA_DISTANCE_FOCUS = 185;
const DEFAULT_FOCUS = {
  lat: -15.78,
  lng: -53.1
};

export default function Globe({ units, activeSelection, focusCoordinates, onUnitClick }) {
  const [countries, setCountries] = React.useState([]);

  React.useEffect(() => {
    let cancelled = false;

    async function loadCountries() {
      try {
        const response = await fetch("/data/countries.geojson");

        if (!response.ok) {
          throw new Error("Falha ao carregar o GeoJSON.");
        }

        const payload = await response.json();

        if (!cancelled) {
          setCountries(payload.features ?? []);
        }
      } catch {
        if (!cancelled) {
          setCountries([]);
        }
      }
    }

    loadCountries();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="h-full w-full">
      <Canvas
        dpr={[1, 1.7]}
        camera={{ fov: 30, position: [0, 0, CAMERA_DISTANCE] }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          gl.setClearColor("#020617", 0);
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.1;
        }}
      >
        <Scene
          countries={countries}
          units={units}
          activeSelection={activeSelection}
          focusCoordinates={focusCoordinates ?? DEFAULT_FOCUS}
          onUnitClick={onUnitClick}
        />
      </Canvas>
    </div>
  );
}

function Scene({ countries, units, activeSelection, focusCoordinates, onUnitClick }) {
  const [globe, setGlobe] = React.useState(null);
  const controlsRef = React.useRef(null);
  const shouldAnimateCamera = React.useRef(true);
  const { camera, size } = useThree();
  const orbitTarget = React.useMemo(() => new THREE.Vector3(0, 0, 0), []);
  const targetCamera = React.useRef(latLngToVector3(DEFAULT_FOCUS.lat, DEFAULT_FOCUS.lng, CAMERA_DISTANCE));
  const [labelScale, setLabelScale] = React.useState(1);
  const [hoveredUnitId, setHoveredUnitId] = React.useState(null);

  const countryLabels = React.useMemo(
    () => buildCountryLabels(countries),
    [countries]
  );

  const points = React.useMemo(() => {
    const selectedUnitId = activeSelection?.unit?.id;

    const mappedUnits = units.map((unit) => ({
      ...unit,
      pointType: "unit",
      isSelected: unit.id === selectedUnitId,
      color: unit.id === selectedUnitId ? "#f59e0b" : "#22d3ee",
      // Mais alto para facilitar hover/click quando há clusters.
      altitude: unit.id === selectedUnitId ? 0.09 : 0.07,
      radius: unit.id === selectedUnitId ? 0.28 : 0.19,
      label: `${unit.name} - ${unit.city}/${unit.state}`
    }));

    if (!activeSelection?.place) {
      return mappedUnits;
    }

    return [
      ...mappedUnits,
      {
        id: `origin-${activeSelection.place.id}`,
        name: activeSelection.place.label,
        city: activeSelection.place.city,
        state: activeSelection.place.state,
        lat: activeSelection.place.lat,
        lng: activeSelection.place.lng,
        pointType: "origin",
        color: "#f8fafc",
        altitude: 0.08,
        radius: 0.2,
        label: `Origem - ${activeSelection.place.label}`
      }
    ];
  }, [activeSelection, units]);

  const labels = React.useMemo(() => {
    const dynamicLabels = [];

    if (activeSelection?.unit) {
      dynamicLabels.push({
        id: `unit-label-${activeSelection.unit.id}`,
        text: activeSelection.unit.city,
        lat: activeSelection.unit.lat,
        lng: activeSelection.unit.lng,
        size: 0.6,
        color: "#f8fafc",
        altitude: 0.03,
        dot: true
      });
    }

    if (activeSelection?.place) {
      dynamicLabels.push({
        id: `place-label-${activeSelection.place.id}`,
        text: activeSelection.place.label,
        lat: activeSelection.place.lat,
        lng: activeSelection.place.lng,
        size: 0.54,
        color: "#67e8f9",
        altitude: 0.026,
        dot: true
      });
    }

    return [...countryLabels, ...dynamicLabels];
  }, [activeSelection, countryLabels]);

  const arcs = React.useMemo(() => {
    if (!activeSelection?.place || !activeSelection?.unit) {
      return [];
    }

    const altitude = Math.min(
      0.34,
      Math.max(0.16, activeSelection.airDistanceKm / 7000)
    );

    return [
      {
        startLat: activeSelection.place.lat,
        startLng: activeSelection.place.lng,
        endLat: activeSelection.unit.lat,
        endLng: activeSelection.unit.lng,
        altitude,
        color: ["#67e8f9", "#f59e0b"]
      }
    ];
  }, [activeSelection]);

  const rings = React.useMemo(() => {
    if (!activeSelection?.place || !activeSelection?.unit) {
      return [];
    }

    return [
      {
        lat: activeSelection.place.lat,
        lng: activeSelection.place.lng,
        color: "#67e8f9",
        maxRadius: 4.8,
        propagationSpeed: 2.3,
        repeatPeriod: 900
      },
      {
        lat: activeSelection.unit.lat,
        lng: activeSelection.unit.lng,
        color: "#f59e0b",
        maxRadius: 4.2,
        propagationSpeed: 2,
        repeatPeriod: 980
      }
    ];
  }, [activeSelection]);

  React.useEffect(() => {
    let cancelled = false;

    async function initGlobe() {
      const module = await import("three-globe");
      const ThreeGlobe = module.default;
      const instance = new ThreeGlobe({ waitForGlobeReady: false });

      if (!cancelled) {
        setGlobe(instance);
      }
    }

    initGlobe();

    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!globe) {
      return;
    }

    globe
      .showAtmosphere(true)
      .atmosphereColor("#5eead4")
      .atmosphereAltitude(0.19)
      .showGraticules(true)
      .globeCurvatureResolution(3)
      .polygonsData(countries)
      .polygonCapColor(() => "rgba(12, 18, 32, 0.86)")
      .polygonSideColor(() => "rgba(8, 12, 22, 0.22)")
      .polygonStrokeColor(() => "rgba(103, 232, 249, 0.12)")
      .polygonAltitude(() => 0.008)
      .polygonCapCurvatureResolution(4)
      .labelsData(labels)
      .labelText((label) => label.text)
      .labelLat((label) => label.lat)
      .labelLng((label) => label.lng)
      .labelColor((label) => label.color)
      .labelSize((label) => label.size)
      .labelAltitude((label) => label.altitude)
      .labelIncludeDot((label) => label.dot ?? false)
      .labelDotRadius((label) => (label.dot ? 0.12 : 0.04))
      .labelDotOrientation(() => "right")
      .labelResolution(2)
      // Marcadores de sedes/origem são renderizados por uma camada customizada
      // (`InteractivePointLayer`) para hover/click e visual mais controlado.
      .pointsData([])
      .arcsData(arcs)
      .arcColor("color")
      .arcAltitude((arc) => arc.altitude)
      .arcStroke(() => 0.45)
      .arcDashLength(() => 0.36)
      .arcDashGap(() => 0.16)
      .arcDashAnimateTime(() => 1700)
      .arcCurveResolution(72)
      .arcsTransitionDuration(700)
      .ringsData(rings)
      .ringLat("lat")
      .ringLng("lng")
      .ringColor("color")
      .ringAltitude(() => 0.001)
      .ringMaxRadius("maxRadius")
      .ringPropagationSpeed("propagationSpeed")
      .ringRepeatPeriod("repeatPeriod");

    const material = globe.globeMaterial();

    if (material) {
      material.color = new THREE.Color("#050816");
      material.emissive = new THREE.Color("#0c1226");
      material.emissiveIntensity = 0.82;
      material.shininess = 10;
      material.specular = new THREE.Color("#38bdf8");
    }
  }, [arcs, countries, globe, labels, points, rings]);

  React.useEffect(() => {
    if (!globe) {
      return;
    }

    globe.rendererSize(new THREE.Vector2(size.width, size.height));
  }, [globe, size.height, size.width]);

  React.useEffect(() => {
    const target = focusCoordinates ?? DEFAULT_FOCUS;
    const distance = activeSelection ? CAMERA_DISTANCE_FOCUS : CAMERA_DISTANCE;
    targetCamera.current.copy(
      getFocusCameraPosition(globe, target.lat, target.lng, distance)
    );
    shouldAnimateCamera.current = true;
  }, [activeSelection, focusCoordinates, globe]);

  useFrame((_, delta) => {
    if (shouldAnimateCamera.current) {
      const damp = 1 - Math.exp(-delta * 2.2);

      camera.position.lerp(targetCamera.current, damp);
      camera.lookAt(0, 0, 0);

      if (controlsRef.current) {
        controlsRef.current.target.lerp(orbitTarget, damp);
        controlsRef.current.update();
      }

      if (camera.position.distanceTo(targetCamera.current) < 0.35) {
        shouldAnimateCamera.current = false;
      }
    }

    if (globe) {
      globe.setPointOfView(camera);
    }

    const cameraDistance = camera.position.length();
    const nextScale = clamp(mapRange(cameraDistance, 120, 420, 0.9, 1.22), 0.85, 1.25);
    setLabelScale((current) => current + (nextScale - current) * (1 - Math.exp(-delta * 10)));
  });

  return (
    <>
      <fog attach="fog" args={["#020617", 280, 560]} />
      <ambientLight intensity={1.35} color="#dbeafe" />
      <directionalLight
        position={[180, 120, 140]}
        intensity={2.2}
        color="#8be9fd"
      />
      <directionalLight
        position={[-160, -40, -120]}
        intensity={1}
        color="#fdba74"
      />
      <pointLight position={[0, 0, 210]} intensity={1.8} color="#38bdf8" />
      <Stars radius={360} depth={60} count={4200} factor={4.2} fade speed={0.7} />
      {globe && <primitive object={globe} />}
      {globe && (
        <InteractivePointLayer
          globe={globe}
          points={points}
          onClick={onUnitClick}
          hoveredUnitId={hoveredUnitId}
          onHoverUnitId={setHoveredUnitId}
        />
      )}
      {globe ? <UnitLabelLayer globe={globe} points={points} labelScale={labelScale} /> : null}
      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        minDistance={105}
        maxDistance={420}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.42}
        zoomSpeed={0.65}
        autoRotate={!activeSelection}
        autoRotateSpeed={0.28}
        onStart={() => {
          shouldAnimateCamera.current = false;
        }}
        onChange={() => {
          shouldAnimateCamera.current = false;
        }}
      />
    </>
  );
}

function InteractivePointLayer({ globe, points, onClick, hoveredUnitId, onHoverUnitId }) {
  const unitMaterial = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#ef4444"),
        emissive: new THREE.Color("#7f1d1d"),
        emissiveIntensity: 1.35,
        transparent: true,
        opacity: 0.92
      }),
    []
  );
  const hoveredUnitMaterial = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#22d3ee"),
        emissive: new THREE.Color("#67e8f9"),
        emissiveIntensity: 1.7,
        transparent: true,
        opacity: 0.96
      }),
    []
  );
  const selectedUnitMaterial = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#f59e0b"),
        emissive: new THREE.Color("#fbbf24"),
        emissiveIntensity: 1.55,
        transparent: true,
        opacity: 0.95
      }),
    []
  );
  const originMaterial = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#e2e8f0"),
        emissive: new THREE.Color("#67e8f9"),
        emissiveIntensity: 1.4,
        transparent: true,
        opacity: 0.92
      }),
    []
  );

  const coreGeometry = React.useMemo(() => new THREE.SphereGeometry(0.62, 18, 18), []);
  const glowGeometry = React.useMemo(() => new THREE.SphereGeometry(1.35, 18, 18), []);
  const unitGlowMaterial = React.useMemo(() => {
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#ef4444"),
      transparent: true,
      opacity: 0.14,
      depthWrite: false
    });
    mat.blending = THREE.AdditiveBlending;
    return mat;
  }, []);
  const selectedGlowMaterial = React.useMemo(() => {
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#f59e0b"),
      transparent: true,
      opacity: 0.18,
      depthWrite: false
    });
    mat.blending = THREE.AdditiveBlending;
    return mat;
  }, []);
  const hoveredGlowMaterial = React.useMemo(() => {
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#22d3ee"),
      transparent: true,
      opacity: 0.2,
      depthWrite: false
    });
    mat.blending = THREE.AdditiveBlending;
    return mat;
  }, []);
  const originGlowMaterial = React.useMemo(() => {
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#67e8f9"),
      transparent: true,
      opacity: 0.16,
      depthWrite: false
    });
    mat.blending = THREE.AdditiveBlending;
    return mat;
  }, []);

  return (
    <group>
      {points.map((point) => {
        const altitude = Math.max(0.03, point.altitude) + separationNudge(point.id);
        const coords = globe.getCoords(point.lat, point.lng, altitude);
        const position = new THREE.Vector3(coords.x, coords.y, coords.z);
        const isOrigin = point.pointType === "origin";
        const isUnit = point.pointType === "unit";
        const isSelected = Boolean(point.isSelected);
        const isHovered = isUnit && hoveredUnitId === point.id;
        const coreMaterial = isOrigin
          ? originMaterial
          : isHovered
            ? hoveredUnitMaterial
            : isSelected
            ? selectedUnitMaterial
            : unitMaterial;
        const glowMaterial = isOrigin
          ? originGlowMaterial
          : isHovered
            ? hoveredGlowMaterial
            : isSelected
            ? selectedGlowMaterial
            : unitGlowMaterial;

        return (
          <group
            key={`hover-${point.id}`}
            position={position}
          >
            <mesh
              geometry={glowGeometry}
              material={glowMaterial}
              raycast={() => null}
              scale={isOrigin ? 0.95 : isSelected || isHovered ? 1.08 : 0.85}
            />
            <mesh
              geometry={coreGeometry}
              material={coreMaterial}
              scale={isOrigin ? 0.95 : isSelected || isHovered ? 1.08 : 0.85}
              onPointerOver={(event) => {
                if (!isUnit) {
                  return;
                }
                event.stopPropagation();
                onHoverUnitId?.(point.id);
                document.body.style.cursor = "pointer";
              }}
              onPointerOut={(event) => {
                if (!isUnit) {
                  return;
                }
                event.stopPropagation();
                onHoverUnitId?.(null);
                document.body.style.cursor = "default";
              }}
              onClick={(event) => {
                event.stopPropagation();
                if (isUnit && typeof onClick === "function") {
                  onClick(point);
                }
              }}
            />
          </group>
        );
      })}
    </group>
  );
}

function UnitLabelLayer({ globe, points, labelScale }) {
  const unitPoints = React.useMemo(
    () => points.filter((point) => point.pointType === "unit"),
    [points]
  );

  return (
    <>
      {unitPoints.map((point) => {
        const altitude = Math.max(0.03, point.altitude) + 0.03;
        const coords = globe.getCoords(point.lat, point.lng, altitude);
        const position = [coords.x, coords.y, coords.z];

        return (
          <Html
            key={`label-${point.id}`}
            position={position}
            center
            style={{
              pointerEvents: "none",
              transform: `translate3d(-50%, -140%, 0) scale(${labelScale})`,
              transformOrigin: "center"
            }}
          >
            <div className="map-label">{point.name}</div>
          </Html>
        );
      })}
    </>
  );
}

function separationNudge(id) {
  const value = hashStringToUnitInterval(String(id || ""));
  // 0 .. ~0.008 de separação sutil, evita “pontos colados” sem distorcer o mapa.
  return value * 0.008;
}

function hashStringToUnitInterval(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return (hash % 1000) / 1000;
}

function mapRange(value, inMin, inMax, outMin, outMax) {
  if (!Number.isFinite(value)) {
    return outMin;
  }

  const clamped = clamp(value, inMin, inMax);
  const t = (clamped - inMin) / (inMax - inMin);
  return outMin + t * (outMax - outMin);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function latLngToVector3(lat, lng, radius) {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lng + 180);

  return new THREE.Vector3(
    -(radius * Math.sin(phi) * Math.cos(theta)),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

function getFocusCameraPosition(globe, lat, lng, cameraDistance) {
  if (globe?.getCoords) {
    const coords = globe.getCoords(lat, lng, 0);

    return new THREE.Vector3(coords.x, coords.y, coords.z)
      .normalize()
      .multiplyScalar(cameraDistance);
  }

  return latLngToVector3(lat, lng, cameraDistance);
}

function buildCountryLabels(features) {
  return features
    .map((feature) => {
      const text =
        feature?.properties?.ADMIN ||
        feature?.properties?.NAME ||
        feature?.properties?.name;
      const center = getFeatureCenter(feature);

      if (!text || !center) {
        return null;
      }

      return {
        id: `country-${text}`,
        text,
        lat: center.lat,
        lng: center.lng,
        size: text.length > 14 ? 0.2 : 0.24,
        color: "rgba(148, 163, 184, 0.6)",
        altitude: 0.016,
        dot: false
      };
    })
    .filter(Boolean);
}

function getFeatureCenter(feature) {
  const points = collectCoordinatePairs(feature?.geometry?.coordinates ?? []);

  if (!points.length) {
    return null;
  }

  let latSum = 0;
  let lngSum = 0;

  points.forEach(([lng, lat]) => {
    latSum += lat;
    lngSum += lng;
  });

  return {
    lat: latSum / points.length,
    lng: lngSum / points.length
  };
}

function collectCoordinatePairs(source, acc = []) {
  if (!Array.isArray(source) || !source.length) {
    return acc;
  }

  if (typeof source[0][0] === "number") {
    source.forEach((pair) => acc.push(pair));
    return acc;
  }

  source.forEach((item) => collectCoordinatePairs(item, acc));
  return acc;
}
