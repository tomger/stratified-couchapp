// Licensed under the Apache License, Version 2.0 (the "License"); you may not
// use this file except in compliance with the License. You may obtain a copy of
// the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
// WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
// License for the specific language governing permissions and limitations under
// the License.

/**
  @module couchdb
  @summary The standard synchronous Couchdb JS API ported to StratifiedJS.
  @desc
    The only changes applied are:
    
    - moved all functions to exports instead of CouchDB to achieve CommonJS compatibility
    - Added an exported function to construct a CouchDB object: exports.couchdb(...)
    - made .request use http.xhr instead of a blocking XHR request
    - added more commmon naming like get, remove, save, create...
    - the object returned from .get(id) has it's own CRUD functions.
    
    `var person = couch.get("john");
    person.country = "Japan";
    person.save();
    person.remove();`
    `
*/

function CouchDB(name, httpHeaders) {
  this.name = name;
  this.uri = "/" + encodeURIComponent(name) + "/";

  // The XMLHttpRequest object from the most recent request. Callers can
  // use this to check result http status and headers.
  this.last_req = null;

  this.request = function(method, uri, requestOptions) {
    requestOptions = requestOptions || {}
    requestOptions.headers = combine(requestOptions.headers, httpHeaders)
    return exports.request(method, uri, requestOptions);
  }

  // Creates the database on the server
  this.createDb = function() {
    this.last_req = this.request("PUT", this.uri);
    exports.maybeThrowError(this.last_req);
    return JSON.parse(this.last_req.responseText);
  }

  // Deletes the database on the server
  this.deleteDb = function() {
    this.last_req = this.request("DELETE", this.uri);
    if (this.last_req.status == 404) {
      return false;
    }
    exports.maybeThrowError(this.last_req);
    return JSON.parse(this.last_req.responseText);
  }

  // Save a document to the database
  this.save = function(doc, options) {
    if (doc._id == undefined) {
      doc._id = exports.newUuids(1)[0];
    }

    this.last_req = this.request("PUT", this.uri  +
        encodeURIComponent(doc._id) + encodeOptions(options),
        {body: JSON.stringify(doc)});
    exports.maybeThrowError(this.last_req);
    var result = JSON.parse(this.last_req.responseText);
    doc._rev = result.rev;
    return result;
  }
  
  /* Add some ActiveRecord inspired methods */
  function wrapObject(doc, db) {
    doc.save = function() { this._rev = db.save(this)._rev; return this; };
    doc.remove = function() { return db.remove(this); };
    doc.reload = function() {
      var newdoc = db.get(this._id);
      for (var p in this) delete this[p];
      for (var p in newdoc) this[p] = newdoc[p];
      return this;
    };
    return doc;
  }
  
  this.create = function(doc) {
    return wrapObject(doc || { _id: exports.newUuids(1)[0] } , this);
  }

  // Open a document from the database
  this.get = this.open = function(docId, options) {
    this.last_req = this.request("GET", this.uri + encodeURIComponent(docId)
      + encodeOptions(options));
    if (this.last_req.status == 404) {
      return null;
    }
    exports.maybeThrowError(this.last_req);
    var doc = JSON.parse(this.last_req.responseText);
    return wrapObject(doc, this);
  }

  // Deletes a document from the database
  this.remove = this.deleteDoc = function(doc) {
    this.last_req = this.request("DELETE", this.uri + encodeURIComponent(doc._id)
      + "?rev=" + doc._rev);
    exports.maybeThrowError(this.last_req);
    var result = JSON.parse(this.last_req.responseText);
    doc._rev = result.rev; //record rev in input document
    doc._deleted = true;
    return result;
  }

  // Deletes an attachment from a document
  this.deleteDocAttachment = function(doc, attachment_name) {
    this.last_req = this.request("DELETE", this.uri + encodeURIComponent(doc._id)
      + "/" + attachment_name + "?rev=" + doc._rev);
    exports.maybeThrowError(this.last_req);
    var result = JSON.parse(this.last_req.responseText);
    doc._rev = result.rev; //record rev in input document
    return result;
  }
  
  this.bulkRemove = this.bulkDelete = function(docs) {
    for (var i=0; i< docs.length; i++) {
      docs[i]._deleted = true;
    }
    return this.bulkSave(docs);
  }

  this.bulkSave = function(docs, options) {
    // first prepoulate the UUIDs for new documents
    var newCount = 0
    for (var i=0; i<docs.length; i++) {
      if (docs[i]._id == undefined) {
        newCount++;
      }
    }
    // TOM var newUuids = exports.newUuids(docs.length);
    var newUuids = exports.newUuids(newCount);
    //var newCount = 0
    for (var i=0; i<docs.length; i++) {
      if (docs[i]._id == undefined) {
        docs[i]._id = newUuids.pop();
      }
    }
    var json = {"docs": docs};
    // put any options in the json
    for (var option in options) {
      json[option] = options[option];
    }
    this.last_req = this.request("POST", this.uri + "_bulk_docs", {
      body: JSON.stringify(json)
    });
    if (this.last_req.status == 417) {
      return {errors: JSON.parse(this.last_req.responseText)};
    }
    else {
      exports.maybeThrowError(this.last_req);
      var results = JSON.parse(this.last_req.responseText);
      for (var i = 0; i < docs.length; i++) {
        if(results[i] && results[i].rev) {
          docs[i]._rev = results[i].rev;
        }
      }
      return results;
    }
  }

  this.ensureFullCommit = function() {
    this.last_req = this.request("POST", this.uri + "_ensure_full_commit");
    exports.maybeThrowError(this.last_req);
    return JSON.parse(this.last_req.responseText);
  }

  // Applies the map function to the contents of database and returns the results.
  this.query = function(mapFun, reduceFun, options, keys, language) {
    var body = {language: language || "javascript"};
    if(keys) {
      body.keys = keys ;
    }
    if (typeof(mapFun) != "string") {
      mapFun = mapFun.toSource ? mapFun.toSource() : "(" + mapFun.toString() + ")";
    }
    body.map = mapFun;
    if (reduceFun != null) {
      if (typeof(reduceFun) != "string") {
        reduceFun = reduceFun.toSource ?
          reduceFun.toSource() : "(" + reduceFun.toString() + ")";
      }
      body.reduce = reduceFun;
    }
    if (options && options.options != undefined) {
        body.options = options.options;
        delete options.options;
    }
    this.last_req = this.request("POST", this.uri + "_temp_view"
      + encodeOptions(options), {
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(body)
    });
    exports.maybeThrowError(this.last_req);
    return JSON.parse(this.last_req.responseText);
  }

  this.view = function(viewname, options, keys) {
    var viewParts = viewname.split('/');
    var viewPath = this.uri + "_design/" + viewParts[0] + "/_view/"
        + viewParts[1] + encodeOptions(options);
    if(!keys) {
      this.last_req = this.request("GET", viewPath);
    } else {
      this.last_req = this.request("POST", viewPath, {
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({keys:keys})
      });
    }
    if (this.last_req.status == 404) {
      return null;
    }
    exports.maybeThrowError(this.last_req);
    return JSON.parse(this.last_req.responseText);
  }

  // gets information about the database
  this.info = function() {
    this.last_req = this.request("GET", this.uri);
    exports.maybeThrowError(this.last_req);
    return JSON.parse(this.last_req.responseText);
  }

  // gets information about a design doc
  this.designInfo = function(docid) {
    this.last_req = this.request("GET", this.uri + docid + "/_info");
    exports.maybeThrowError(this.last_req);
    return JSON.parse(this.last_req.responseText);
  }

  this.allDocs = function(options,keys) {
    if(!keys) {
      this.last_req = this.request("GET", this.uri + "_all_docs"
        + encodeOptions(options));
    } else {
      this.last_req = this.request("POST", this.uri + "_all_docs"
        + encodeOptions(options), {
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({keys:keys})
      });
    }
    exports.maybeThrowError(this.last_req);
    return JSON.parse(this.last_req.responseText);
  }

  this.designDocs = function() {
    return this.allDocs({startkey:"_design", endkey:"_design0"});
  };

  this.changes = function(options) {
    this.last_req = this.request("GET", this.uri + "_changes" 
      + encodeOptions(options));
    exports.maybeThrowError(this.last_req);
    return JSON.parse(this.last_req.responseText);
  }

  this.compact = function() {
    this.last_req = this.request("POST", this.uri + "_compact");
    exports.maybeThrowError(this.last_req);
    return JSON.parse(this.last_req.responseText);
  }

  this.viewCleanup = function() {
    this.last_req = this.request("POST", this.uri + "_view_cleanup");
    exports.maybeThrowError(this.last_req);
    return JSON.parse(this.last_req.responseText);
  }

  this.setDbProperty = function(propId, propValue) {
    this.last_req = this.request("PUT", this.uri + propId,{
      body:JSON.stringify(propValue)
    });
    exports.maybeThrowError(this.last_req);
    return JSON.parse(this.last_req.responseText);
  }

  this.getDbProperty = function(propId) {
    this.last_req = this.request("GET", this.uri + propId);
    exports.maybeThrowError(this.last_req);
    return JSON.parse(this.last_req.responseText);
  }

  this.setSecObj = function(secObj) {
    this.last_req = this.request("PUT", this.uri + "_security",{
      body:JSON.stringify(secObj)
    });
    exports.maybeThrowError(this.last_req);
    return JSON.parse(this.last_req.responseText);
  }

  this.getSecObj = function() {
    this.last_req = this.request("GET", this.uri + "_security");
    exports.maybeThrowError(this.last_req);
    return JSON.parse(this.last_req.responseText);
  }

  // Convert a options object to an url query string.
  // ex: {key:'value',key2:'value2'} becomes '?key="value"&key2="value2"'
  function encodeOptions(options) {
    var buf = []
    if (typeof(options) == "object" && options !== null) {
      for (var name in options) {
        if (!options.hasOwnProperty(name)) { continue };
        var value = options[name];
        if (name == "key" || name == "startkey" || name == "endkey") {
          value = toJSON(value);
        }
        buf.push(encodeURIComponent(name) + "=" + encodeURIComponent(value));
      }
    }
    if (!buf.length) {
      return "";
    }
    return "?" + buf.join("&");
  }

  function toJSON(obj) {
    return obj !== null ? JSON.stringify(obj) : null;
  }

  function combine(object1, object2) {
    if (!object2) {
      return object1;
    }
    if (!object1) {
      return object2;
    }

    for (var name in object2) {
      object1[name] = object2[name];
    }
    return object1;
  }

}

