# Enhance Notifying

# Feature: Instancing
I would like to implement instancing for the notifying service @src/services/notifying in this service and the service registry, Please look at the @src/services/caching to establish how it is done, but effectively I should be able to initiate different instances of the notifying service calling it like this

const priority = ServiceRegistry.notifying('memory', { instanceName: 'high' });
const regular = ServiceRegistry.notifying('memory', { instanceName: 'reg'});
const low = ServiceRegistry.notifying('memory', { instanceName: 'notimportant' });

Pleae ensure that the api's in @src/services/notifying/route also caters for calling the apis with the instance name. Just a reminder to look at caching/routes for the correct pattern and syntax to use and finally please update the UI in @src/services/notifying/views/index.html to have a instancename drop down to select the instance name that you are interacting with that will call the apis' with that instance

Oh last last thing, ensure the analics module understands the instance name as well as the dashboard should show the correct instance name data ... once more all of this is rinse and repeat of the caching service

#Feature
