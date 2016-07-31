# Zway-WeatherAlert

Zway automation module for severe weather alerts. Displays alert levels
ranging from 0 (no alert) to 5 (exterme) via a multilevel sensor virtual 
device. Weather alerts are available for the following countries.

* Austria
* Belgium
* Denmark
* Finland
* France
* Germany
* Ireland
* Italy
* Liechtenstein
* Luxembourg
* Netherlands
* Norway
* Portugal
* Sweden
* Switzerland
* Spain
* United Kingdom

Alert levels translate to the following contitions

* 0: No alert (green)
* 1: Active weather notice (green)
* 2: Severe weather forewarning (yellow)
* 3: Severe weather warning (moderate, orange)
* 4: Severe weather warning (heavy, red)
* 5: Severe weather warning (extreme, violet)

# Configuration

## latitude,longitude

Geo coordinates for the current position in decimal notation.

## altitude

Location altitude above sea level in meters (optional)

## type

List of multiple alert types. The following alert types are available

* Storm
* Snow
* Rain
* Frost
* Forest Fire
* Thunderstorm
* Glaze
* Heat
* Freezing Rain
* Soil Frost

# Events

No events are emitted.

# Virtual Devices

This module creates a virtual binary sensor that displays the current alert
level for the selected alert types. The following metrics are written

* level: Alert severity ranging from 0 to 5
* type: Alert type. If multiple alerts are in place only the type of the 
alert with the highest level is displayed
* text: Alert text description.

# Installation

Install the BaseModule from https://github.com/maros/Zway-BaseModule first

The prefered way of installing this module is via the "Zwave.me App Store"
available in 2.2.0 and higher. For stable module releases no access token is 
required. If you want to test the latest pre-releases use 'k1_beta' as 
app store access token.

For developers and users of older Zway versions installation via git is 
recommended.

```shell
cd /opt/z-way-server/automation/userModules
git clone https://github.com/maros/Zway-RemoteHost.git RemoteHost --branch latest
```

To update or install a specific version
```shell
cd /opt/z-way-server/automation/userModules/RemoteHost
git fetch --tags
# For latest released version
git checkout tags/latest
# For a specific version
git checkout tags/1.02
# For development version
git checkout -b master --track origin/master
```

# License

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or any 
later version.

Alert icon by Thomas Le Bas from the Noun Project

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.
