// Delivery location: map, address search and "use my location".
// Uses Google map tiles and Nominatim (free, max 1 request/second) for address lookups.

const DEFAULT_POINT = { lat: 18.508885, lng: 73.956373 }; // Gopalpatti, Pune

/**
 * Sets up the map and inputs.
 * @param {(message: string) => void} showStatus  shows short messages to the user
 * @returns {() => {latitude: number, longitude: number, pincode: string, address: string}}  reads the current location
 */
export function initLocation(showStatus) {
  const addressInput = document.getElementById('address-input');
  const detectButton = document.getElementById('detect-location');
  const coordsText = document.getElementById('coords');
  const pincodeInput = document.getElementById('pincode-input');

  let point = { ...DEFAULT_POINT };

  // Stores price by pincode, so every map move updates it. The user can still type one.
  function setPincode(postcode) {
    const pin = String(postcode || '').replace(/\s/g, '');
    if (/^[1-9]\d{5}$/.test(pin)) pincodeInput.value = pin;
  }

  const map = L.map('map').setView([point.lat, point.lng], 13);
  // shortcut: Google's public tile URL works without a key but isn't allowed by Google's terms and can be
  // blocked anytime. Before launch, switch to the Google Map Tiles API (with a key) or another provider.
  L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
    subdomains: ['0', '1', '2', '3'],
    maxZoom: 20,
    attribution: '&copy; Google',
  }).addTo(map);
  const marker = L.marker([point.lat, point.lng], { draggable: true }).addTo(map);

  function setPoint(lat, lng, zoom) {
    point = { lat, lng };
    marker.setLatLng([lat, lng]);
    if (zoom) map.setView([lat, lng], zoom);
    coordsText.textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }

  // Map → address
  async function fillAddressFromPoint(lat, lng) {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=17`);
      const data = await res.json();
      const a = data.address || {};
      addressInput.value = [a.road || a.neighbourhood || a.suburb, a.city || a.town || a.state_district].filter(Boolean).join(', ') || data.display_name || '';
      setPincode(a.postcode);
    } catch {
      // The address text is only a label; the user can type the pincode if this lookup fails.
    }
  }

  // Address → map
  async function findAddress() {
    const query = addressInput.value.trim();
    if (!query) return;
    showStatus('Finding location…');
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&q=${encodeURIComponent(query)}`);
      const [match] = await res.json();
      if (!match) return showStatus(`Couldn't find "${query}". Try a nearby area or city.`);
      setPoint(parseFloat(match.lat), parseFloat(match.lon), 14);
      if (match.address?.postcode) setPincode(match.address.postcode);
      else fillAddressFromPoint(parseFloat(match.lat), parseFloat(match.lon)); // area results often have no pincode
      showStatus('');
    } catch {
      showStatus('Location search failed. Check your internet connection.');
    }
  }

  marker.on('dragend', () => {
    const { lat, lng } = marker.getLatLng();
    setPoint(lat, lng);
    fillAddressFromPoint(lat, lng);
  });

  map.on('click', e => {
    setPoint(e.latlng.lat, e.latlng.lng);
    fillAddressFromPoint(e.latlng.lat, e.latlng.lng);
  });

  addressInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') findAddress();
  });

  detectButton.addEventListener('click', () => {
    if (!navigator.geolocation) return showStatus('Your browser cannot share its location.');
    showStatus('Getting your location…');
    navigator.geolocation.getCurrentPosition(
      pos => {
        setPoint(pos.coords.latitude, pos.coords.longitude, 15);
        fillAddressFromPoint(pos.coords.latitude, pos.coords.longitude);
        showStatus('');
      },
      () => showStatus('Location permission was denied. Search for your area instead.')
    );
  });

  setPoint(point.lat, point.lng);

  return () => ({ latitude: point.lat, longitude: point.lng, pincode: pincodeInput.value.trim(), address: addressInput.value.trim() });
}
