# Nooblyjs-core Caching Javascript Library

## Feature Description
I would like to enable a new cool feature for consumers. This the exposing of a javascript library for firstly the caching service. How I see this working is is a new folder called src/caching/scriptlibrary/ that at is exposed under https://{application}/services/caching/srcipt/. In this client based javascript file it should exposure to a caching library is avaialble to application front ends and is accessed by putting a script file in the apps html file e.g. 

<script src="/services/caching/scriptlibrary">

It can then be used on the client like this

// Some data to cache
var object_to_be_cached= {data:{}};

// The caching library
var nooblyjscoreCaching = new nooblyjscoreCaching(option instanename);
nooblyjscoreCaching.put{object_to_be_cached,1000};

// The cache value recieved
var cachedData = nooblyjscoreCaching.get{object_to_be_cached,1000};

It is important to use services api for this implementation

Please create some sort ability to test this