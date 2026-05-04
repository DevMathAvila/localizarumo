"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Clock3, MapPinned, Radar, Route, Warehouse } from "lucide-react";
import Search from "@/components/Search";
import { units } from "@/constants/units";
import {
  estimateTravelTimeHours,
  fetchDrivingDistanceKm,
  haversineDistanceKm,
  findNearestUnit,
  findNearestUnits,
  formatDistance,
  formatTravelTime
} from "@/utils/geoMath";

const Globe = dynamic(() => import("@/components/Globe"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 animate-pulse bg-slate-950/60" />
  )
});

const BRAZIL_FOCUS = {
  lat: -15.78,
  lng: -53.1
};

export default function HomePage() {
  const [selectedPlace, setSelectedPlace] = React.useState(null);
  const [selection, setSelection] = React.useState(null);
  const [unitPopup, setUnitPopup] = React.useState(null);
  const latestSelectionRequestRef = React.useRef(0);

  React.useEffect(() => {
    let cancelled = false;

    async function resolveFromGeolocation() {
      if (selection) {
        return;
      }

      if (typeof window === "undefined") {
        return;
      }

      if (!("geolocation" in navigator)) {
        return;
      }

      const place = await new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              id: "geolocation",
              label: "Minha localização",
              subtitle: "Localização atual do navegador",
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              type: "geolocation",
              source: "browser"
            });
          },
          () => resolve(null),
          {
            enableHighAccuracy: true,
            timeout: 9000,
            maximumAge: 120000
          }
        );
      });

      if (cancelled || !place) {
        return;
      }

      await handleSelect(place);
    }

    resolveFromGeolocation();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSelect(place) {
    const nearest = findNearestUnit(place, units);
    const nearestRanking = findNearestUnits(place, units, 3);

    if (!nearest) {
      return;
    }

    const requestId = latestSelectionRequestRef.current + 1;
    latestSelectionRequestRef.current = requestId;
    const airDistanceKm = nearest.distanceKm;

    setSelectedPlace(place);
    setSelection({
      place,
      unit: nearest.unit,
      nearestRanking,
      airDistanceKm,
      drivingDistanceKm: null,
      drivingDistanceSource: "loading",
      travelHours: null
    });

    try {
      const drivingDistanceKm = await fetchDrivingDistanceKm(place, nearest.unit);

      if (latestSelectionRequestRef.current !== requestId) {
        return;
      }

      setSelection({
        place,
        unit: nearest.unit,
        nearestRanking,
        airDistanceKm,
        drivingDistanceKm,
        drivingDistanceSource: "api",
        travelHours: estimateTravelTimeHours(drivingDistanceKm)
      });
    } catch {
      if (latestSelectionRequestRef.current !== requestId) {
        return;
      }

      setSelection({
        place,
        unit: nearest.unit,
        nearestRanking,
        airDistanceKm,
        drivingDistanceKm: null,
        drivingDistanceSource: "unavailable",
        travelHours: null
      });
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="absolute inset-0 hud-grid opacity-70" />

      <div className="absolute inset-0">
        <Globe
          units={units}
          activeSelection={selection}
          focusCoordinates={selection?.place ?? BRAZIL_FOCUS}
          onUnitClick={(unit) => {
            const origin = selection?.place;
            const airDistanceKm =
              origin && unit ? haversineDistanceKm(origin, unit) : null;

            setUnitPopup({
              unit,
              airDistanceKm
            });
          }}
        />
      </div>

      <div className="pointer-events-none absolute inset-0 z-10">
        <header className="pointer-events-auto absolute left-4 top-4 max-w-sm md:left-6 md:top-6">
          <div className="glass-panel rounded-2xl p-5">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.24em] text-cyan-200">
              <Radar className="h-3.5 w-3.5" />
              Monitoramento Logistico
            </div>

            <h1 className="font-display text-3xl font-semibold text-white text-glow">
              Rumo Visual Logistics
            </h1>

            <p className="mt-3 text-sm leading-6 text-slate-300">
              Explore a malha operacional em um globo 3D e encontre a unidade
              da Rumo mais proxima de qualquer cidade ou estado brasileiro.
            </p>
          </div>
        </header>

        <div className="pointer-events-auto absolute right-4 top-4 w-[min(92vw,29rem)] md:right-6 md:top-6">
          <Search onSelect={handleSelect} selectedPlace={selectedPlace} />
        </div>

        <aside className="pointer-events-auto absolute bottom-4 left-4 w-[min(92vw,24rem)] md:bottom-6 md:left-6">
          <div className="glass-panel rounded-2xl p-5">
            {selection ? (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/80">
                      Unidade Mais Proxima
                    </p>
                    <h2 className="font-display mt-2 text-2xl font-semibold text-white">
                      {selection.unit.name}
                    </h2>
                    <p className="mt-1 text-sm text-slate-300">
                      {selection.unit.city}, {selection.unit.state}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-amber-300/15 bg-amber-300/10 p-3 text-amber-200">
                    <Warehouse className="h-5 w-5" />
                  </div>
                </div>

                <div className="mt-5 grid gap-3">
                  <MetricRow
                    icon={MapPinned}
                    label="Origem Selecionada"
                    value={selection.place.label}
                  />
                  <MetricRow
                    icon={Route}
                    label="Distancia de Carro"
                    value={formatDrivingDistance(selection)}
                  />
                  <MetricRow
                    icon={Route}
                    label="Distancia Aerea"
                    value={`${formatDistance(selection.airDistanceKm)} km`}
                  />
                  <MetricRow
                    icon={Clock3}
                    label="Tempo Estimado de Carro"
                    value={formatTravelTimeValue(selection)}
                  />
                </div>

                {selection.nearestRanking?.length ? (
                  <div className="mt-5 rounded-2xl border border-white/6 bg-white/4 px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      Top 3 sedes mais próximas
                    </p>
                    <ol className="mt-3 space-y-2 text-sm text-slate-200">
                      {selection.nearestRanking.map((entry, index) => (
                        <li
                          key={entry.unit.id}
                          className="flex items-center justify-between gap-3"
                        >
                          <span className="min-w-0 truncate">
                            <span className="text-slate-400">{index + 1}.</span>{" "}
                            <span className="font-medium text-white">{entry.unit.name}</span>{" "}
                            <span className="text-slate-400">
                              ({entry.unit.city}/{entry.unit.state})
                            </span>
                          </span>
                          <span className="shrink-0 text-xs text-cyan-200/80">
                            {formatDistance(entry.distanceKm)} km
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : null}

                <p className="mt-5 text-xs leading-5 text-slate-400">
                  Distancia aerea em linha reta via Haversine. Distancia de carro
                  via rota rodoviaria calculada em estrada.
                </p>
              </>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/80">
                      Mapa Inicial
                    </p>
                    <h2 className="font-display mt-2 text-2xl font-semibold text-white">
                      Rede pronta para consulta
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-slate-300">
                      Pesquise uma cidade ou estado no Brasil para calcular a
                      unidade operacional mais proxima e desenhar a rota no globo.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/10 p-3 text-cyan-200">
                    <Warehouse className="h-5 w-5" />
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <StatCard value={`${units.length}`} label="Unidades locais" />
                  <StatCard value="60 km/h" label="Velocidade media" />
                </div>
              </>
            )}
          </div>
        </aside>

        {unitPopup?.unit ? (
          <aside className="pointer-events-auto absolute bottom-4 right-4 w-[min(92vw,26rem)] md:bottom-6 md:right-6">
            <div className="glass-panel rounded-2xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/80">
                    Detalhes da sede
                  </p>
                  <h3 className="font-display mt-2 text-2xl font-semibold text-white">
                    {unitPopup.unit.name}
                  </h3>
                  <p className="mt-1 text-sm text-slate-300">
                    {unitPopup.unit.city}, {unitPopup.unit.state}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setUnitPopup(null)}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.18em] text-slate-200 transition hover:bg-white/10"
                >
                  Fechar
                </button>
              </div>

              <div className="mt-5 grid gap-3">
                <MetricRow
                  icon={Warehouse}
                  label="Sede"
                  value={`${unitPopup.unit.name} (${unitPopup.unit.city}/${unitPopup.unit.state})`}
                />
                <MetricRow
                  icon={Route}
                  label="Coordenadas"
                  value={`${unitPopup.unit.lat.toFixed(5)}, ${unitPopup.unit.lng.toFixed(5)}`}
                />
                {Number.isFinite(unitPopup.airDistanceKm) ? (
                  <MetricRow
                    icon={MapPinned}
                    label="Distância aérea até origem"
                    value={`${formatDistance(unitPopup.airDistanceKm)} km`}
                  />
                ) : null}
              </div>

              <p className="mt-5 text-xs leading-5 text-slate-400">
                Clique em qualquer sede no globo para ver este painel.
              </p>
            </div>
          </aside>
        ) : null}
      </div>
    </main>
  );
}

function MetricRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/6 bg-white/4 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="rounded-xl border border-cyan-300/15 bg-cyan-300/10 p-2 text-cyan-100">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
            {label}
          </p>
          <p className="mt-1 text-sm font-medium text-white">{value}</p>
        </div>
      </div>
    </div>
  );
}

function StatCard({ value, label }) {
  return (
    <div className="rounded-2xl border border-white/6 bg-white/4 px-4 py-4">
      <p className="font-display text-2xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">
        {label}
      </p>
    </div>
  );
}

function formatDrivingDistance(selection) {
  if (selection?.drivingDistanceSource === "unavailable") {
    return "Rota indisponivel";
  }

  if (!Number.isFinite(selection?.drivingDistanceKm)) {
    return "Calculando...";
  }

  return `${formatDistance(selection.drivingDistanceKm)} km`;
}

function formatTravelTimeValue(selection) {
  if (selection?.drivingDistanceSource === "unavailable") {
    return "Rota indisponivel";
  }

  if (!Number.isFinite(selection?.travelHours)) {
    return "Calculando...";
  }

  return formatTravelTime(selection.travelHours);
}
