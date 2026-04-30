"use client";

import React from "react";
import { LoaderCircle, MapPin, Search as SearchIcon } from "lucide-react";
import { findBrazilStateByName } from "@/constants/brazilStates";
import { units } from "@/constants/units";

const BRAZIL_BBOX = "-74,-34,-34,6";
const MAX_RESULTS = 6;
const ALLOWED_TYPES = new Set([
  "city",
  "town",
  "village",
  "district",
  "county",
  "state",
  "administrative",
  "locality"
]);

export default function Search({ onSelect, selectedPlace }) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef(null);

  React.useEffect(() => {
    if (selectedPlace?.label) {
      setQuery(selectedPlace.label);
    }
  }, [selectedPlace]);

  React.useEffect(() => {
    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  React.useEffect(() => {
    const trimmed = query.trim();

    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      setError("");
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");

      try {
        const localMatches = buildLocalUnitMatches(trimmed);
        const photonMatches = await fetchPhotonMatches(trimmed, controller.signal);

        const mergedResults = dedupePlaces(
          sortPlacesByQuery(trimmed, [...localMatches, ...photonMatches])
        ).slice(0, MAX_RESULTS);

        setResults(mergedResults);
        setOpen(true);

        if (!mergedResults.length) {
          setError("Nenhuma cidade, estado ou unidade encontrado.");
        }
      } catch (requestError) {
        if (requestError.name === "AbortError") {
          return;
        }

        const localMatches = buildLocalUnitMatches(trimmed);

        if (localMatches.length) {
          setResults(localMatches.slice(0, MAX_RESULTS));
          setError("");
        } else {
          setResults([]);
          setError("Nao foi possivel consultar o autocomplete agora.");
        }

        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 260);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  function handleSelect(place) {
    setQuery(place.label);
    setResults([]);
    setOpen(false);
    setError("");
    onSelect(place);
  }

  return (
    <div ref={rootRef} className="glass-panel rounded-2xl p-3">
      <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
        <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-2 text-cyan-100">
          <SearchIcon className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <label
            htmlFor="city-search"
            className="mb-1 block text-[11px] uppercase tracking-[0.22em] text-slate-400"
          >
            Buscar cidade, estado ou unidade
          </label>

          <div className="flex items-center gap-3">
            <input
              id="city-search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                if (!open) {
                  setOpen(true);
                }
              }}
              onFocus={() => {
                if (results.length || error) {
                  setOpen(true);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && results[0]) {
                  event.preventDefault();
                  handleSelect(results[0]);
                }
              }}
              placeholder="Ex.: Indaiatuba, Mato Grosso, Sao Simao"
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
            />

            {loading && (
              <LoaderCircle className="h-4 w-4 animate-spin text-cyan-200" />
            )}
          </div>
        </div>
      </div>

      {open && (results.length > 0 || error) && (
        <div className="mt-3 overflow-hidden rounded-2xl border border-white/8 bg-slate-950/85">
          {results.map((place) => (
            <button
              key={place.id}
              type="button"
              onClick={() => handleSelect(place)}
              className="flex w-full items-start gap-3 border-b border-white/6 px-4 py-3 text-left transition hover:bg-white/5 last:border-b-0"
            >
              <div className="mt-0.5 rounded-xl border border-cyan-400/15 bg-cyan-400/10 p-2 text-cyan-100">
                <MapPin className="h-4 w-4" />
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">
                  {place.label}
                </p>
                <p className="mt-1 text-xs text-slate-400">{place.subtitle}</p>
              </div>
            </button>
          ))}

          {!results.length && error && (
            <div className="px-4 py-3 text-sm text-slate-400">{error}</div>
          )}
        </div>
      )}
    </div>
  );
}

async function fetchPhotonMatches(query, signal) {
  const params = new URLSearchParams({
    q: query,
    limit: "10",
    bbox: BRAZIL_BBOX
  });

  const response = await fetch(`https://photon.komoot.io/api/?${params.toString()}`, {
    signal
  });

  if (!response.ok) {
    throw new Error("Falha ao consultar o Photon.");
  }

  const payload = await response.json();

  return (payload.features ?? [])
    .map(normalizePhotonFeature)
    .filter(Boolean);
}

