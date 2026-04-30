"use client";

import React from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";

const CAMERA_DISTANCE = 255;
const DEFAULT_FOCUS = {
  lat: -15.78,
  lng: -53.1
};

export default function Globe({ units, activeSelection, focusCoordinates }) {
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
        />
      </Canvas>
    </div>
  );
}

function Scene({ countries, units, activeSelection, focusCoordinates }) {
  const [globe, setGlobe] = React.useState(null);
  const controlsRef = React.useRef(null);
  const shouldAnimateCamera = React.useRef(true);
  const { camera, size } = useThree();
  const orbitTarget = React.useMemo(() => new THREE.Vector3(0, 0, 0), []);
  const targetCamera = React.useRef(
    latLngToVector3(DEFAULT_FOCUS.lat, DEFAULT_FOCUS.lng, CAMERA_DISTANCE)
  );

  const countryLabels = React.useMemo(
    () => buildCountryLabels(countries),
    [countries]
  );

  const points = React.useMemo(() => {
    const selectedUnitId = activeSelection?.unit?.id;

    const mappedUnits = units.map((unit) => ({
      ...unit,
      color: unit.id === selectedUnitId ? "#f59e0b" : "#22d3ee",
      altitude: unit.id === selectedUnitId ? 0.2 : 0.1,
      radius: unit.id === selectedUnitId ? 0.5 : 0.34,
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
        lat: activeSelection.place.lat,
        lng: activeSelection.place.lng,
        color: "#f8fafc",
        altitude: 0.14,
        radius: 0.32,
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
      .pointsData(points)
      .pointLat("lat")
      .pointLng("lng")
      .pointColor("color")
      .pointAltitude("altitude")
      .pointRadius("radius")
      .pointResolution(12)
      .pointsMerge(true)
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
    targetCamera.current.copy(
      getFocusCameraPosition(globe, target.lat, target.lng, CAMERA_DISTANCE)
    );
    shouldAnimateCamera.current = true;
  }, [focusCoordinates, globe]);

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
      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        minDistance={160}
        maxDistance={330}
        rotateSpeed={0.7}
        zoomSpeed={0.8}
        autoRotate={!activeSelection}
        autoRotateSpeed={0.28}
      />
    </>
  );
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
