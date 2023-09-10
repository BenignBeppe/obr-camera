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
