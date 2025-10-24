# Feature Redirect URL [x]
I have been using the authservice downstream and noted a few things I would like to implement. So the first thing is the concept of the login success redirect url. Can you make it that when the authservice detects the a  login is reguired that it captures the referrer and then redirects back to that address once you have successfully logged in but also allow the developer to add a override url that can be added in 
options that can be used instead of the referrer.

# Feature Login Style [x]
I would like to use the auth service for customer facing sites so I would like to be able to style it according to the calling application. I believe that the style use bootstrap and it also references the common /styles.css hosted by the callin system but I would like to be able to set the name of the application and the logo to be shown on the login and register screen. Please allow me to pass that in the options.