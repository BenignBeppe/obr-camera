import AddRounded from "@mui/icons-material/AddRounded";
import EditRounded from "@mui/icons-material/EditRounded";
import LocationOnRounded from "@mui/icons-material/LocationOnRounded";
import SaveRounded from "@mui/icons-material/SaveRounded";
import SettingsRounded from "@mui/icons-material/SettingsRounded";
import Checkbox from "@mui/material/Checkbox";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import OBR, { type Metadata, type ViewportTransform } from "@owlbear-rodeo/sdk";
import { useEffect, useState, type ChangeEvent } from "react";
import { PluginListItem } from "../lib/obr-plugin/PluginListItem.tsx";

// Ten seconds between saves.
let saveCameraInterval = 1000 * 10;
let saveCameraIntervalId: number;
let sceneId: string;

interface Location {
    position: {
        x: number,
        y: number
    };
    scale: number;
}

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
    let [settingsOpen, setSettingsOpen] = useState(false);
    function toggleSettingsOpen() {
        setSettingsOpen(!settingsOpen);
    };

    return <Stack>
        <Stack direction="row" sx={{ alignItems: "center" }}>
            <IconButton title="Add location" onClick={addLocation}>
                <AddRounded />
            </IconButton>
            <IconButton title="Settings" onClick={toggleSettingsOpen}>
                <SettingsRounded {...settingsOpen && {color: "primary"}}/>
            </IconButton>
        </Stack>
        <Collapse in={settingsOpen}>
            <Stack paddingInline={2}>
                <RememberPositionToggle />
                <AnimateMovementToggle />
            </Stack>
        </Collapse>
        <Divider variant="middle" />
        <LocationList />
    </Stack>;
}

function RememberPositionToggle() {
    let initialValue = getSetting("rememberPosition", true);
    let [checked, setChecked] = useState(initialValue);

    function changeValue(event: ChangeEvent<HTMLInputElement>) {
        if(event.target.checked) {
            saveCameraIntervalId = setInterval(saveCamera, saveCameraInterval);
        } else {
            clearInterval(saveCameraIntervalId);
        }
        setChecked(event.target.checked);
        setSetting("rememberPosition", event.target.checked);
    }

    let checkbox = <Checkbox
        onChange={changeValue}
        checked={checked}
        disableRipple
    />;
    let label = <Typography color="textPrimary">
        Remember camera position
    </Typography>;
    return <FormControlLabel control={ checkbox } label={ label } />;
}

function AnimateMovementToggle() {
    let initialValue = getSetting("animateMovement", false);
    let [checked, setChecked] = useState(initialValue);

    function changeValue(event: ChangeEvent<HTMLInputElement>) {
        setChecked(event.target.checked);
        setSetting("animateMovement", event.target.checked);
    }

    let checkbox = <Checkbox
        onChange={changeValue}
        checked={checked}
        disableRipple
    />;
    let label = <Typography color="textPrimary">
        Animate camera movement
    </Typography>;
    return <FormControlLabel control={ checkbox } label={ label } />;
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
    let goToButton = <IconButton
        title="Go to location"
        onClick={() => goToLocation(location)}
    >
        <LocationOnRounded />
    </IconButton>;

    let buttons = [
        <IconButton title="Edit name" onClick={() => editName(location)}>
            <EditRounded />
        </IconButton>,
        <IconButton title="Save location" onClick={() => saveLocation(location)}>
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

function debug(...message: unknown[]) {
    console.debug(`${getPluginId()}:`, ...message);
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
    debug(`Scene ID: "${sceneId}".`);
    if(!sceneMetadata[getPluginId("locations")]) {
        debug("Adding empty locations.");
        await OBR.scene.setMetadata({
            [getPluginId("locations")]: []
        });
    }
    if(getSetting("rememberPosition", true)) {
        loadCamera();
        saveCameraIntervalId = setInterval(saveCamera, saveCameraInterval);
    }
}

async function loadCamera() {
    let camera = getSceneCamera();
    if(!camera) {
        return;
    }

    goToLocation(camera);
}

function getSceneCamera(): Location | null {
    let cameras = getSetting("sceneCameras");
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
    let cameras = getSetting("sceneCameras", {});
    cameras[sceneId] = location;
    setSetting("sceneCameras", cameras);
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
    let transform: ViewportTransform = {
        position: focus,
        scale: location.scale
    };
    if(getSetting("animateMovement")) {
        OBR.viewport.animateTo(transform);
    } else {
        OBR.viewport.setPosition(focus);
        OBR.viewport.setScale(location.scale);
    }
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

function getSetting(name: string, defaultValue?: unknown) {
    defaultValue ??= null;
    let jsonString = localStorage.getItem(getPluginId(name));
    if(!jsonString) {
        return defaultValue;
    }

    let value;
    try {
        value = JSON.parse(jsonString);
    } catch {
        return defaultValue;
    }

    return value;
}

function setSetting(name: string, value: unknown) {
    let valueString;
    try {
        valueString = JSON.stringify(value);
    } catch {
        debug("Couldn't stringify setting value:", value);
        return;
    }

    debug(`Saving setting "${name}" = ${valueString}`);
    localStorage.setItem(getPluginId(name), valueString);
}
