import OBR from "@owlbear-rodeo/sdk";

// One minute between saves.
let cameraSaveInterval = 1000 * 60;

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

function init() {
    log("Starting");

    loadCamera();
    setInterval(saveCamera, cameraSaveInterval);
}

async function loadCamera() {
    let camera = JSON.parse(localStorage.getItem(getPluginId()));
    if(!camera) {
        return;
    }

    let focus = camera.position;
    // Offset camera to load the centre point rather than top left.
    focus.x += await OBR.viewport.getWidth() / 2;
    focus.y += await OBR.viewport.getHeight() / 2;
    OBR.viewport.setPosition(focus);
    OBR.viewport.setScale(camera.scale);
}

async function saveCamera() {
    let focus = await OBR.viewport.getPosition();
    // Offset camera to save the centre point rather than top left.
    focus.x -= await OBR.viewport.getWidth() / 2;
    focus.y -= await OBR.viewport.getHeight() / 2;
    let camera = {
        position: focus,
        scale: await OBR.viewport.getScale()
    };
    localStorage.setItem(getPluginId(), JSON.stringify(camera));
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
