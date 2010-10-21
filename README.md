## User Editor CouchApp Using StratifiedJS

StratifiedJS is an extended version of JavaScript with built-in facilities for concurrent programming.
It allows you to program asynchronous, non-blocking logic (as it is common in web apps) in a conventional sequential style. It adds just a few new keywords/functions to JavaScript: hold, waitfor, and, or, resume, retract, using.

Oni Apollo incorporates a cross-browser implementation of the StratifiedJS language in one small JavaScript file, combined with a CommonJS-style module system. Apollo makes structured and asynchronous programming easier on the developer.

[More info about Oni Apollo here.](http://onilabs.com/docs)


## CouchDB

CouchApps are web applications which can be served directly from [CouchDB](http://couchdb.apache.org). This gives them the nice property of replicating just like any other data stored in CouchDB. They are also simple to write as they can use the built-in jQuery libraries and plugins that ship with CouchDB.

[More info about CouchApps here.](http://couchapp.org)

## Deploying this app

Assuming you just cloned this app from git, and you have changed into the app directory in your terminal, you want to push it to your CouchDB with the CouchApp command line tool, like this:

    couchapp push . http://name:password@hostname:5984/_users

If you don't have a password on your CouchDB (admin party) you can do it like this (but it's a bad, idea, set a password):

    couchapp push . http://hostname:5984/_users

If you get sick of typing the URL, you should setup a `.couchapprc` file in the root of your directory. Remember not to check this into version control as it will have passwords in it.

The `.couchapprc` file should have contents like this:

    {
      "env" : {
        "public" : {
          "db" : "http://name:pass@mycouch.couchone.com/_users"
        },
        "default" : {
          "db" : "http://name:pass@localhost:5984/_users"
        }
      }
    }

Now that you have the `.couchapprc` file set up, you can push your app to the CouchDB as simply as:

    couchapp push

This pushes to the `default` as specified. To push to the `public` you'd run:

    couchapp push public

Of course you can continue to add more deployment targets as you see fit, and give them whatever names you like.
