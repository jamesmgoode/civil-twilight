const latitudeEl = document.getElementById("latitude");
const longitudeEl = document.getElementById("longitude");
const locationStatusEl = document.getElementById("location-status");
const timeZoneEl = document.getElementById("time-zone");
const currentTimeEl = document.getElementById("current-time");
const nextPhaseLabelEl = document.getElementById("next-phase-label");
const nextPhaseCountdownEl = document.getElementById("next-phase-countdown");
const currentPhaseEl = document.getElementById("current-phase");
const phaseDetailEl = document.getElementById("phase-detail");
const moonPhaseEl = document.getElementById("moon-phase");
const moonDetailEl = document.getElementById("moon-detail");
const manualTimeToggleEl = document.getElementById("manual-time-toggle");
const manualTimeInputEl = document.getElementById("manual-time-input");
const manualTimeStatusEl = document.getElementById("manual-time-status");
const resetTimeButtonEl = document.getElementById("reset-time");
const sunEl = document.querySelector(".sun");
const moonEl = document.querySelector(".moon");

const locationState = {
  latitude: null,
  longitude: null,
};

const manualTimeState = {
  enabled: false,
  timeString: null,
};

const phaseState = {
  nextEventTime: null,
  nextEventLabel: "--",
};

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZoneName: "short",
});

const timeOnlyFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function formatCoordinate(value, positiveLabel, negativeLabel) {
  if (value === null) {
    return "--";
  }
  const label = value >= 0 ? positiveLabel : negativeLabel;
  return `${Math.abs(value).toFixed(4)}° ${label}`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function lerp(start, end, progress) {
  return start + (end - start) * progress;
}

function formatTwoDigits(value) {
  return String(value).padStart(2, "0");
}

function getManualDate() {
  if (!manualTimeState.enabled || !manualTimeState.timeString) {
    return null;
  }
  const now = new Date();
  const [hours, minutes, seconds] = manualTimeState.timeString
    .split(":")
    .map((part) => Number(part));
  const manualDate = new Date(now);
  manualDate.setHours(hours || 0, minutes || 0, seconds || 0, 0);
  return manualDate;
}

function getDisplayDate() {
  return getManualDate() || new Date();
}

function getDaylightProgress(date) {
  const hours = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  const dayProgress = (hours - 6) / 12;
  const clamped = clamp(dayProgress, 0, 1);
  const isDaytime = hours >= 6 && hours <= 18;
  if (!isDaytime) {
    return 0;
  }
  return Math.sin(clamped * Math.PI);
}

function updateBackground(date) {
  const progress = getDaylightProgress(date);
  const hue = lerp(222, 200, progress);
  const midHue = lerp(222, 210, progress);
  const lightness = lerp(14, 46, progress);
  const midLightness = lerp(10, 32, progress);
  const endLightness = lerp(6, 20, progress);

  document.documentElement.style.setProperty(
    "--bg-start",
    `hsl(${hue}, 42%, ${lightness}%)`
  );
  document.documentElement.style.setProperty(
    "--bg-mid",
    `hsl(${midHue}, 36%, ${midLightness}%)`
  );
  document.documentElement.style.setProperty(
    "--bg-end",
    `hsl(${midHue}, 40%, ${endLightness}%)`
  );
}

function getSunAltitudeEstimate(date) {
  if (locationState.latitude !== null && locationState.longitude !== null) {
    return getSolarAltitude(date, locationState.latitude, locationState.longitude);
  }
  const hours = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  const dayProgress = clamp((hours - 6) / 12, 0, 1);
  if (hours < 6 || hours > 18) {
    return -12;
  }
  return Math.sin(dayProgress * Math.PI) * 45;
}

function updateSunPosition(date) {
  if (!sunEl) {
    return;
  }
  const hours = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  const dayProgress = clamp((hours - 6) / 12, 0, 1);
  const altitude = getSunAltitudeEstimate(date);

  const sunX = lerp(88, 12, dayProgress);
  const horizonY = 50;
  const maxLift = 28;
  const maxDrop = 12;
  let sunY = horizonY;
  if (altitude >= 0) {
    sunY = horizonY - Math.min(altitude / 60, 1) * maxLift;
  } else {
    sunY = horizonY + Math.min(Math.abs(altitude) / 18, 1) * maxDrop;
  }

  const belowHorizon = altitude < 0;
  const dimAmount = belowHorizon ? Math.min(Math.abs(altitude) / 18, 1) : 0;
  const opacity = lerp(1, 0.25, dimAmount);
  const brightness = lerp(1, 0.35, dimAmount);

  sunEl.style.setProperty("--sun-x", `${sunX}%`);
  sunEl.style.setProperty("--sun-y", `${sunY}%`);
  sunEl.style.setProperty("--sun-opacity", opacity.toFixed(2));
  sunEl.style.setProperty("--sun-brightness", brightness.toFixed(2));
}

function getJulianDay(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

function toJulian(date) {
  return date.getTime() / 86400000 - 0.5 + 2440588;
}

function toDays(date) {
  return toJulian(date) - 2451545;
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

const MOON_RAD = Math.PI / 180;
const EARTH_OBLIQUITY = MOON_RAD * 23.4397;

function getSunCoords(days) {
  const meanAnomaly = MOON_RAD * (357.5291 + 0.98560028 * days);
  const center =
    MOON_RAD * (1.9148 * Math.sin(meanAnomaly) + 0.02 * Math.sin(2 * meanAnomaly));
  const perihelion = MOON_RAD * 102.9372;
  const longitude = meanAnomaly + center + perihelion + Math.PI;
  return {
    dec: Math.asin(Math.sin(EARTH_OBLIQUITY) * Math.sin(longitude)),
    ra: Math.atan2(
      Math.cos(EARTH_OBLIQUITY) * Math.sin(longitude),
      Math.cos(longitude)
    ),
  };
}

function getMoonCoords(days) {
  const meanLongitude = MOON_RAD * (218.316 + 13.176396 * days);
  const meanAnomaly = MOON_RAD * (134.963 + 13.064993 * days);
  const meanDistance = MOON_RAD * (93.272 + 13.22935 * days);
  const longitude = meanLongitude + MOON_RAD * 6.289 * Math.sin(meanAnomaly);
  const latitude = MOON_RAD * 5.128 * Math.sin(meanDistance);
  const distance = 385001 - 20905 * Math.cos(meanAnomaly);
  return {
    ra: Math.atan2(
      Math.sin(longitude) * Math.cos(EARTH_OBLIQUITY) -
        Math.tan(latitude) * Math.sin(EARTH_OBLIQUITY),
      Math.cos(longitude)
    ),
    dec: Math.asin(
      Math.sin(latitude) * Math.cos(EARTH_OBLIQUITY) +
        Math.cos(latitude) * Math.sin(EARTH_OBLIQUITY) * Math.sin(longitude)
    ),
    dist: distance,
  };
}

function getSiderealTime(days, longitude) {
  return MOON_RAD * (280.16 + 360.9856235 * days) - MOON_RAD * longitude;
}

function getMoonAltitude(date, latitude, longitude) {
  const days = toDays(date);
  const moon = getMoonCoords(days);
  const hourAngle = getSiderealTime(days, longitude) - moon.ra;
  const phi = MOON_RAD * latitude;
  return Math.asin(
    Math.sin(phi) * Math.sin(moon.dec) +
      Math.cos(phi) * Math.cos(moon.dec) * Math.cos(hourAngle)
  );
}

function getMoonIllumination(date) {
  const days = toDays(date);
  const sun = getSunCoords(days);
  const moon = getMoonCoords(days);
  const sunDistance = 149598000;
  const phi = Math.acos(
    Math.sin(sun.dec) * Math.sin(moon.dec) +
      Math.cos(sun.dec) * Math.cos(moon.dec) * Math.cos(sun.ra - moon.ra)
  );
  const inc = Math.atan2(
    sunDistance * Math.sin(phi),
    moon.dist - sunDistance * Math.cos(phi)
  );
  const angle = Math.atan2(
    Math.cos(sun.dec) * Math.sin(sun.ra - moon.ra),
    Math.sin(sun.dec) * Math.cos(moon.dec) -
      Math.cos(sun.dec) * Math.sin(moon.dec) * Math.cos(sun.ra - moon.ra)
  );
  const fraction = (1 + Math.cos(inc)) / 2;
  const phase = 0.5 + (inc * (angle < 0 ? -1 : 1)) / (2 * Math.PI);
  return { fraction, phase };
}

function getMoonPhaseLabel(phase) {
  if (phase <= 0.03 || phase >= 0.97) {
    return "New moon";
  }
  if (phase <= 0.22) {
    return "Waxing crescent";
  }
  if (phase <= 0.28) {
    return "First quarter";
  }
  if (phase <= 0.47) {
    return "Waxing gibbous";
  }
  if (phase <= 0.53) {
    return "Full moon";
  }
  if (phase <= 0.72) {
    return "Waning gibbous";
  }
  if (phase <= 0.78) {
    return "Last quarter";
  }
  return "Waning crescent";
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
  const roundedAltitude = Math.round(Math.abs(altitude));
  return `The sun is well below the horizon (about ${roundedAltitude}° below).`;
}

function getPhaseLabelAt(date, latitude, longitude) {
  const altitudeNow = getSolarAltitude(date, latitude, longitude);
  const future = new Date(date.getTime() + 10 * 60 * 1000);
  const altitudeFuture = getSolarAltitude(future, latitude, longitude);
  const isRising = altitudeFuture > altitudeNow;
  return getPhaseLabel(altitudeNow, isRising);
}

function getNextPhaseEvent(now, latitude, longitude) {
  const currentLabel = getPhaseLabelAt(now, latitude, longitude);
  const stepMinutes = 2;
  let previousTime = now;

  for (let minutes = stepMinutes; minutes <= 24 * 60; minutes += stepMinutes) {
    const probeTime = new Date(now.getTime() + minutes * 60 * 1000);
    const probeLabel = getPhaseLabelAt(probeTime, latitude, longitude);
    if (probeLabel !== currentLabel) {
      let low = previousTime;
      let high = probeTime;

      for (let i = 0; i < 24; i += 1) {
        const midTime = new Date((low.getTime() + high.getTime()) / 2);
        const midLabel = getPhaseLabelAt(midTime, latitude, longitude);
        if (midLabel === currentLabel) {
          low = midTime;
        } else {
          high = midTime;
        }
      }

      return {
        label: getPhaseLabelAt(high, latitude, longitude),
        time: high,
      };
    }
    previousTime = probeTime;
  }

  return null;
}

function formatCountdown(targetTime, now) {
  if (!targetTime) {
    return "--";
  }
  const diffMs = Math.max(0, targetTime.getTime() - now.getTime());
  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [];
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  parts.push(`${String(minutes).padStart(2, "0")}m`);
  parts.push(`${String(seconds).padStart(2, "0")}s`);
  return `in ${parts.join(" ")}`;
}

function updateCountdown() {
  if (!phaseState.nextEventTime) {
    nextPhaseCountdownEl.textContent = "--";
    return;
  }
  const countdown = formatCountdown(phaseState.nextEventTime, getDisplayDate());
  nextPhaseCountdownEl.textContent = `${countdown} (at ${timeOnlyFormatter.format(
    phaseState.nextEventTime
  )})`;
}

function updateTime() {
  const now = getDisplayDate();
  const timeParts = timeFormatter.formatToParts(new Date());
  const tzPart = timeParts.find((part) => part.type === "timeZoneName");
  timeZoneEl.textContent = tzPart ? tzPart.value : "Local time";
  currentTimeEl.textContent = timeFormatter.format(now);
  updateCountdown();
  updateBackground(now);
  updateSunPosition(now);
}

function updatePhase() {
  if (locationState.latitude === null || locationState.longitude === null) {
    currentPhaseEl.textContent = "--";
    phaseDetailEl.textContent = "Awaiting location data.";
    nextPhaseLabelEl.textContent = "Next phase: --";
    phaseState.nextEventTime = null;
    phaseState.nextEventLabel = "--";
    moonPhaseEl.textContent = "--";
    moonDetailEl.textContent = "Awaiting location data.";
    if (moonEl) {
      moonEl.classList.add("moon--hidden");
    }
    updateCountdown();
    updateSunPosition(getDisplayDate());
    return;
  }

  const now = getDisplayDate();
  const altitudeNow = getSolarAltitude(now, locationState.latitude, locationState.longitude);
  const future = new Date(now.getTime() + 10 * 60 * 1000);
  const altitudeFuture = getSolarAltitude(future, locationState.latitude, locationState.longitude);
  const isRising = altitudeFuture > altitudeNow;

  const phaseLabel = getPhaseLabel(altitudeNow, isRising);
  currentPhaseEl.textContent = phaseLabel;
  phaseDetailEl.textContent = getPhaseDetails(altitudeNow);

  const nextEvent = getNextPhaseEvent(now, locationState.latitude, locationState.longitude);
  if (nextEvent) {
    phaseState.nextEventTime = nextEvent.time;
    phaseState.nextEventLabel = nextEvent.label;
    nextPhaseLabelEl.textContent = `Next phase: ${nextEvent.label}`;
  } else {
    phaseState.nextEventTime = null;
    phaseState.nextEventLabel = "--";
    nextPhaseLabelEl.textContent = "Next phase: --";
  }
  updateCountdown();
  updateSunPosition(now);
  updateMoonPhase(now);
}

function updateMoonPhase(date) {
  if (!moonPhaseEl || !moonDetailEl || !moonEl) {
    return;
  }
  const { fraction, phase } = getMoonIllumination(date);
  const phaseLabel = getMoonPhaseLabel(phase);
  const altitude = getMoonAltitude(
    date,
    locationState.latitude,
    locationState.longitude
  );
  const isVisible = altitude > 0;
  const illuminationPercent = Math.round(fraction * 100);

  moonPhaseEl.textContent = phaseLabel;
  moonDetailEl.textContent = `Illuminated ${illuminationPercent}% · ${
    isVisible ? "Above horizon" : "Below horizon"
  }`;

  const phaseDirection = phase <= 0.5 ? 1 : -1;
  const offset = phaseDirection * fraction;
  moonEl.style.setProperty("--moon-phase-offset", offset.toFixed(3));
  moonEl.classList.toggle("moon--hidden", !isVisible);
}

function updateManualTimeStatus() {
  if (manualTimeState.enabled && manualTimeState.timeString) {
    manualTimeStatusEl.textContent = `Manual time set to ${manualTimeState.timeString}.`;
  } else if (manualTimeState.enabled) {
    manualTimeStatusEl.textContent = "Manual time enabled. Choose a time to preview.";
  } else {
    manualTimeStatusEl.textContent = "Following device time.";
  }
}

function handleManualToggle() {
  manualTimeState.enabled = manualTimeToggleEl.checked;
  updateManualTimeStatus();
  updateTime();
  updatePhase();
}

function handleManualTimeInput() {
  if (!manualTimeInputEl.value) {
    const now = new Date();
    manualTimeInputEl.value = `${formatTwoDigits(now.getHours())}:${formatTwoDigits(
      now.getMinutes()
    )}:${formatTwoDigits(now.getSeconds())}`;
  }
  manualTimeState.timeString = manualTimeInputEl.value;
  updateManualTimeStatus();
  updateTime();
  updatePhase();
}

function resetManualTime() {
  manualTimeState.enabled = false;
  manualTimeState.timeString = null;
  manualTimeToggleEl.checked = false;
  manualTimeInputEl.value = "";
  updateManualTimeStatus();
  updateTime();
  updatePhase();
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
  nextPhaseLabelEl.textContent = "Next phase: --";
  nextPhaseCountdownEl.textContent = "--";
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

manualTimeToggleEl.addEventListener("change", handleManualToggle);
manualTimeInputEl.addEventListener("input", handleManualTimeInput);
resetTimeButtonEl.addEventListener("click", resetManualTime);
updateManualTimeStatus();