// this is the XMLHttpRequest object from last request made by the following
// exports.* functions (except for calls to request itself).
// Use this from callers to check HTTP status or header values of requests.
exports.last_req = null;
exports.urlPrefix = '';

exports.login = function(name, password) {
  exports.last_req = exports.request("POST", "/_session", {
    headers: {"Content-Type": "application/x-www-form-urlencoded",
      "X-CouchDB-WWW-Authenticate": "Cookie"},
    body: "name=" + encodeURIComponent(name) + "&password="
      + encodeURIComponent(password)
  });
  return JSON.parse(exports.last_req.responseText);
}

exports.logout = function() {
  exports.last_req = exports.request("DELETE", "/_session", {
    headers: {"Content-Type": "application/x-www-form-urlencoded",
      "X-CouchDB-WWW-Authenticate": "Cookie"}
  });
  return JSON.parse(exports.last_req.responseText);
}

exports.session = function(options) {
  options = options || {};
  exports.last_req = exports.request("GET", "/_session", options);
  exports.maybeThrowError(exports.last_req);
  return JSON.parse(exports.last_req.responseText);
};

exports.user_prefix = "org.couchdb.user:";

exports.prepareUserDoc = function(user_doc, new_password) {
  user_doc._id = user_doc._id || exports.user_prefix + user_doc.name;
  if (new_password) {
    // handle the password crypto
    user_doc.salt = exports.newUuids(1)[0];
    user_doc.password_sha = hex_sha1(new_password + user_doc.salt);
  }
  user_doc.type = "user";
  if (!user_doc.roles) {
    user_doc.roles = []
  }
  return user_doc;
};

