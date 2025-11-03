# Nooblyjs-core Queueing Javascript Library

## Feature Description
I would like to enable a new cool feature for consumers. This the exposing of a javascript library for firstly the queueing service. How I see this working is a new folder called src/queueing/scriptlibrary/ that at is exposed under https://{application}/services/queueing/srcipt/. In this client based javascript file it should exposure to a queueing library is avaialble to application front ends and is accessed by putting a script file in the apps html file e.g. 

<script src="/services/queueing/scriptlibrary">

It can then be used on the client like this

// Some data to cache
var object_to_be_queued = {data:{}};

// The queueing library
var nooblyjscorequeueing = new nooblyjscorequeueing(option instanename);
nooblyjscorequeueing.enqueue{queuename,object_to_be_cached};

// The cache value recieved
var cachedData = nooblyjscorequeueing.dequeue{queuename};

It is important to use services api for this implementation

Please create some sort ability to test this