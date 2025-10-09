# Nooblyjs Core Workdlow Features

## Background
I would like to start enhancing the worflow configuration pages to allow for administration by the user and use the dataservice to store the information. In addition I would like to create the concept of a library of activies that is exposed by the filer object and a nice Ui to define the workflows. I would also like some nice dashboards on current activity and failures and successfull outcomes. And lets finally understand how the security was created.

## Feature 1: Ensure usage of the worker object
I would like to make sure that the worker object is working well and is using the filer to retieve the activity from the activity library so we need to ensure that both the workflow and scheduler passes a filer to the worker.

