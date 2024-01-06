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
    sceneId = sceneMetadata[getPluginId("sceneId")];
    if(!sceneId) {
        log("No id for scene, adding one.");
        await OBR.scene.setMetadata({
            [getPluginId("sceneId")]: crypto.randomUUID()
        });
    }
    log(`Scene id: "${sceneId}".`);
    loadCamera();
    setInterval(saveCamera, cameraSaveInterval);
}

async function loadCamera() {
    let camera = getSceneCamera();
    if(!camera) {
        return;
    }

    let focus = camera.position;
    // Offset camera to load the centre point rather than top left.
    focus.x += await OBR.viewport.getWidth() / 2;
    focus.y += await OBR.viewport.getHeight() / 2;
    log("Loading camera.");
    OBR.viewport.setPosition(focus);
    OBR.viewport.setScale(camera.scale);
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
    let focus = await OBR.viewport.getPosition();
    // Offset camera to save the centre point rather than top left.
    focus.x -= await OBR.viewport.getWidth() / 2;
    focus.y -= await OBR.viewport.getHeight() / 2;
    let cameras = JSON.parse(localStorage.getItem(getPluginId())) || {};
    let camera = {
        position: focus,
        scale: await OBR.viewport.getScale()
    };
    cameras[sceneId] = camera;
    log(`Saving camera.`);
    localStorage.setItem(getPluginId(), JSON.stringify(cameras));
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
