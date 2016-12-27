/*** WeatherAlert Z-Way HA module *******************************************

Version: 1.00
(c) Maroš Kollár, 2015-2017
-----------------------------------------------------------------------------
Author: Maroš Kollár <maros@k-1.com>
Description:
    WeatherAlert module

******************************************************************************/

function WeatherAlert (id, controller) {
    // Call superconstructor first (AutomationModule)
    WeatherAlert.super_.call(this, id, controller);

    this.callback   = undefined;
    this.type       = [];
    this.baseurl    = 'http://feed.alertspro.meteogroup.com/AlertsPro/AlertsProPollService.php';
    this.areaId     = undefined;
    this.allTypes   = [
         "unknown",
         "storm",
         "snow",
         "rain",
         "frost",
         "forest_fire",
         "thunderstorm",
         "glaze",
         "heat",
         "freezing_rain",
         "soil_frost"
    ];
    this.allSeverities = {
        "green":    0,
        "yellow":   2,
        "orange":   3,
        "red":      4,
        "violet":   5
    };
    this.checkInterval = [
        60,
        30,
        15,
        5,
        5,
        5
    ];
}

inherits(WeatherAlert, BaseModule);

_module = WeatherAlert;

// ----------------------------------------------------------------------------
// --- Module instance initialized
// ----------------------------------------------------------------------------

WeatherAlert.prototype.init = function (config) {
    WeatherAlert.super_.prototype.init.call(this, config);

    var self = this;
    self.type = self.config.type;
    if (self.type.length === 0) {
        self.type = self.allTypes;
    }

    // Create vdev
    self.vDev = self.controller.devices.create({
        deviceId: "WeatherAlert_" + self.id,
        defaults: {
            metrics: {
                probeTitle: 'WeatherAlert',
                timestamp: 0,
                title: self.langFile.m_title,
                level: 0,
                type: null,
                text: null,
                icon: self.imagePath+'/icon_severity0.png'
            }
        },
        overlay: {
            alertType: self.type,
            probeType: 'weather_alert',
            deviceType: 'sensorMultilevel'
        },
        handler: function(command,args) {
            if (command === 'update') {
                var timestamp = this.get('metrics:timestamp') - (10 * 60);
                if (timestamp < parseInt((new Date()).getTime() / 1000)) {
                    self.getAlerts();
                }
            }
        },
        moduleId: self.id
    });

    self.callback = _.bind(self.getAlerts,self,'interval');
    setTimeout(_.bind(self.getAreaId,self),1000 * 15);
};

WeatherAlert.prototype.stop = function () {
    var self = this;

    if (self.vDev) {
        self.controller.devices.remove(self.vDev.id);
        self.vDev = undefined;
    }

    self.stopTimeout();
    self.callback = undefined;

    WeatherAlert.super_.prototype.stop.call(this);
};

// ----------------------------------------------------------------------------
// --- Module methods
// ----------------------------------------------------------------------------

WeatherAlert.prototype.query = function(method,args,callback) {
    var self = this;
    var url = self.baseurl+'?method='+method;
    _.each(args,function(value,key){
        url = url + '&' + key + '=' + value;
    });

    http.request({
        url: url,
        async: true,
        success: function(response) {
            if (typeof(response.data) === 'string') {
                callback(JSON.parse(response.data));
            } else {
                callback(response.data);
            }
        },
        error: function(response) {
            self.error("Update error: "+response.statusText);
            self.controller.addNotification(
                "error",
                self.langFile.error_fetch,
                "module",
                self.constructor.name
            );
        }
    });
};

WeatherAlert.prototype.getAreaId = function() {
    var self = this;

    if (typeof(self.config.latitude) === 'undefined'
        || typeof(self.config.longitude) === 'undefined') {
        self.error('Latitude and/or longitude missing');
        return;
    }

    self.log('Fetch Area ID');
    // Get coordinates
    self.query(
        'lookupCoord',
        { lat: self.config.latitude, lon: self.config.longitude },
        function(response) {
            self.areaId = response[0].AREA_ID;
            if (typeof(self.areaId) !== 'undefined') {
                self.getAlerts();
            }
        }
    );
};

WeatherAlert.prototype.getAlerts = function() {
    var self = this;

    if (typeof(self.areaId) === 'undefined') {
        self.log('No Area ID available yet');
        self.getAreaId();
        return;
    }

    var alerts      = [];
    self.log('Fetch alerts for areaID '+self.areaId);

    self.query(
        'getWarning',
        { areaID: self.areaId, language: self.controller.defaultLang },
        _.bind(self.processAlerts,self)
    );
};

WeatherAlert.prototype.processAlerts = function(response) {
    var self = this;

    var severity = 0;
    var type = null;
    var text = null;
    var currentTime = parseInt((new Date()).getTime() / 1000);

    self.log('Process alerts');
    _.each(response.results,function(result) {
        var resultType = self.allTypes[ result.type - 1 ];
        var resultSeverity = self.getSeverity(result.payload.levelName);

        if (result.dtgStart > currentTime
            || result.dtgEnd < currentTime) {
            return;
        }
        if (typeof(self.config.altitude) !== 'undefined'
            && (self.config.altitude < result.payload.altMin || self.config.altitude > result.payload.altMax)) {
            return;
        }
        if (_.indexOf(self.type,resultType) === -1) {
            return;
        }

        if (resultSeverity > severity) {
            severity  = resultSeverity;
            type      = resultType;
            text      = result.payload.shortText;
        }
    });

    self.vDev.set("metrics:timestamp",currentTime);
    self.vDev.set('metrics:level',severity);
    self.vDev.set('metrics:icon',self.imagePath+'/icon_severity'+severity+'.png');
    self.vDev.set('metrics:type',type);
    self.vDev.set('metrics:text',text);

    self.stopTimeout();
    self.timeout = setTimeout(
        self.callback,
        1000*60*self.checkInterval[severity]
    );
};

WeatherAlert.prototype.getSeverity = function(levelName) {
    var self = this;

    var levels = levelName.split('_');
    if (levels[0] === 'notice') {
        return 1;
    } else if (levels[1] === 'forewarn') {
        return 2;
    } else {
        return self.allSeverities[levels[2]];
    }
    self.error('Could not parse levelName: '+levelName);
    return 0;
};

WeatherAlert.prototype.stopTimeout = function() {
    var self = this;

    if (typeof(self.timeout) !== 'undefined') {
        clearTimeout(self.timeout);
        self.timeout = undefined;
    }
};