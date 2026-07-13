// Déclarations
let fireGeoJSON = null;
let activePolygonId = null;
let attributionControl = null;
let allFiresData = null;

async function loadAllFires() {
    const response = await fetch('https://raw.githubusercontent.com/jeremieprudhomme/Deplace-le-feu/refs/heads/main/fires.geojson');
	//console.log(response.status);
    allFiresData = await response.json();
	//console.log(allFiresData);
    populateFireSelector();
    //loadFire(allFiresData.features[0]); // Charge le premier feu par défaut
	// Chargement du feu de Die par défaut
	loadFire(allFiresData.features.find(f => f.properties.name === "Die"));
	document.getElementById('fire-selector').value = allFiresData.features.findIndex(f => f.properties.name === "Die");
}

window.addEventListener('load', () => {
	document.getElementById('welcome-modal').style.visibility = 'visible';
});
function closeModal() {
	document.getElementById('welcome-modal').style.visibility = 'hidden';
}

function populateFireSelector() {
    const selector = document.getElementById('fire-selector');
    selector.innerHTML = '';
    allFiresData.features.forEach((feature, index) => {
        const { municipality, departement, year, contour_date } = feature.properties;
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `Feu de forêt de ${municipality} (${departement}) - ${year}`;
        selector.appendChild(option);
    });
}


// Initialiser la carte avec un centre par défaut (sera remplacé par le centroïde du GeoJSON)
const map = new maplibregl.Map({
container: 'map',
style: 'https://data.geopf.fr/annexes/ressources/vectorTiles/styles/PLAN.IGN/standard.json',
center: [2.43333911, 46.67937318], // Centre temporaire (France)
zoom: 5,
});

attributionControl = new maplibregl.AttributionControl({
compact: false
});

map.addControl(attributionControl);

function updateAttribution(text){

if(attributionControl){
map.removeControl(attributionControl);
}

// Attribution IGN + attribution du feu
const fullAttribution = text + '<br/>Fond de carte : © <a href="https://geoservices.ign.fr/planign" target="_blank">IGN - Plan IGN</a>';

attributionControl = new maplibregl.AttributionControl({
compact:false,
customAttribution:fullAttribution
});

map.addControl(attributionControl,'bottom-right');
}

