# Enhance Notifying

# Feature: Instancing
I would like to implement instancing for the notifying service @src/services/notifying in this service and the service registry, Please look at the @src/services/caching to establish how it is done, but effectively I should be able to initiate different instances of the notifying service calling it like this

const priority = ServiceRegistry.notifying('memory', { instanceName: 'high' });
const regular = ServiceRegistry.notifying('memory', { instanceName: 'reg'});
const low = ServiceRegistry.notifying('memory', { instanceName: 'notimportant' });

Pleae ensure that the api's in @src/services/notifying/route also caters for calling the apis with the instance name. Just a reminder to look at caching/routes for the correct pattern and syntax to use and finally please update the UI in @src/services/notifying/views/index.html to have a instancename drop down to select the instance name that you are interacting with that will call the apis' with that instance

Oh last last thing, ensure the analics module understands the instance name as well as the dashboard should show the correct instance name data ... once more all of this is rinse and repeat of the caching service

# Feature: Usage of Public/styles.css
I am not complete happy that we have css styles defined in @src/notifying/views/index.html. Is it possible for you to merge these styles with the styles in the @public/styles.css file and remove it from the @src/notifying/views/index.html. Please note that if the style exists in public styles, dont duplicate it

# Feature: Swagger docs.json
In the @src/notifying service I would like to do some clean up and refactoring and I would love some help with this. Firstly can you create a swagger json file by looking at the api's that have been created in @src/notifying/routes/index.js file and create the swagger json file in @src/notifyinh/routes/swagger/docs.json file for me and expose it on the url /services/notifying/api/swagger/docs.json

# Feature: View Usage docs.json
Okay so now the next step, using that json file. So in the notifying views folder @src/notifying/views/index.html file we build up a swagger view but in this javascript code we build up the data that could be read by the
services/notifying/api/swagger/docs.json, can you change the javascript code in @src/notifying/views/index.html that builds the swagger view to use the docs.json url

# Feature: Scripts library
Ok this is a pretty cool feature, I would like to make available to consumers a javascript library for using the notifying service without need to build the integrations themselves. So what I would like you to do is in the folder @src/services/notifying/scripts/js create an index.js file that will represent a client side javascipt library that enables all the client side functions of the notifying service leveraging the apis. This service should be used like the following:

test.html
<script src="/services/notifying/scripts">
<script>
  var notifying = new nooblyjsNotifying({instancename:'memory'});
  notifying.createTopic('high events')

  notifying.subsciber('high events', function(message){
    console.log('message')
  })
</script>

Please note that you can ignore the analytics endpoints and settings endpoints as consumers will not need this.


# Feature: Client side notifyer (service bus)
I would love to implement something cool, namely light client side versions of a service. I would love to continue with notifying by createing the local client (client side javascript) version of notifying. What I see us doing is in the @src/notfying/scripts/js/index.js file creating a local javascript pubsub using a javascript  where I can create topics and subscribe to those topics and then it rasies events to those method subcribers. This client side notifier should be used if no instance name is passed so the logic of using 'default' will have to be changed. Can you please implement that for me?

# Feature: Usage documentation
Ok and now for all the cool usage documentation, but I would like to break it out into individual services. Can you please create me  a file in @docs/usage/nooblyjs-core-notifying-usage.md documenting all the features of the notifying service including providers, consuming the service, script usage, api usage.

# Feature: Concise Usage documentation
Can you then make another usage file that is just for llms to consume, so make concise and place it in a @docs/usage/nooblyjs-core-notifying-usage.md file, I would like to make it less than 1k lines
