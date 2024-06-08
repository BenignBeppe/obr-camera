import OBR from "@owlbear-rodeo/sdk";

// One minute between saves.
let cameraSaveInterval = 1000 * 60;
let sceneId;

function log(...message) {
    console.log(`${getPluginId()}:`, ...message);
}

function getPluginId(path) {
    let pluginId = "eu.sebber.obr-camera";
    if(path) {
        pluginId += `/${path}`;
    }
    return pluginId;
}

async function init() {
    log("Starting");

    let sceneMetadata = await OBR.scene.getMetadata();
    if(!sceneMetadata[getPluginId("sceneId")]) {
        await OBR.scene.setMetadata({
            [getPluginId("sceneId")]: crypto.randomUUID()
        });
    }
    if(!sceneMetadata[getPluginId("locations")]) {
        await OBR.scene.setMetadata({
            [getPluginId("locations")]: []
        });
    }
    sceneId = sceneMetadata[getPluginId("sceneId")];
    loadCamera();
    setInterval(saveCamera, cameraSaveInterval);
    OBR.scene.onMetadataChange(() => {
        updateLocationList();
    });
    document.querySelector("#add-location").addEventListener("click", addLocation);
    updateLocationList();
}

async function loadCamera() {
    let camera = getSceneCamera();
    if(!camera) {
        return;
    }

    goToLocation(camera);
}

async function goToLocation(location) {
    log("Moving to location:", location);
    let focus = structuredClone(location.position);
    // Offset camera to load the centre point rather than top left.
    focus.x += await OBR.viewport.getWidth() / 2;
    focus.y += await OBR.viewport.getHeight() / 2;
    OBR.viewport.setPosition(focus);
    OBR.viewport.setScale(location.scale);
}

function getSceneCamera() {
    let cameras = JSON.parse(localStorage.getItem(getPluginId()));
    if(!cameras) {
        return;
    }

    if(!Object.hasOwn(cameras, sceneId)) {
        return;
    }

    return cameras[sceneId];
}

async function saveCamera() {
    log("Saving camera.");
    let location = await makeLocation();
    let cameras = JSON.parse(localStorage.getItem(getPluginId())) || {};
    cameras[sceneId] = location;
    localStorage.setItem(getPluginId(), JSON.stringify(cameras));
}

async function makeLocation() {
    let focus = await OBR.viewport.getPosition();
    // Offset camera to save the centre point rather than top left.
    focus.x -= await OBR.viewport.getWidth() / 2;
    focus.y -= await OBR.viewport.getHeight() / 2;
    let location = {
        position: focus,
        scale: await OBR.viewport.getScale()
    };

    return location;
}

async function addLocation() {
    let name = prompt("Enter location name.");
    if(!name) {
        return;
    }

    let metadata = await OBR.scene.getMetadata();
    let locations = metadata[getPluginId("locations")];
    let matchingNameLocation = locations.find(t => t.name === name);
    if(matchingNameLocation) {
        alert(
            "A location with that name is already in the list. New location" +
            " will not be added."
        );
        return;
    }

    let location = await makeLocation();
    location["name"] = name;
    log("Adding location:" + location);
    locations.push(location);
    await OBR.scene.setMetadata({
        [getPluginId("locations")]: locations
    });
}

async function updateLocationList() {
    let metadata = await OBR.scene.getMetadata();
    let locations = metadata[getPluginId("locations")];
    let locationElements = [];
    for(let [index, location] of locations.entries()) {
        let template = document.querySelector("#templates .location");
        let locationElement = template.cloneNode(true);
        locationElement.querySelector(".go-to").addEventListener(
            "click",
            () => {goToLocation(location)}
        );
        let nameElement = locationElement.querySelector(".name");
        nameElement.textContent = location.name;
        locationElement.querySelector(".edit").addEventListener(
            "click",
            () => {editName(index, location.name)}
        );
        locationElement.querySelector(".save").addEventListener(
            "click",
            () => {saveLocation(location)}
        );
        locationElement.querySelector(".remove").addEventListener(
            "click",
            () => {removeLocation(index, location)}
        );
        locationElements.push(locationElement);
    }
    let locationList = document.querySelector("#locations");
    locationList.replaceChildren(...locationElements);
}

async function editName(index, oldName) {
    let name = prompt("Enter new location name.", oldName);
    if(!name) {
        return;
    }
    
    let metadata = await OBR.scene.getMetadata();
    let locations = metadata[getPluginId("locations")];
    let matchingNameLocation = locations.find(t => t.name === name);
    if(matchingNameLocation) {
        alert(
            "A location with that name is already in the list." + 
            " Name will not be changed."
        );
        return;
    }

    locations[index].name = name;
    await OBR.scene.setMetadata({
        [getPluginId("locations")]: locations
    });
}

async function saveLocation(location) {
    let confirmed = confirm(
        "Are you sure you want to overwrite location" +
        ` "${location.name}"?`
    );
    if(!confirmed) {
        return;
    }

    let newLocation = await makeLocation();
    Object.assign(location, newLocation);
    let metadata = await OBR.scene.getMetadata();
    let locations = metadata[getPluginId("locations")];            
    locations[index] = location;
    await OBR.scene.setMetadata({
        [getPluginId("locations")]: locations
    });
}

async function removeLocation(index, location) {
    let confirmed = confirm(
        "Are you sure you want to remove location" +
        ` "${location.name}" from the list?`
    );
    if(!confirmed) {
        return;
    }

    log(`Removing location "${location.name}".`);            
    let metadata = await OBR.scene.getMetadata();
    let locations = metadata[getPluginId("locations")];            
    locations.splice(index, 1);
    await OBR.scene.setMetadata({
        [getPluginId("locations")]: locations
    });
}

OBR.onReady(async () => {
    if(await OBR.scene.isReady()) {
        init();
    } else {
        OBR.scene.onReadyChange((ready) => {
            if(ready) {
                init();
            }
        });
    }
});