// Fonction pour charger un feu et centrer la carte sur son centroïde
async function loadFire(feature) {
	// Nettoyage de l'ancien feu
    if (activePolygonId) {
        ['-fill', '-line', '-label-layer'].forEach(suffix => {
            if (map.getLayer(activePolygonId + suffix)) map.removeLayer(activePolygonId + suffix);
        });
        [activePolygonId, activePolygonId + '-label'].forEach(source => {
            if (map.getSource(source)) map.removeSource(source);
        });
    }
	
	// Générer un ID unique
	activePolygonId = 'fire-' + Date.now();
    fireGeoJSON = { type: 'FeatureCollection', features: [feature] };
	
	// Centrage et zoom
    map.fitBounds(turf.bbox(fireGeoJSON) /*Calcule la boîte englobante*/, { padding: 100, maxZoom: 15, duration: 1000 });

	// Attente chargement de la carte au bon zoom
	await new Promise(resolve => map.once('moveend', resolve));
	
	
	// Ajoute les couches
	map.addSource(activePolygonId, { type: 'geojson', data: fireGeoJSON });
	map.addLayer({ id: activePolygonId + '-fill', type: 'fill', source: activePolygonId, paint: { 'fill-color': '#ff2323', 'fill-opacity': 0.5 } });
	map.addLayer({ id: activePolygonId + '-line', type: 'line', source: activePolygonId, paint: { 'line-color': '#FF0000', 'line-width': 2 } });

	// Label avec la surface
	/*const surfaceHa = (turf.area(fireGeoJSON) / 10000).toFixed(0);
	const centroid = turf.centroid(fireGeoJSON);
	map.addSource(activePolygonId + '-label', { type: 'geojson', data: centroid });
	map.addLayer({
		id: activePolygonId + '-label-layer',
		type: 'symbol',
		source: activePolygonId + '-label',
		layout: { 'text-field': surfaceHa + ' ha', 'text-size': 14, 'text-allow-overlap': true },
		paint: { 'text-color': '#FF0000', 'text-halo-color': '#FFFFFF', 'text-halo-width': 2 }
	});*/
	
	// ===== OU =====
	// Label avec la date de contour
	/*const contourDate = feature.properties.contour_date || 'Date inconnue';
	const centroid = turf.centroid(fireGeoJSON);
	map.addSource(activePolygonId + '-label', { type: 'geojson', data: centroid });
	map.addLayer({
		id: activePolygonId + '-label-layer',
		type: 'symbol',
		source: activePolygonId + '-label',
		layout: { 'text-field': contourDate, 'text-size': 14, 'text-allow-overlap': true,'text-ignore-placement': true,'text-anchor': 'center' },
		paint: { 'text-color': '#FF0000', 'text-halo-color': '#FFFFFF', 'text-halo-width': 2 }
	});
	*/

	// Formatage de la date des données
	const formattedDate = new Date(feature.properties.contour_date).toLocaleDateString(undefined, {
		year: 'numeric',
		month: 'numeric',
		day: 'numeric'
	});
	// Mise à jour des attributions (avec remplacement des \" par un simple "
    updateAttribution(feature.properties.attribution.replace(/\\"/g, '"') + ' du ' + formattedDate);

}

// Ajout contrôles
map.addControl(new maplibregl.NavigationControl({
	showCompass: true,    // Affiche la boussole
	showZoom: true        // Affiche les boutons +/-
}), 'top-right');

// Écouteur du menu
document.getElementById('fire-selector').addEventListener('change', (e) => {
    loadFire(allFiresData.features[parseInt(e.target.value)]);
});

map.on('load', () => {
	console.log("Carte chargée, chargement du feu par défaut...");
	loadAllFires();
});

// Recherche d'adresse
const addressInput=document.getElementById('address-input');
const resultsContainer=document.getElementById('address-results');
let searchTimeout,currentResults=[],selectedIndex=-1;
function renderResults(){
	resultsContainer.innerHTML='';
	currentResults.forEach((f,i)=>{
		const d=document.createElement('div');
		d.textContent=f.properties.label;
		if(i===selectedIndex)d.classList.add('selected');
		d.onclick=()=>selectResult(i);
		resultsContainer.appendChild(d);
	});
	resultsContainer.style.display=currentResults.length?'block':'none';
}

function selectResult(i){
	const f=currentResults[i]; if(!f)return;
	const [lng,lat]=f.geometry.coordinates;
	addressInput.value=f.properties.label;
	resultsContainer.style.display='none';
	map.flyTo({center:[lng,lat],zoom:10});
}

addressInput.addEventListener('input',()=>{
	clearTimeout(searchTimeout);
	const q=addressInput.value.trim();
	if(q.length<3)
		{resultsContainer.style.display='none';return;}
		searchTimeout=setTimeout(async()=>{
		const r=await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=5`);
		const d=await r.json();
		currentResults=d.features||[]; selectedIndex=-1; renderResults();
	},250);
});

addressInput.addEventListener('keydown',e=>{
	if(resultsContainer.style.display!=='block')return;
	if(e.key==='ArrowDown')
	{e.preventDefault();selectedIndex=Math.min(selectedIndex+1,currentResults.length-1);renderResults();resultsContainer.children[selectedIndex]?.scrollIntoView({block:'nearest'});}
	else if(e.key==='ArrowUp')
		{e.preventDefault();selectedIndex=Math.max(selectedIndex-1,0);renderResults();resultsContainer.children[selectedIndex]?.scrollIntoView({block:'nearest'});}
	else if(e.key==='Enter')
		{e.preventDefault(); if(selectedIndex>=0)selectResult(selectedIndex); else if(currentResults.length)selectResult(0);}
	else if(e.key==='Escape')
		{resultsContainer.style.display='none';}
});

document.addEventListener('click',e=>{if(!addressInput.contains(e.target)&&!resultsContainer.contains(e.target))resultsContainer.style.display='none';});

// Déplacement du polygone
function movePolygonToCenter() {
	if (!fireGeoJSON || !activePolygonId) return;
	if (!map.getSource(activePolygonId)) return;

	const center = map.getCenter();
	const centroid = turf.centroid(fireGeoJSON);
	const offset = {
		lng: center.lng - centroid.geometry.coordinates[0],
		lat: center.lat - centroid.geometry.coordinates[1]
	};

	// Mettre à jour les coordonnées du (multi)polygone
	const updatedGeoJSONData = JSON.parse(JSON.stringify(fireGeoJSON));

	// Parcourir TOUS les polygones (y compris MultiPolygon)
	updatedGeoJSONData.features.forEach(feature => {
		if (!feature.geometry || !feature.geometry.coordinates) return;

		const coords = feature.geometry.coordinates;
		const type = feature.geometry.type;

		if (type === 'Polygon') {
			// Appliquer l'offset à tous les anneaux du polygone (extérieur + trous)
			coords.forEach(ring => {
				ring.forEach(coord => {
					coord[0] += offset.lng;
					coord[1] += offset.lat;
				});
			});
		}
		else if (type === 'MultiPolygon') {
			// Appliquer l'offset à chaque polygone du MultiPolygon
			coords.forEach(polygon => {
				polygon.forEach(ring => {
					ring.forEach(coord => {
						coord[0] += offset.lng;
						coord[1] += offset.lat;
					});
				});
			});
		}
	});
	
	// Mettre à jour la source de données
	map.getSource(activePolygonId).setData(updatedGeoJSONData);
	
	// Déplacer également le label
	const updatedCentroid = turf.centroid(updatedGeoJSONData);

	const labelSource = map.getSource(activePolygonId + '-label');
	if (labelSource) {
		labelSource.setData(updatedCentroid);
	}
}

map.on('move', movePolygonToCenter);
