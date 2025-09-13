import AddRounded from "@mui/icons-material/AddRounded";
import EditRounded from "@mui/icons-material/EditRounded";
import LocationOnRounded from "@mui/icons-material/LocationOnRounded";
import SaveRounded from "@mui/icons-material/SaveRounded";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import Stack from "@mui/material/Stack";
import OBR, { type Metadata } from "@owlbear-rodeo/sdk";
import { useEffect, useState } from "react";
import { PluginListItem } from "../lib/obr-plugin/PluginListItem.tsx";

// One minute between saves.
let cameraSaveInterval = 1000 * 60;
let sceneId: string;

interface Location {
    position: {
        x: number,
        y: number
    };
    scale: number;
};

interface NamedLocation extends Location {
    name: string;
}

export function App() {
    useEffect(() =>
        OBR.scene.onReadyChange((ready) => {
            if(ready) {
                init();
            }
        }),
        []
    );

    return <Stack>
        <Stack direction="row" sx={{ alignItems: "center" }}>
            <IconButton onClick={addLocation}>
                <AddRounded />
            </IconButton>
        </Stack>
        <Divider variant="middle" />
        <LocationList />
    </Stack>;
}

function LocationList() {
    let [locations, setLocations] = useState<NamedLocation[]>([]);
    useEffect(() => {
        function onChange(metadata: Metadata) {
            let locations = metadata[getPluginId("locations")] as [];
            setLocations(locations);
        };
        OBR.scene.getMetadata().then(onChange);
        return OBR.scene.onMetadataChange(onChange);
    }, []);

    return <List>
        {locations?.map((location, index) => (
            <LocationItem key={location.name} location={location} locations={locations} index={index} />
        ))}
    </List>;
}

function LocationItem(
    { location, locations, index }:
    { location: NamedLocation, locations: NamedLocation[], index: number }
) {
    let goToButton = <IconButton onClick={() => goToLocation(location)}>
        <LocationOnRounded />
    </IconButton>;

    let buttons = [
        <IconButton onClick={() => editName(location)}>
            <EditRounded />
        </IconButton>,
        <IconButton onClick={() => saveLocation(location)}>
            <SaveRounded />
        </IconButton>
    ];

    return <PluginListItem
        item={location}
        index={index}
        items={locations}
        label={location.name}
        actionButton={goToButton}
        moveItem={moveLocationItem}
        removeItem={removeLocation}
        buttons={buttons}
    />;
}

function getPluginId(path?: string) {
    let pluginId = "eu.sebber.obr-camera";
    if(path) {
        pluginId += `/${path}`;
    }
    return pluginId;
}

function log(...message: unknown[]) {
    console.log(`${getPluginId()}:`, ...message);
}

async function init() {
    let sceneMetadata = await OBR.scene.getMetadata();
    if(sceneMetadata[getPluginId("sceneId")]) {
        sceneId = sceneMetadata[getPluginId("sceneId")] as string;
    } else {
        sceneId = crypto.randomUUID();
        log(`Generating new scene ID: "${sceneId}".`);
        await OBR.scene.setMetadata({
            [getPluginId("sceneId")]: crypto.randomUUID()
        });
    }
    log(`Scene ID: "${sceneId}".`);
    if(!sceneMetadata[getPluginId("locations")]) {
        log("Adding empty locations.");
        await OBR.scene.setMetadata({
            [getPluginId("locations")]: []
        });
    }
    loadCamera();
    setInterval(saveCamera, cameraSaveInterval);
}

async function loadCamera() {
    let camera = getSceneCamera();
    if(!camera) {
        return;
    }

    goToLocation(camera);
}

function getSceneCamera(): Location | null {
    let jsonString = localStorage.getItem(getPluginId());
    if(!jsonString) {
        return null;
    }

    let cameras = JSON.parse(jsonString);
    if(!cameras) {
        return null;
    }

    if(!Object.hasOwn(cameras, sceneId)) {
        return null;
    }

    return cameras[sceneId];
}

async function saveCamera() {
    log("Saving camera.");
    let location = await makeLocation();
    let jsonString = localStorage.getItem(getPluginId());
    let cameras;
    if(jsonString) {
        cameras = JSON.parse(jsonString);
    } else {
        cameras = {};
    }
    cameras[sceneId] = location;
    localStorage.setItem(getPluginId(), JSON.stringify(cameras));
}