exports.allDbs = function() {
  exports.last_req = exports.request("GET", "/_all_dbs");
  exports.maybeThrowError(exports.last_req);
  return JSON.parse(exports.last_req.responseText);
};

exports.allDesignDocs = function() {
  var ddocs = {}, dbs = exports.allDbs();
  for (var i=0; i < dbs.length; i++) {
    var db = new CouchDB(dbs[i]);
    ddocs[dbs[i]] = db.designDocs();
  };
  return ddocs;
};

exports.getVersion = function() {
  exports.last_req = exports.request("GET", "/");
  exports.maybeThrowError(exports.last_req);
  return JSON.parse(exports.last_req.responseText).version;
}

exports.replicate = function(source, target, rep_options) {
  rep_options = rep_options || {};
  var headers = rep_options.headers || {};
  var body = rep_options.body || {};
  body.source = source;
  body.target = target;
  exports.last_req = exports.request("POST", "/_replicate", {
    headers: headers,
    body: JSON.stringify(body)
  });
  exports.maybeThrowError(exports.last_req);
  return JSON.parse(exports.last_req.responseText);
}

/*
exports.newXhr = function() {
  if (typeof(XMLHttpRequest) != "undefined") {
    return new XMLHttpRequest();
  } else if (typeof(ActiveXObject) != "undefined") {
    return new ActiveXObject("Microsoft.XMLHTTP");
  } else {
    throw new Error("No XMLHTTPRequest support detected");
  }
}
*/

