# Nooblyjs-core logging Javascript Library

## Feature Description
I would like to enable a new cool feature for consumers. This the exposing of a javascript library for firstly the logging service. How I see this working is a new folder called src/logging/scriptlibrary/ that at is exposed under https://{application}/services/logging/srcipt/. In this client based javascript file it should exposure to a logging library is avaialble to application front ends and is accessed by putting a script file in the apps html file e.g. 

<script src="/services/logging/scriptlibrary">

It can then be used on the client like this

// Some data to cache

// The logging library
var nooblyjscorelogging = new nooblyjscorelogging(option instanename);
nooblyjscorelogging.info{'Some Logging Informatiom',{data: "some data"}};
nooblyjscorelogging.warn{'Some Logging Warnings',{data: "some data"}};
nooblyjscorelogging.error{'Some Logging Error',{data: "some data"}};
nooblyjscorelogging.debug{'Some Logging Debugging',{data: "some data"}};

It is important to use services api for this implementation

Please create some sort ability to test this