import OBR from "@owlbear-rodeo/sdk";

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
    setInterval(saveCamera, 1000);
}

function loadCamera() {
    let camera = JSON.parse(localStorage.getItem(getPluginId()));
    if(!camera) {
        return;
    }

    OBR.viewport.setPosition(camera.position);
    OBR.viewport.setScale(camera.scale);
}

async function saveCamera() {
    let camera = {
        position: await OBR.viewport.getPosition(),
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