function buildLocalUnitMatches(query) {
  const normalizedQuery = normalizeText(query);

  return units
    .filter((unit) => {
      const haystack = [unit.name, unit.city, unit.state]
        .map(normalizeText)
        .join(" ");

      return haystack.includes(normalizedQuery);
    })
    .map((unit) => ({
      id: `unit-${unit.id}`,
      label: unit.name,
      subtitle: `Unidade Rumo - ${unit.city}/${unit.state}`,
      lat: unit.lat,
      lng: unit.lng,
      type: "unit",
      source: "local-unit",
      city: unit.city,
      state: unit.state
    }));
}

function normalizePhotonFeature(feature) {
  const properties = feature?.properties ?? {};
  const coordinates = feature?.geometry?.coordinates ?? [];
  const [lng, lat] = coordinates;
  const type = String(properties.type ?? "").toLowerCase();
  const countryCode = String(properties.countrycode ?? "").toUpperCase();
  const country = String(properties.country ?? "").toLowerCase();

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  if (countryCode && countryCode !== "BR") {
    return null;
  }

  if (!countryCode && country && country !== "brasil" && country !== "brazil") {
    return null;
  }

  if (!ALLOWED_TYPES.has(type) && !properties.city && !properties.state) {
    return null;
  }

  const baseLabel = properties.name || properties.city || properties.state;

  if (!baseLabel) {
    return null;
  }

  let state = properties.state || "";
  let city =
    properties.city ||
    (type === "city" || type === "town" || type === "village" ? baseLabel : "");
  let label = state === baseLabel ? `${baseLabel} (Estado)` : baseLabel;
  let resolvedLat = lat;
  let resolvedLng = lng;

  if (type === "state") {
    const stateInfo = findBrazilStateByName(baseLabel);

    if (stateInfo) {
      state = stateInfo.code;
      city = stateInfo.capital;
      label = `${baseLabel} (${stateInfo.capital})`;
      resolvedLat = stateInfo.lat;
      resolvedLng = stateInfo.lng;
    }
  }

  const subtitle = [
    city && city !== baseLabel ? city : null,
    state,
    "Brasil"
  ]
    .filter(Boolean)
    .join(" - ");

  return {
    id: `${baseLabel}-${state || "NA"}-${lat.toFixed(4)}-${lng.toFixed(4)}`,
    label,
    subtitle: subtitle || "Brasil",
    lat: resolvedLat,
    lng: resolvedLng,
    type,
    source: "photon",
    city,
    state
  };
}

function sortPlacesByQuery(query, places) {
  return [...places].sort((left, right) => scorePlace(right, query) - scorePlace(left, query));
}

function scorePlace(place, query) {
  const normalizedQuery = normalizeText(query);
  const label = normalizeText(place.label);
  const city = normalizeText(place.city || "");
  const state = normalizeText(place.state || "");
  const subtitle = normalizeText(place.subtitle || "");

  let score = 0;

  if (place.source === "local-unit") {
    score += 120;
  }

  if (label === normalizedQuery) {
    score += 100;
  } else if (label.startsWith(normalizedQuery)) {
    score += 80;
  } else if (label.includes(normalizedQuery)) {
    score += 50;
  }

  if (city === normalizedQuery) {
    score += 40;
  } else if (city.startsWith(normalizedQuery)) {
    score += 25;
  }

  if (state === normalizedQuery) {
    score += 15;
  }

  if (subtitle.includes(normalizedQuery)) {
    score += 10;
  }

  score += typePriority(place.type);

  return score;
}

function typePriority(type) {
  switch (type) {
    case "unit":
      return 40;
    case "state":
      return 28;
    case "city":
    case "town":
    case "village":
      return 24;
    case "administrative":
      return 16;
    case "district":
    case "county":
    case "locality":
      return 8;
    default:
      return 0;
  }
}

function dedupePlaces(places) {
  return Array.from(
    new Map(
      places.map((place) => [
        `${normalizeText(place.label)}-${normalizeText(place.state || "")}-${place.lat.toFixed(4)}-${place.lng.toFixed(4)}`,
        place
      ])
    ).values()
  );
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
