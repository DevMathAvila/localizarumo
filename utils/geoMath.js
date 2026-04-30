const EARTH_RADIUS_KM = 6371;
const OSRM_BASE_URL = "https://router.project-osrm.org/route/v1/driving";

export function haversineDistanceKm(origin, destination) {
  const latDelta = toRadians(destination.lat - origin.lat);
  const lngDelta = toRadians(destination.lng - origin.lng);
  const originLat = toRadians(origin.lat);
  const destinationLat = toRadians(destination.lat);

  const haversineStep =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(originLat) *
      Math.cos(destinationLat) *
      Math.sin(lngDelta / 2) ** 2;

  const centralAngle =
    2 * Math.atan2(Math.sqrt(haversineStep), Math.sqrt(1 - haversineStep));

  return EARTH_RADIUS_KM * centralAngle;
}

export function findNearestUnit(origin, availableUnits) {
  if (!origin || !availableUnits?.length) {
    return null;
  }

  return availableUnits
    .map((unit) => ({
      unit,
      distanceKm: haversineDistanceKm(origin, unit)
    }))
    .sort((left, right) => left.distanceKm - right.distanceKm)[0];
}

export function estimateTravelTimeHours(distanceKm, averageSpeedKmh = 60) {
  return distanceKm / averageSpeedKmh;
}

export async function fetchDrivingDistanceKm(origin, destination) {
  const originLng = Number(origin?.lng);
  const originLat = Number(origin?.lat);
  const destinationLng = Number(destination?.lng);
  const destinationLat = Number(destination?.lat);

  if (
    !Number.isFinite(originLng) ||
    !Number.isFinite(originLat) ||
    !Number.isFinite(destinationLng) ||
    !Number.isFinite(destinationLat)
  ) {
    throw new Error("Coordenadas invalidas para rota rodoviaria.");
  }

  const response = await fetch(
    `${OSRM_BASE_URL}/${originLng},${originLat};${destinationLng},${destinationLat}?overview=false`,
    {
      headers: {
        Accept: "application/json"
      }
    }
  );

  if (!response.ok) {
    throw new Error("Falha ao consultar a rota rodoviaria.");
  }

  const payload = await response.json();
  const routeDistanceMeters = payload?.routes?.[0]?.distance;

  if (!Number.isFinite(routeDistanceMeters)) {
    throw new Error("Distancia rodoviaria indisponivel.");
  }

  return routeDistanceMeters / 1000;
}

export function estimateDrivingDistanceFallbackKm(airDistanceKm) {
  if (!Number.isFinite(airDistanceKm)) {
    return null;
  }

  return Math.max(airDistanceKm + 12, airDistanceKm * 1.22);
}

export function formatDistance(distanceKm) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 0
  }).format(distanceKm);
}

export function formatTravelTime(hours) {
  if (!Number.isFinite(hours)) {
    return "N/A";
  }

  const totalMinutes = Math.max(1, Math.round(hours * 60));
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (!wholeHours) {
    return `${minutes} min`;
  }

  if (!minutes) {
    return `${wholeHours}h`;
  }

  return `${wholeHours}h ${String(minutes).padStart(2, "0")}min`;
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}
