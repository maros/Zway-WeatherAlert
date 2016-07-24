/*** WeatherAlert Z-Way HA module *******************************************

Version: 1.00
(c) Maroš Kollár, 2015
-----------------------------------------------------------------------------
Author: Maroš Kollár <maros@k-1.com>
Description:
    WeatherAlert module

******************************************************************************/

function WeatherAlert (id, controller) {
    // Call superconstructor first (AutomationModule)
    WeatherAlert.super_.call(this, id, controller);
    
    this.baseurl    = 'http://feed.alertspro.meteogroup.com/AlertsPro/AlertsProPollService.php';
    this.severity   = {
        "green":    0,
        "yellow":   2,
        "orange":   3,
        "red":      4,
        "violet":   5
    };
    this.type      = [
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
    
    this.areaId     = undefined;
}

inherits(WeatherAlert, BaseModule);

_module = WeatherAlert;

// ----------------------------------------------------------------------------
// --- Module instance initialized
// ----------------------------------------------------------------------------

WeatherAlert.prototype.init = function (config) {
    WeatherAlert.super_.prototype.init.call(this, config);
    
    var self = this;
    
    // Create vdev
    self.vDev = self.controller.devices.create({
        deviceId: "WeatherAlert_" + self.id,
        defaults: {
            metrics: {
                timestamp: 0,
                title: self.langFile.m_title,
                level: 0,
                type: null,
                text: null,
                icon: self.imagePath+'/icon_severity0.png'
            }
        },
        overlay: {
            //alertType: self.config.type,
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
    
    setTimeout(_.bind(self.getAreaId,self),1000 * 15);
    self.interval = setInterval(_.bind(self.getAlerts,self,'interval'),30*60*1000);
};

WeatherAlert.prototype.stop = function () {
    var self = this;
    
    if (self.vDev) {
        self.controller.devices.remove(self.vDev.id);
        self.vDev = undefined;
    }
    
    if (typeof(self.interval) !== 'undefined') {
        clearInterval(self.interval);
        self.interval = undefined;
    }
    
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
    
    self.log(url);
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
            console.logJS(response);
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
        if (result.dtgStart > currentTime
            || result.dtgEnd < currentTime) {
            return;
        }
        if (typeof(self.config.altitude) !== 'undefined'
            && (self.config.altitude < result.payload.altMin || self.config.altitude > result.payload.altMax)) {
            return;
        }
        
        if (typeof(self.config.type) !== 'undefined'
            && self.config.type.length > 0
            && _.indexOf(self.config.type,self.type[ result.type - 1 ]) === -1) {
            return;
        }
        
        var resultSeverity = self.getSeverity(result.payload.levelName);
        if (resultSeverity > alert.severity) {
            severity  = resultSeverity;
            type      = self.type[ result.type - 1 ];
            text      = result.payload.shortText;
        }
    });
    
    self.vDev.set("metrics:timestamp",currentTime);
    self.vDev.set('metrics:level',severity);
    self.vDev.set('metrics:icon',self.imagePath+'/icon_severity'+severity+'.png');
    self.vDev.set('metrics:type',type);
    self.vDev.set('metrics:type',text);
};

WeatherAlert.prototype.getSeverity = function(levelName) {
    var levels = levelName.split('_');
    if (levels[0] === 'notice') {
        return 1;
    } else if (levels[1] === 'forewarn') {
        return 2;
    } else {
        return self.severity[levels[2]];
    }
    self.error('Could not parse levelName: '+levelName);
    return 0;
};