async function addLocation() {
    let name = prompt("Enter location name.");
    if(!name) {
        return;
    }

    let metadata = await OBR.scene.getMetadata();
    let locations = metadata[getPluginId("locations")] as NamedLocation[];
    let matchingNameLocation = locations.find(t => t.name === name);
    if(matchingNameLocation) {
        alert(
            "A location with that name is already in the list. New location" +
            " will not be added."
        );
        return;
    }

    let location = await makeLocation() as NamedLocation;
    location.name = name;
    locations.push(location);
    log("Adding location:", location);
    await OBR.scene.setMetadata({
        [getPluginId("locations")]: locations
    });
}

async function makeLocation(): Promise<Location> {
    let focus = await OBR.viewport.getPosition();
    // Offset camera to save the centre point rather than top left.
    focus.x -= await OBR.viewport.getWidth() / 2;
    focus.y -= await OBR.viewport.getHeight() / 2;
    let location: Location = {
        position: focus,
        scale: await OBR.viewport.getScale()
    };

    return location;
}

async function goToLocation(location: Location) {
    log("Moving to location:", location);
    let focus = structuredClone(location.position);
    // Offset camera to load the centre point rather than top left.
    focus.x += await OBR.viewport.getWidth() / 2;
    focus.y += await OBR.viewport.getHeight() / 2;
    OBR.viewport.setPosition(focus);
    OBR.viewport.setScale(location.scale);
}

async function moveLocationItem(location: NamedLocation, shift: number) {
    let metadata = await OBR.scene.getMetadata();
    let locations = metadata[getPluginId("locations")] as NamedLocation[];
    let index = locations.findIndex((l) => l.name === location.name);
    if(index === -1) {
        // Couldn't find location.
        return;
    }

    let adjacentIndex = index + shift;
    if(adjacentIndex < 0 || adjacentIndex > locations.length - 1) {
        // Adjacent index out of list.
        return;
    }

    // Swap location with the one above.
    [locations[adjacentIndex], locations[index]] = [locations[index], locations[adjacentIndex]];
    await OBR.scene.setMetadata({
        [getPluginId("locations")]: locations
    });
}

async function removeLocation(location: NamedLocation) {
    let confirmed = confirm(
        "Are you sure you want to remove location" +
        ` "${location.name}" from the list?`
    );
    if(!confirmed) {
        return;
    }

    let metadata = await OBR.scene.getMetadata();
    let locations = metadata[getPluginId("locations")] as NamedLocation[];
    let index = locations.findIndex((l) => l.name === location.name);
    if(index === -1) {
        return;
    }

    locations.splice(index, 1);
    log("Removing location:", location);
    await OBR.scene.setMetadata({
        [getPluginId("locations")]: locations
    });
}

async function editName(location: NamedLocation) {
    let name = prompt("Enter new location name.", location.name);
    if(!name) {
        return;
    }

    let metadata = await OBR.scene.getMetadata();
    let locations = metadata[getPluginId("locations")] as NamedLocation[];
    let matchingNameLocation = locations.find(l => l.name === name);
    if(matchingNameLocation) {
        alert(
            "A location with that name is already in the list." +
            " Name will not be changed."
        );
        return;
    }
    let index = locations.findIndex((l) => l.name === location.name);
    if(index === -1) {
        return;
    }

    locations[index].name = name;
    await OBR.scene.setMetadata({
        [getPluginId("locations")]: locations
    });
}

async function saveLocation(location: NamedLocation) {
    let confirmed = confirm(
        `Are you sure you want to overwrite location "${location.name}"?`
    );
    if(!confirmed) {
        return;
    }

    let newLocation = await makeLocation() as NamedLocation;
    newLocation.name = location.name;
    let metadata = await OBR.scene.getMetadata();
    let locations = metadata[getPluginId("locations")] as NamedLocation[];
    let index = locations.findIndex((l) => l.name === location.name);
    if(index === -1) {
        return;
    }

    locations[index] = newLocation;
    await OBR.scene.setMetadata({
        [getPluginId("locations")]: locations
    });
}
