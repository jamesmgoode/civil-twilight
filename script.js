const latitudeEl = document.getElementById("latitude");
const longitudeEl = document.getElementById("longitude");
const locationStatusEl = document.getElementById("location-status");
const timeZoneEl = document.getElementById("time-zone");
const currentTimeEl = document.getElementById("current-time");
const currentPhaseEl = document.getElementById("current-phase");
const phaseDetailEl = document.getElementById("phase-detail");

const locationState = {
  latitude: null,
  longitude: null,
};

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZoneName: "short",
});

function formatCoordinate(value, positiveLabel, negativeLabel) {
  if (value === null) {
    return "--";
  }
  const label = value >= 0 ? positiveLabel : negativeLabel;
  return `${Math.abs(value).toFixed(4)}° ${label}`;
}

function getJulianDay(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

function getSolarAltitude(date, latitude, longitude) {
  const rad = Math.PI / 180;
  const jd = getJulianDay(date);
  const n = jd - 2451545.0;
  const meanLongitude = (280.46 + 0.9856474 * n) % 360;
  const meanAnomaly = (357.528 + 0.9856003 * n) % 360;
  const eclipticLongitude =
    meanLongitude + 1.915 * Math.sin(meanAnomaly * rad) + 0.02 * Math.sin(2 * meanAnomaly * rad);
  const obliquity = 23.439 - 0.0000004 * n;

  const declination =
    Math.asin(
      Math.sin(obliquity * rad) * Math.sin(eclipticLongitude * rad)
    ) / rad;

  const time = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const solarTime = time + longitude / 15;
  const hourAngle = (solarTime * 15 - 180) * rad;

  const altitude =
    Math.asin(
      Math.sin(latitude * rad) * Math.sin(declination * rad) +
        Math.cos(latitude * rad) * Math.cos(declination * rad) * Math.cos(hourAngle)
    ) / rad;

  return altitude;
}

function getPhaseLabel(altitude, isRising) {
  if (altitude > 0) {
    return "Day";
  }
  if (altitude > -6) {
    return isRising ? "Civil dawn" : "Civil twilight";
  }
  if (altitude > -12) {
    return isRising ? "Nautical dawn" : "Nautical twilight";
  }
  if (altitude > -18) {
    return isRising ? "Astronomical dawn" : "Astronomical twilight";
  }
  return "Night";
}

function getPhaseDetails(altitude) {
  if (altitude > 0) {
    return "The sun is above the horizon.";
  }
  if (altitude > -6) {
    return "Soft light still lingers below the horizon.";
  }
  if (altitude > -12) {
    return "The horizon is faintly visible to the naked eye.";
  }
  if (altitude > -18) {
    return "The sky is nearly dark with minimal glow.";
  }
  return "The sun is well below the horizon.";
}

function updateTime() {
  const now = new Date();
  const timeParts = timeFormatter.formatToParts(now);
  const tzPart = timeParts.find((part) => part.type === "timeZoneName");
  timeZoneEl.textContent = tzPart ? tzPart.value : "Local time";
  currentTimeEl.textContent = timeFormatter.format(now);
}

function updatePhase() {
  if (locationState.latitude === null || locationState.longitude === null) {
    currentPhaseEl.textContent = "--";
    phaseDetailEl.textContent = "Awaiting location data.";
    return;
  }

  const now = new Date();
  const altitudeNow = getSolarAltitude(now, locationState.latitude, locationState.longitude);
  const future = new Date(now.getTime() + 10 * 60 * 1000);
  const altitudeFuture = getSolarAltitude(future, locationState.latitude, locationState.longitude);
  const isRising = altitudeFuture > altitudeNow;

  const phaseLabel = getPhaseLabel(altitudeNow, isRising);
  currentPhaseEl.textContent = phaseLabel;
  phaseDetailEl.textContent = getPhaseDetails(altitudeNow);
}

function updateLocationDisplay() {
  latitudeEl.textContent = formatCoordinate(locationState.latitude, "N", "S");
  longitudeEl.textContent = formatCoordinate(locationState.longitude, "E", "W");
}

function handleLocationSuccess(position) {
  locationState.latitude = position.coords.latitude;
  locationState.longitude = position.coords.longitude;
  locationStatusEl.textContent = "Location locked.";
  updateLocationDisplay();
  updatePhase();
}

function handleLocationError(error) {
  locationStatusEl.textContent = "Location unavailable.";
  phaseDetailEl.textContent =
    error.code === error.PERMISSION_DENIED
      ? "Allow location access to see the current sky phase."
      : "We could not read your location.";
}

function requestLocation() {
  if (!navigator.geolocation) {
    locationStatusEl.textContent = "Geolocation not supported.";
    return;
  }
  navigator.geolocation.getCurrentPosition(handleLocationSuccess, handleLocationError);
}

updateTime();
updatePhase();
requestLocation();
setInterval(updateTime, 1000);
setInterval(updatePhase, 60000);
