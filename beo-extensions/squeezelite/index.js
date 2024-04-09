// SQUEEZelite CONTROL FOR BEOCREATE

const { updateAttribValueConfig, 
	getExtensionStatus, 
	setExtensionStatus,
	restartExtension } = 
require(global.beo.extensionDirectory+'/hbosextensions/utilities');

var exec = require("child_process").exec;
var fs = require("fs");

var debug = beo.debug;
var version = require("./package.json").version;

var sources = null;

var settings = {
	serverAddress: null,
	squeezeliteEnabled: true
}

var configuration = {};

const hbosextensionName="squeezelite"
const beosource="squeezelite"

beo.bus.on('general', function(event) {
	
	if (event.header == "startup") {
		
		if (beo.extensions.sources &&
			beo.extensions.sources.setSourceOptions &&
			beo.extensions.sources.sourceDeactivated) {
			sources = beo.extensions.sources;
		}
		
		if (sources) {
			getExtensionStatus(hbosextensionName, function(enabled) {
				sources.setSourceOptions(beosource, {
					enabled: enabled,
					aka: ["lms"],
					transportControls: true,
					usesHifiberryControl: true
				});
				settings.squeezeliteEnabled = enabled
			});

		}
		
		readSqueezeliteConfiguration();

		if (configuration.server && configuration.server.value != "0.0.0.0") {
			settings.serverAddress = configuration.server.value;

		} else {
			settings.serverAddress = null;
		}
		console.log("Server: "+settings.serverAddress)
	}
	
	if (event.header == "activatedExtension") {
		if (event.content.extension == beosource) {
			beo.bus.emit("ui", {target: beosource, header: "squeezeliteSettings", content: settings});
		}
	}
	
});

beo.bus.on('product-information', function(event) {
	
	if (event.header == "systemNameChanged") {
		restartExtension("")		
	}
});

beo.bus.on(beosource, function(event) {

	if (event.header == "squeezeliteEnabled") {
		if (event.content.enabled !== undefined) {
		  setExtensionStatus(hbosextensionName, event.content.enabled, function(newStatus, error) {
			// Emit updated settings to UI
			beo.bus.emit("ui", {target: beosource, header: "squeezeliteSettings", content: {"squeezeliteEnabled": event.content.enabled}});
	
			// Update source options based on new status
			if (sources) sources.setSourceOptions(beosource, {enabled: event.content.enabled});
	
			// Handle deactivation
			if (event.content.enabled === false) {
			  if (sources) sources.sourceDeactivated(beosource);
			}
	
			// Handle errors
			if (error) {
			  beo.bus.emit("ui", {target: beosource, header: "errorTogglingSqueezelite", content: {}});
			}
		  });
		}
	  }

	
	if (event.header == "setServerAddress") {
		
		if (event.content.address != undefined) {
			settings.serverAddress = event.content.address;
			relaunch = settings.squeezeliteEnabled;
			configureSqueezelite([{option: "server", value: settings.serverAddress}], relaunch, function(success) {
				beo.bus.emit("ui", {target: beosource, header: "squeezeliteSettings", content: settings});
			});
		} else {
			settings.serverAddress = null;
			relaunch = settings.squeezeliteEnabled;
			configureSqueezelite([{option: "server", remove: true}], relaunch, function(success) {
				beo.bus.emit("ui", {target: beosource, header: "squeezeliteSettings", content: settings});
			});
		}
	
	}
});


function configureSqueezelite(options, relaunch, callback) {
	readSqueezeliteConfiguration();
	if (typeof options == "object" && !Array.isArray(options)) {
		options = [options];
	}
	for (var i = 0; i < options.length; i++) {
		if (options[i].option) {
			if (options[i].value) {
				if (debug) console.log("Configuring Squeezelite (setting "+options[i].option+")...")
				configuration[options[i].option] = {value: options[i].value, comment: false};
			} else {
				if (configuration[options[i].option]) {
					if (options[i].remove) {
						if (debug) console.log("Configuring Squeezelite (removing "+options[i].option+")...")
						delete configuration[options[i].option];
					} else {
						if (debug) console.log("Configuring Squeezelite (commenting out "+options[i].option+")...")
						configuration[options[i].option].comment = true;
					}
				}
			}
		}
	}
	writeSqueezeliteConfiguration();
	if (relaunch) {
		restartExtension(hbosextensionName, (success, error) => {
			if (error) {
			  console.error("Failed to restart the service:", error);
			  beo.bus.emit("ui", { target: "shairport-sync", header: "serviceRestartError" });
			  return; // Exit if unable to restart the service
			}

			console.log("Service restarted successfully.");
			if (callback) callback(true);
		  });	
	} else {
		if (callback) callback(true);
	}
}

squeezeliteConfigModified = 0;

function writeSqueezeliteConfiguration() {
	// Saves current configuration back into the file.
	fs.writeFileSync("/etc/squeezelite.json", JSON.stringify(configuration));
	squeezeliteConfigModified = fs.statSync("/etc/squeezelite.json").mtimeMs;
}


function readSqueezeliteConfiguration() {
    const configFile = "/etc/squeezelite.json";

    try {
        if (fs.existsSync(configFile)) {
            const modified = fs.statSync(configFile).mtimeMs;
            if (modified !== squeezeliteConfigModified) {
                // Update the last modified time
                squeezeliteConfigModified = modified;
                
                // Read and parse configuration file
                const squeezeliteConfig = fs.readFileSync(configFile, "utf8");
                configuration = JSON.parse(squeezeliteConfig);
            }
        }
    } catch (error) {
        // Log the error to console or handle it as needed
        console.error("Error reading or parsing the Squeezelite configuration:", error);
        // Depending on your needs, you may choose to return an empty configuration,
        // the last known good configuration, or even re-throw the error.
    }
}

	
module.exports = {
	version: version
};