/* TOM edited this function to use http.xhr*/
exports.request = function(method, uri, options) {
  options = options || {};
  options.headers = options.headers || {};
  options.headers["Content-Type"] = options.headers["Content-Type"] || options.headers["content-type"] || "application/json";
  options.headers["Accept"] = options.headers["Accept"] || options.headers["accept"] || "application/json";
  options.method = method; // needed by http.xhr
  //options.body is used by http.xhr
  
  if(uri.substr(0, "http://".length) != "http://") {
    uri = exports.urlPrefix + uri;
  }
  return require("http").xhr(uri, options);
}

exports.requestStats = function(module, key, test) {
  var query_arg = "";
  if(test !== null) {
    query_arg = "?flush=true";
  }

  var url = "/_stats/" + module + "/" + key + query_arg;
  var stat = exports.request("GET", url).responseText;
  return JSON.parse(stat)[module][key];
}

exports.uuids_cache = [];

exports.newUuids = function(n, buf) {
  buf = buf || 100;
  if (exports.uuids_cache.length >= n) {
    var uuids = exports.uuids_cache.slice(exports.uuids_cache.length - n);
    if(exports.uuids_cache.length - n == 0) {
      exports.uuids_cache = [];
    } else {
      exports.uuids_cache =
          exports.uuids_cache.slice(0, exports.uuids_cache.length - n);
    }
    return uuids;
  } else {
    exports.last_req = exports.request("GET", "/_uuids?count=" + (buf + n));
    exports.maybeThrowError(exports.last_req);
    var result = JSON.parse(exports.last_req.responseText);
    exports.uuids_cache =
        exports.uuids_cache.concat(result.uuids.slice(0, buf));
    return result.uuids.slice(buf);
  }
}

exports.maybeThrowError = function(req) {
  if (req.status >= 400) {
    try {
      var result = JSON.parse(req.responseText);
    } catch (ParseError) {
      var result = {error:"unknown", reason:req.responseText};
    }
    throw result;
  }
}

exports.params = function(options) {
  options = options || {};
  var returnArray = [];
  for(var key in options) {
    var value = options[key];
    returnArray.push(key + "=" + value);
  }
  return returnArray.join("&");
};

exports.couchdb = function (name, headers) {
  return new CouchDB(name, headers);
}
